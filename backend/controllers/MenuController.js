const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const logActivity = require('../utils/activityLogger'); // NEW: Activity Logger

// ─── In-Memory Cache untuk Customer Menu ───
let customerMenuCache = null;
let customerMenuCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

const invalidateCustomerMenuCache = () => {
    customerMenuCache = null;
    customerMenuCacheTime = 0;
};

const getMenus = async (req, res) => {
    try {
        const items = await MenuItem.find().sort({ order: 1, category: 1, name: 1 });
        const recipes = await Recipe.find();
        const ingredients = await Ingredient.find();

        // 1. Map Ingredients: ID -> { stok, costPerUnit }
        const ingredientMap = new Map();
        ingredients.forEach(ing => {
            // Calculate Cost Per Production Unit (Dynamic HPP)
            // e.g. Harga Beli 20.000 / 1000gr = 20 per gr
            const costPerUnit = (ing.isi_prod && ing.isi_prod > 0)
                ? (ing.harga_beli / ing.isi_prod)
                : ing.harga_beli;

            ingredientMap.set(String(ing.id), {
                stok: Number(ing.stok || 0),
                costPerUnit: costPerUnit,
                type: ing.type || 'physical'
            });
        });

        // 2. Map Recipes: menuId -> ingredients[]
        const recipeMap = new Map();
        recipes.forEach(r => {
            recipeMap.set(String(r.menuId), r.ingredients);
        });

        // 3. Process Items
        const processedItems = items.map(item => {
            const itemObj = item.toObject();

            // Fix image mapping (DB has imageUrl, Frontend expects image)
            if (itemObj.imageUrl && !itemObj.image) {
                itemObj.image = itemObj.imageUrl;
            }

            // Default Status Logic
            let status = 'AVAILABLE';
            let availableQty = 0;
            let calculatedHPP = 0;

            // Fix booleans
            if (itemObj.is_active === undefined) itemObj.is_active = true;
            if (itemObj.use_stock_check === undefined) itemObj.use_stock_check = true;

            if (!itemObj.is_active) {
                status = 'NON_ACTIVE';
                availableQty = 0;
            } else if (!itemObj.use_stock_check) {
                status = 'AVAILABLE';
                availableQty = 9999;
            } else {
                // STOCK CALCULATION
                const recipeIngredients = recipeMap.get(String(item.id));

                if (recipeIngredients && recipeIngredients.length > 0) {
                    let minPortions = Infinity;

                    for (const ri of recipeIngredients) {
                        const ingKey = String(ri.ing_id);
                        const ingData = ingredientMap.get(ingKey);
                        const required = Number(ri.jumlah || 0);

                        if (ingData) {
                            // Calculate HPP
                            calculatedHPP += (ingData.costPerUnit * required);

                            // Calculate Stock (ONLY for physical items)
                            if (ingData.type === 'physical' && required > 0) {
                                const portions = Math.floor(ingData.stok / required);
                                if (portions < minPortions) minPortions = portions;
                            }
                        }
                    }

                    // If minPortions never touched (e.g. all non-physical), treat as unlimited? 
                    // No, if strictly no physical ingredients, then unlimited. 
                    // If ANY physical ingredient exists, limit applies.

                    // Simplified: If minPortions is still Infinity, it means no physical limits found.
                    availableQty = (minPortions === Infinity) ? 9999 : minPortions;

                } else {
                    availableQty = 9999;
                }

                if (availableQty < 1) {
                    status = 'SOLD_OUT';
                }
            }

            return {
                ...itemObj,
                status,
                available_qty: availableQty,
                hpp: Math.ceil(calculatedHPP), // Round up price
                profit: item.price - Math.ceil(calculatedHPP)
            };
        });

        res.json(processedItems);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ─── GET /api/menu/customer — Endpoint ringan untuk halaman customer ───
const getMenusCustomer = async (req, res) => {
    try {
        // Cek cache
        if (customerMenuCache && (Date.now() - customerMenuCacheTime < CACHE_TTL)) {
            return res.json(customerMenuCache);
        }

        const items = await MenuItem.find()
            .select('id name price imageUrl is_active category categoryId label base_price is_bundle order use_stock_check')
            .sort({ order: 1, category: 1, name: 1 })
            .lean();

        const recipes = await Recipe.find().select('menuId ingredients.ing_id ingredients.jumlah').lean();
        const ingredients = await Ingredient.find().select('id stok type').lean();

        // Map ingredients
        const ingredientMap = new Map();
        ingredients.forEach(ing => {
            ingredientMap.set(String(ing.id), {
                stok: Number(ing.stok || 0),
                type: ing.type || 'physical'
            });
        });

        // Map recipes
        const recipeMap = new Map();
        recipes.forEach(r => {
            recipeMap.set(String(r.menuId), r.ingredients);
        });

        // Process items (tanpa HPP/profit)
        const processedItems = items.map(item => {
            // Fix image mapping
            let image = item.imageUrl || null;

            let status = 'AVAILABLE';
            let availableQty = 0;

            const isActive = item.is_active !== undefined ? item.is_active : true;
            const useStockCheck = item.use_stock_check !== undefined ? item.use_stock_check : true;

            if (!isActive) {
                status = 'NON_ACTIVE';
                availableQty = 0;
            } else if (!useStockCheck) {
                status = 'AVAILABLE';
                availableQty = 9999;
            } else {
                const recipeIngredients = recipeMap.get(String(item.id));
                if (recipeIngredients && recipeIngredients.length > 0) {
                    let minPortions = Infinity;
                    for (const ri of recipeIngredients) {
                        const ingData = ingredientMap.get(String(ri.ing_id));
                        const required = Number(ri.jumlah || 0);
                        if (ingData && ingData.type === 'physical' && required > 0) {
                            const portions = Math.floor(ingData.stok / required);
                            if (portions < minPortions) minPortions = portions;
                        }
                    }
                    availableQty = (minPortions === Infinity) ? 9999 : minPortions;
                } else {
                    availableQty = 9999;
                }
                if (availableQty < 1) status = 'SOLD_OUT';
            }

            return {
                id: item.id,
                name: item.name,
                price: item.price,
                image,
                category: item.category,
                categoryId: item.categoryId,
                label: item.label,
                base_price: item.base_price,
                is_bundle: item.is_bundle,
                order: item.order,
                status,
                available_qty: availableQty
            };
        });

        // Simpan ke cache
        customerMenuCache = processedItems;
        customerMenuCacheTime = Date.now();

        res.json(processedItems);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getMenuById = async (req, res) => {
    try {
        const item = await MenuItem.findOne({ id: req.params.id });
        if (!item) return res.status(404).json({ error: 'Not found' });

        const itemObj = item.toObject();
        if (itemObj.imageUrl && !itemObj.image) {
            itemObj.image = itemObj.imageUrl;
        }

        res.json(itemObj);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const createMenu = async (req, res) => {
    try {
        const data = req.body; // Expects { menu: {...}, recipe: [...] }

        // Map image -> imageUrl for DB storage
        if (data.image) {
            data.imageUrl = data.image;
        }

        // 1. Create Menu Item
        // If body is flat (legacy), handle it
        const menuItemData = {
            ...data,
            // Ensure ID is generated if not sent (frontend usually sends it)
            id: data.id || `menu_${Date.now()}`
        };

        const item = new MenuItem(menuItemData);
        await item.save();
        invalidateCustomerMenuCache();

        // 2. Create Recipe if ingredients provided
        if (data.ingredients && Array.isArray(data.ingredients)) {
            const recipe = new Recipe({
                menuId: item.id,
                ingredients: data.ingredients
            });
            await recipe.save();
        }

        await logActivity({ req, action: 'CREATE_MENU', module: 'MENU', description: `Created menu: ${item.name}`, metadata: { menuId: item.id } });

        res.status(201).json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateMenu = async (req, res) => {
    try {
        // Map image -> imageUrl for DB storage
        const updateData = { ...req.body };
        if (updateData.image) {
            updateData.imageUrl = updateData.image;
        }

        const item = await MenuItem.findOneAndUpdate({ id: req.params.id }, updateData, { new: true });
        invalidateCustomerMenuCache();

        // Also update recipe if provided?
        // User often hits specific /api/recipes endpoint, but let's support it here too if needed.

        if (!item) return res.status(404).json({ error: 'Not found' });

        await logActivity({ req, action: 'UPDATE_MENU', module: 'MENU', description: `Updated menu: ${item.name}`, metadata: { menuId: item.id, changes: req.body } });

        res.json(item);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteMenu = async (req, res) => {
    try {
        await MenuItem.deleteOne({ id: req.params.id });
        await Recipe.deleteOne({ menuId: req.params.id }); // Logic for cascading delete
        invalidateCustomerMenuCache();

        await logActivity({ req, action: 'DELETE_MENU', module: 'MENU', description: `Deleted menu ID: ${req.params.id}`, metadata: { menuId: req.params.id } });

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Recipe Specific Endpoints
const getRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find();
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const updateRecipe = async (req, res) => {
    try {
        const { ingredients, menuId: bodyMenuId } = req.body;
        // Fix: Use params.menuId if available (PUT /:menuId), otherwise use body.menuId (POST /)
        const targetMenuId = req.params.menuId || bodyMenuId;

        if (!targetMenuId) {
            return res.status(400).json({ error: 'Menu ID is required' });
        }

        const item = await Recipe.findOneAndUpdate(
            { menuId: targetMenuId },
            { ingredients },
            { upsert: true, new: true }
        );

        await logActivity({ req, action: 'UPDATE_RECIPE', module: 'MENU', description: `Updated recipe for menu ID: ${targetMenuId}`, metadata: { menuId: targetMenuId } });

        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const reorderMenus = async (req, res) => {
    try {
        const { items } = req.body; // Expects array of IDs in new order
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Invalid data' });
        }

        const bulkOps = items.map((id, index) => ({
            updateOne: {
                filter: { id: id },
                update: { order: index }
            }
        }));

        await MenuItem.bulkWrite(bulkOps);
        invalidateCustomerMenuCache();

        await logActivity({ req, action: 'REORDER_MENU', module: 'MENU', description: 'Reordered menu items' });

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
  getMenus,
  getMenusCustomer,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
  getRecipes,
  updateRecipe,
  reorderMenus
};
