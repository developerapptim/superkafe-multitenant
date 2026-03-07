/**
 * OrderService.js
 * Extracted business logic from OrderController.js (Sprint 2 Refactor)
 * 
 * Responsibilities:
 * - HPP (Harga Pokok Penjualan) calculation
 * - Stock deduction (atomic bulkWrite)
 * - Stock reversion (atomic bulkWrite)
 */
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const StockHistory = require('../models/StockHistory');
const Voucher = require('../models/Voucher');

/**
 * Calculate HPP for order items.
 * Returns enriched items with hpp_locked field and total HPP.
 */
async function calculateHPP(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return { enrichedItems: [], orderTotalHPP: 0 };
    }

    const itemIds = items.map(item => String(item.id));
    const recipes = await Recipe.find({ menuId: { $in: itemIds } });

    const ingredientIds = [...new Set(recipes.flatMap(r => r.ingredients.map(i => String(i.ing_id))))];
    const ingredients = await Ingredient.find({ id: { $in: ingredientIds } });

    const ingredientMap = new Map();
    ingredients.forEach(i => ingredientMap.set(String(i.id), i));

    const recipeMap = new Map();
    recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

    let orderTotalHPP = 0;
    const enrichedItems = [];

    for (const item of items) {
        const menuId = String(item.id);
        const recipeIngredients = recipeMap.get(menuId);
        let itemHPP = 0;

        if (recipeIngredients) {
            for (const ri of recipeIngredients) {
                const ingKey = String(ri.ing_id);
                const ingData = ingredientMap.get(ingKey);
                const required = Number(ri.jumlah) || 0;

                if (ingData) {
                    const costPerUnit = (ingData.isi_prod && ingData.isi_prod > 0)
                        ? (ingData.harga_beli / ingData.isi_prod)
                        : ingData.harga_beli;
                    const validCost = isNaN(costPerUnit) ? 0 : costPerUnit;
                    itemHPP += (validCost * required);
                }
            }
        }

        const qtyOrdered = Number(item.qty || item.count) || 0;
        orderTotalHPP += (itemHPP * qtyOrdered);

        enrichedItems.push({
            ...item,
            hpp_locked: itemHPP
        });
    }

    return { enrichedItems, orderTotalHPP };
}

/**
 * Deduct stock for an order when status changes to 'process'.
 * Uses atomic bulkWrite with $inc — safe against concurrent requests.
 */
async function deductStock(order) {
    console.log(`📉 [DEDUCT] Starting stock deduction for Order: ${order.id}`);

    const itemIds = order.items ? order.items.map(item => String(item.id)) : [];
    if (itemIds.length === 0) return;

    let allMenuItems = await MenuItem.find({ id: { $in: itemIds } });

    // Collect all menu IDs that need recipe checks (direct items + bundle components)
    const menuIdsToCheck = [...itemIds];
    const additionalMenuIdsToFetch = [];

    allMenuItems.forEach(mi => {
        if (mi.is_bundle && mi.bundle_items) {
            mi.bundle_items.forEach(bi => {
                if (bi.product_id) {
                    menuIdsToCheck.push(String(bi.product_id));
                    additionalMenuIdsToFetch.push(String(bi.product_id));
                }
            });
        }
    });

    if (additionalMenuIdsToFetch.length > 0) {
        const componentMenus = await MenuItem.find({ id: { $in: additionalMenuIdsToFetch } });
        allMenuItems = [...allMenuItems, ...componentMenus];
    }

    const recipes = await Recipe.find({ menuId: { $in: menuIdsToCheck } });

    const ingredientIds = [...new Set(recipes.flatMap(r => r.ingredients.map(i => String(i.ing_id))))];
    const ingredients = await Ingredient.find({ id: { $in: ingredientIds } });

    const ingredientMap = new Map();
    ingredients.forEach(i => ingredientMap.set(String(i.id), i));

    const recipeMap = new Map();
    recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

    const menuItemMap = new Map();
    allMenuItems.forEach(m => {
        menuItemMap.set(String(m.id), m);
        menuItemMap.set(String(m._id), m);
    });

    // Collect all deductions into a map: ingId -> { totalDeduct, ingData, notes[] }
    const deductionMap = new Map();

    const collectDeduction = (menuId, qtyOrdered, itemName, isFromBundle = false) => {
        const recipeIngredients = recipeMap.get(menuId);
        if (!recipeIngredients) return;

        for (const ri of recipeIngredients) {
            const ingKey = String(ri.ing_id);
            const ingData = ingredientMap.get(ingKey);
            const required = Number(ri.jumlah) || 0;

            if (ingData && (ingData.type === 'physical' || !ingData.type)) {
                const qtyToDeduct = required * qtyOrdered;
                if (!isNaN(qtyToDeduct) && qtyToDeduct > 0) {
                    const label = isFromBundle ? '(Bundle Component)' : '';
                    if (deductionMap.has(ingKey)) {
                        const entry = deductionMap.get(ingKey);
                        entry.totalDeduct += qtyToDeduct;
                        entry.notes.push(`${itemName} ${label}`);
                    } else {
                        deductionMap.set(ingKey, {
                            totalDeduct: qtyToDeduct,
                            ingData,
                            notes: [`${itemName} ${label}`]
                        });
                    }
                }
            }
        }
    };

    if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
            const menuId = String(item.id);
            const qtyOrdered = Number(item.qty || item.count) || 0;
            const menuItem = menuItemMap.get(menuId);

            if (menuItem && menuItem.is_bundle && menuItem.bundle_items && menuItem.bundle_items.length > 0) {
                console.log(`   🎁 Bundle detected: ${item.name}, collecting component stock deductions...`);
                for (const bundleComponent of menuItem.bundle_items) {
                    const componentId = String(bundleComponent.product_id);
                    const componentMenu = menuItemMap.get(componentId);
                    const componentMenuId = componentMenu ? String(componentMenu.id) : componentId;
                    const componentQty = (bundleComponent.quantity || 1) * qtyOrdered;
                    const componentName = componentMenu ? componentMenu.name : `Component ${componentId}`;
                    collectDeduction(componentMenuId, componentQty, componentName, true);
                }
            } else {
                collectDeduction(menuId, qtyOrdered, item.name);
            }
        }
    }

    // Execute all stock deductions atomically via bulkWrite with $inc
    if (deductionMap.size > 0) {
        const bulkOps = [];
        const historyDocs = [];
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });

        for (const [ingKey, entry] of deductionMap) {
            const oldStock = Number(entry.ingData.stok) || 0;
            const newStock = oldStock - entry.totalDeduct;

            bulkOps.push({
                updateOne: {
                    filter: { id: ingKey, tenantId: entry.ingData.tenantId },
                    update: { $inc: { stok: -entry.totalDeduct } }
                }
            });

            historyDocs.push({
                id: `hist_out_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                ing_id: entry.ingData.id,
                ingName: entry.ingData.nama,
                tenantId: entry.ingData.tenantId,
                type: 'out',
                qty: entry.totalDeduct,
                stokSebelum: oldStock,
                stokSesudah: newStock,
                note: `Order ${order.id} (Process) - ${entry.notes.join(', ')}`,
                date: dateStr,
                time: timeStr
            });

            console.log(`   📦 ${entry.ingData.nama}: ${oldStock} → ${newStock} (-${entry.totalDeduct})`);
        }

        await Ingredient.bulkWrite(bulkOps);
        if (historyDocs.length > 0) {
            await StockHistory.insertMany(historyDocs);
        }
    }

    console.log(`✅ [DEDUCT] Stock deduction complete for Order: ${order.id}`);
}

/**
 * Revert stock for an order when it is cancelled after processing.
 * Uses atomic bulkWrite with $inc — safe against concurrent requests.
 */
async function revertStock(order) {
    console.log(`📈 [REVERT] Starting stock reversion for Order: ${order.id}`);

    const itemIds = order.items ? order.items.map(item => String(item.id)) : [];
    if (itemIds.length === 0) return;

    const recipes = await Recipe.find({ menuId: { $in: itemIds } });

    const ingredientIds = [...new Set(recipes.flatMap(r => r.ingredients.map(i => String(i.ing_id))))];
    const ingredients = await Ingredient.find({ id: { $in: ingredientIds } });

    const ingredientMap = new Map();
    ingredients.forEach(i => ingredientMap.set(String(i.id), i));

    const recipeMap = new Map();
    recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

    const reversionMap = new Map();

    if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
            const menuId = String(item.id);
            const recipeIngredients = recipeMap.get(menuId);

            if (recipeIngredients) {
                for (const ri of recipeIngredients) {
                    const ingKey = String(ri.ing_id);
                    const ingData = ingredientMap.get(ingKey);
                    const required = Number(ri.jumlah) || 0;
                    const qtyOrdered = Number(item.qty || item.count) || 0;

                    if (ingData && (ingData.type === 'physical' || !ingData.type)) {
                        const qtyToRevert = required * qtyOrdered;
                        if (!isNaN(qtyToRevert) && qtyToRevert > 0) {
                            if (reversionMap.has(ingKey)) {
                                const entry = reversionMap.get(ingKey);
                                entry.totalRevert += qtyToRevert;
                                entry.notes.push(item.name);
                            } else {
                                reversionMap.set(ingKey, {
                                    totalRevert: qtyToRevert,
                                    ingData,
                                    notes: [item.name]
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if (reversionMap.size > 0) {
        const bulkOps = [];
        const historyDocs = [];
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });

        for (const [ingKey, entry] of reversionMap) {
            const oldStock = Number(entry.ingData.stok) || 0;
            const newStock = oldStock + entry.totalRevert;

            bulkOps.push({
                updateOne: {
                    filter: { id: ingKey, tenantId: entry.ingData.tenantId },
                    update: { $inc: { stok: entry.totalRevert } }
                }
            });

            historyDocs.push({
                id: `hist_in_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                ing_id: entry.ingData.id,
                ingName: entry.ingData.nama,
                tenantId: entry.ingData.tenantId,
                type: 'in',
                qty: entry.totalRevert,
                stokSebelum: oldStock,
                stokSesudah: newStock,
                note: `Order ${order.id} (Cancelled) - ${entry.notes.join(', ')} REVERTED`,
                date: dateStr,
                time: timeStr
            });

            console.log(`   📦 ${entry.ingData.nama}: ${oldStock} → ${newStock} (+${entry.totalRevert})`);
        }

        await Ingredient.bulkWrite(bulkOps);
        if (historyDocs.length > 0) {
            await StockHistory.insertMany(historyDocs);
        }
    }

    console.log(`✅ [REVERT] Stock reversion complete for Order: ${order.id}`);
}

/**
 * Apply voucher with atomic quota guard.
 * Returns the updated voucher or null if invalid/exceeded.
 */
async function applyVoucher(voucherCode) {
    if (!voucherCode) return null;

    try {
        const voucherResult = await Voucher.findOneAndUpdate(
            {
                code: voucherCode.toUpperCase(),
                is_active: true,
                valid_until: { $gte: new Date() },
                $or: [
                    { quota: 0 },
                    { $expr: { $lt: ['$used_count', '$quota'] } }
                ]
            },
            { $inc: { used_count: 1 } },
            { new: true }
        );

        if (voucherResult) {
            console.log(`🎫 Voucher ${voucherCode} used_count incremented (${voucherResult.used_count}/${voucherResult.quota || '∞'})`);
        } else {
            console.log(`⚠️ Voucher ${voucherCode} not valid or quota exceeded`);
        }

        return voucherResult;
    } catch (err) {
        console.error('⚠️ Voucher update error (non-blocking):', err);
        return null;
    }
}

module.exports = {
    calculateHPP,
    deductStock,
    revertStock,
    applyVoucher
};
