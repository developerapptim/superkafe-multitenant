import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import SmartText from '../../components/SmartText';
import CustomSelect from '../../components/CustomSelect';
import useSWR, { mutate } from 'swr';
import api, { menuAPI, inventoryAPI, recipesAPI } from '../../services/api';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

function Gramasi() {
    // Check if user is admin (has full access) or staf (limited view - no financial data)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const { data: settingsData } = useSWR('/settings', fetcher);

    // Determine edit permission
    const isAdmin = user.role === 'admin' || user.role === 'owner' || (user.role_access && user.role_access.includes('*'));
    const isStaff = user.role === 'staf' || user.role === 'kasir';
    const canEdit = isAdmin || (isStaff && settingsData?.allowStaffEditInventory);

    // SWR Data Fetching
    const { data: menuData } = useSWR('/menu', fetcher);
    const { data: ingredientsData } = useSWR('/inventory', fetcher);
    const { data: recipesData } = useSWR('/recipes', fetcher);

    // Derived State
    const menuItems = useMemo(() => Array.isArray(menuData) ? menuData : [], [menuData]);
    const ingredients = useMemo(() => Array.isArray(ingredientsData) ? ingredientsData : [], [ingredientsData]);
    const recipes = useMemo(() => Array.isArray(recipesData) ? recipesData : [], [recipesData]);

    const isLoading = !menuData && !ingredientsData && !recipesData;

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [selectedMenu, setSelectedMenu] = useState(null);
    const [recipeIngredients, setRecipeIngredients] = useState([]);



    // Calculate modal per unit for ingredient
    const getModalPerUnit = (ing) => {
        if (ing.use_konversi && ing.isi_prod > 0) {
            return ing.harga_beli / ing.isi_prod;
        }
        return ing.harga_beli || 0;
    };

    // Calculate HPP for a menu based on recipe
    const calculateHPP = (menuId, ingredientsList, recipesList) => {
        const recipe = recipesList.find(r => r.menuId === menuId);
        if (!recipe || !recipe.ingredients) return 0;

        let hpp = 0;
        recipe.ingredients.forEach(ri => {
            const ing = ingredientsList.find(i => i.id === ri.ing_id);
            if (ing) {
                const modalPerUnit = getModalPerUnit(ing);
                hpp += modalPerUnit * (ri.jumlah || 0);
            }
        });
        return hpp;
    };

    // Memoized Stats Calculation
    const stats = useMemo(() => {
        let totalHPP = 0;
        let totalSelling = 0;
        let menuWithRecipe = 0;
        let totalMargin = 0;

        menuItems.forEach(menu => {
            const recipe = recipes.find(r => r.menuId === menu.id);
            if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
                const hpp = calculateHPP(menu.id, ingredients, recipes);
                const sellingPrice = menu.price || 0;
                const profit = sellingPrice - hpp;
                const margin = sellingPrice > 0 ? ((profit / sellingPrice) * 100) : 0;

                totalHPP += hpp;
                totalSelling += sellingPrice;
                totalMargin += margin;
                menuWithRecipe++;
            }
        });

        return {
            totalHPP,
            totalSelling,
            totalProfit: totalSelling - totalHPP,
            avgMargin: menuWithRecipe > 0 ? (totalMargin / menuWithRecipe) : 0
        };
    }, [menuItems, ingredients, recipes]);

    // Get menu data with HPP calculation
    const getMenuWithHPP = () => {
        return menuItems.map(menu => {
            const recipe = recipes.find(r => r.menuId === menu.id);
            const hasRecipe = recipe && recipe.ingredients && recipe.ingredients.length > 0;
            const hpp = hasRecipe ? calculateHPP(menu.id, ingredients, recipes) : 0;
            const ppn = (menu.price || 0) * 0.11;
            const profit = (menu.price || 0) - hpp - ppn;
            const margin = menu.price > 0 ? ((profit / menu.price) * 100) : 0;

            return {
                ...menu,
                hasRecipe,
                recipeCount: recipe?.ingredients?.length || 0,
                hpp,
                ppn,
                profit,
                margin
            };
        }).filter(m => m.hasRecipe);
    };

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    // Open modal for adding/editing recipe
    const openRecipeModal = (menu) => {
        setSelectedMenu(menu);

        // Load existing recipe or start fresh
        const existingRecipe = recipes.find(r => r.menuId === menu.id);
        if (existingRecipe && existingRecipe.ingredients) {
            setRecipeIngredients([...existingRecipe.ingredients]);
        } else {
            setRecipeIngredients([]);
        }

        setShowModal(true);
    };

    // Add ingredient to recipe
    const addIngredientToRecipe = () => {
        setRecipeIngredients([...recipeIngredients, { ing_id: '', jumlah: 0 }]);
    };

    // Update ingredient in recipe
    const updateRecipeIngredient = (index, field, value) => {
        const updated = [...recipeIngredients];
        updated[index][field] = field === 'jumlah' ? Number(value) : value;
        setRecipeIngredients(updated);
    };

    // Remove ingredient from recipe
    const removeRecipeIngredient = (index) => {
        const updated = recipeIngredients.filter((_, i) => i !== index);
        setRecipeIngredients(updated);
    };

    // Save recipe
    const saveRecipe = async () => {
        if (!selectedMenu) return;

        // Filter out empty ingredients
        const validIngredients = recipeIngredients.filter(ri => ri.ing_id && ri.jumlah > 0);

        try {
            await recipesAPI.create({
                menuId: selectedMenu.id,
                ingredients: validIngredients
            });

            mutate('/recipes'); // Refresh recipes
            setShowModal(false);
        } catch (err) {
            console.error('Error saving recipe:', err);
            alert('Gagal menyimpan resep');
        }
    };

    // Delete recipe
    const deleteRecipe = async (menuId) => {
        if (!confirm('Hapus resep untuk menu ini?')) return;

        try {
            await recipesAPI.delete(menuId);
            mutate('/recipes');
        } catch (err) {
            console.error('Error deleting recipe:', err);
            alert('Gagal menghapus resep');
        }
    };

    // Calculate current recipe HPP in modal
    const getCurrentRecipeHPP = () => {
        let total = 0;
        recipeIngredients.forEach(ri => {
            const ing = ingredients.find(i => i.id === ri.ing_id);
            if (ing) {
                const modalPerUnit = getModalPerUnit(ing);
                total += modalPerUnit * (ri.jumlah || 0);
            }
        });
        return total;
    };

    // Get ingredient name by id
    const getIngredientName = (ingId) => {
        const ing = ingredients.find(i => i.id === ingId);
        return ing?.nama || 'Unknown';
    };

    // Get ingredient unit
    const getIngredientUnit = (ingId) => {
        const ing = ingredients.find(i => i.id === ingId);
        return ing?.satuan_prod || ing?.satuan || 'unit';
    };

    if (isLoading) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold hidden md:block">⚖️ Gramasi & HPP</h2>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    const menuWithHPP = getMenuWithHPP();
    const menuWithoutRecipe = menuItems.filter(m => !recipes.find(r => r.menuId === m.id));

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold hidden md:block">⚖️ Gramasi & HPP</h2>
                {canEdit && (
                    <button
                        onClick={() => {
                            if (menuWithoutRecipe.length > 0) {
                                openRecipeModal(menuWithoutRecipe[0]);
                            } else {
                                alert('Semua menu sudah memiliki resep');
                            }
                        }}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                    >
                        <span>➕</span> Tambah Gramasi
                    </button>
                )}
            </div>

            {/* Stats - Hide financial cards for Staf */}
            {isAdmin && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="glass rounded-xl p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-gray-400">Total HPP</p>
                        <SmartText className="text-sm md:text-xl font-bold text-red-400">{formatCurrency(stats.totalHPP)}</SmartText>
                    </div>
                    <div className="glass rounded-xl p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-gray-400">Total Harga Jual</p>
                        <SmartText className="text-sm md:text-xl font-bold text-green-400">{formatCurrency(stats.totalSelling)}</SmartText>
                    </div>
                    <div className="glass rounded-xl p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-gray-400">Total Keuntungan</p>
                        <SmartText className="text-sm md:text-xl font-bold text-purple-400">{formatCurrency(stats.totalProfit)}</SmartText>
                    </div>
                    <div className="glass rounded-xl p-3 md:p-4">
                        <p className="text-[10px] md:text-xs text-gray-400">Avg Margin</p>
                        <SmartText className="text-sm md:text-xl font-bold text-blue-400">{stats.avgMargin.toFixed(1)}%</SmartText>
                    </div>
                </div>
            )}

            {/* Gramasi Table */}
            <div className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-4 py-3 text-left">Nama Produk</th>
                                {isAdmin && (
                                    <>
                                        <th className="px-4 py-3 text-right">Total HPP</th>
                                        <th className="px-4 py-3 text-right">Harga Jual</th>
                                        <th className="px-4 py-3 text-right">PPN (11%)</th>
                                        <th className="px-4 py-3 text-right">Net Profit</th>
                                        <th className="px-4 py-3 text-right">Margin %</th>
                                    </>
                                )}
                                <th className="px-4 py-3 text-right">Jumlah Bahan</th>
                                {isAdmin && <th className="px-4 py-3 text-center">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-500/10">
                            {menuWithHPP.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 3} className="px-4 py-8 text-center text-gray-400">
                                        <div className="text-4xl mb-2">📋</div>
                                        <p>Belum ada resep gramasi</p>
                                        <p className="text-sm mt-1">Klik "Tambah Gramasi" untuk membuat resep bahan baku per menu</p>
                                    </td>
                                </tr>
                            ) : (
                                menuWithHPP.map(menu => (
                                    <tr key={menu.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{menu.name}</div>
                                            <div className="text-xs text-gray-400">{menu.recipeCount} bahan</div>
                                        </td>
                                        {isAdmin && (
                                            <>
                                                <td className="px-4 py-3 text-right text-red-400">{formatCurrency(menu.hpp)}</td>
                                                <td className="px-4 py-3 text-right">{formatCurrency(menu.price)}</td>
                                                <td className="px-4 py-3 text-right text-yellow-400">{formatCurrency(menu.ppn)}</td>
                                                <td className={`px-4 py-3 text-right font-bold ${menu.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatCurrency(menu.profit)}
                                                </td>
                                                <td className={`px-4 py-3 text-right ${menu.margin >= 30 ? 'text-green-400' : menu.margin >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {menu.margin.toFixed(1)}%
                                                </td>
                                            </>
                                        )}
                                        <td className="px-4 py-3 text-right text-gray-400">{menu.recipeCount}</td>
                                        {canEdit && (
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => openRecipeModal(menu)}
                                                        className="p-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                                        title="Edit Resep"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => deleteRecipe(menu.id)}
                                                        className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                        title="Hapus Resep"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Menu without recipe */}
            {menuWithoutRecipe.length > 0 && (
                <div className="glass rounded-xl p-4">
                    <h3 className="font-bold mb-3">📋 Menu Belum Ada Resep ({menuWithoutRecipe.length})</h3>
                    <div className="flex flex-wrap gap-2">
                        {menuWithoutRecipe.slice(0, 10).map(menu => (
                            <button
                                key={menu.id}
                                onClick={() => openRecipeModal(menu)}
                                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm flex items-center gap-2"
                            >
                                <span>➕</span> {menu.name}
                            </button>
                        ))}
                        {menuWithoutRecipe.length > 10 && (
                            <span className="px-3 py-2 text-sm text-gray-400">
                                +{menuWithoutRecipe.length - 10} lainnya
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Recipe Modal */}
            {showModal && selectedMenu && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div className="w-full mr-8">
                                <h3 className="text-xl font-bold mb-2">⚖️ Atur Resep Gramasi</h3>
                                <CustomSelect
                                    value={selectedMenu.id}
                                    options={menuItems.map(menu => ({
                                        value: menu.id,
                                        label: `${menu.name} - ${formatCurrency(menu.price)}`
                                    }))}
                                    onChange={(val) => {
                                        const menu = menuItems.find(m => m.id === val);
                                        if (menu) {
                                            setSelectedMenu(menu);
                                            // Load recipe for new menu
                                            const existingRecipe = recipes.find(r => r.menuId === menu.id);
                                            setRecipeIngredients(existingRecipe && existingRecipe.ingredients ? [...existingRecipe.ingredients] : []);
                                        }
                                    }}
                                    placeholder="Pilih Menu..."
                                />
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400 flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Ingredient list */}
                            <div className="space-y-3">
                                {recipeIngredients.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <div className="text-3xl mb-2">📦</div>
                                        <p>Belum ada bahan. Klik "Tambah Bahan" untuk mulai.</p>
                                    </div>
                                ) : (
                                    recipeIngredients.map((ri, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                            <div className="flex-1">
                                                <CustomSelect
                                                    value={ri.ing_id}
                                                    options={ingredients.map(ing => ({
                                                        value: ing.id,
                                                        label: `${ing.nama} (${formatCurrency(getModalPerUnit(ing))}/${ing.satuan_prod || ing.satuan || 'unit'})`
                                                    }))}
                                                    onChange={(val) => updateRecipeIngredient(index, 'ing_id', val)}
                                                    placeholder="Pilih Bahan --"
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                value={ri.jumlah}
                                                onChange={(e) => updateRecipeIngredient(index, 'jumlah', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                className="w-24 px-3 py-2 rounded-lg bg-white/10 border border-purple-500/30 text-white text-right"
                                                placeholder="Jumlah"
                                            />
                                            <span className="text-sm text-gray-400 w-16">
                                                {ri.ing_id ? getIngredientUnit(ri.ing_id) : 'unit'}
                                            </span>
                                            <button
                                                onClick={() => removeRecipeIngredient(index)}
                                                className="p-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={addIngredientToRecipe}
                                className="w-full py-2 rounded-lg border border-dashed border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                            >
                                ➕ Tambah Bahan
                            </button>

                            {/* HPP Preview - Only show for Admin */}
                            {isAdmin && (
                                <div className="p-4 bg-white/5 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400">Total HPP:</span>
                                        <span className="text-xl font-bold text-red-400">{formatCurrency(getCurrentRecipeHPP())}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-gray-400">Harga Jual:</span>
                                        <span className="text-xl font-bold text-green-400">{formatCurrency(selectedMenu.price)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                                        <span className="text-gray-400">Margin:</span>
                                        <span className={`text-xl font-bold ${selectedMenu.price - getCurrentRecipeHPP() >= 0 ? 'text-purple-400' : 'text-red-400'
                                            }`}>
                                            {formatCurrency(selectedMenu.price - getCurrentRecipeHPP())}
                                            {selectedMenu.price > 0 && (
                                                <span className="text-sm ml-2">
                                                    ({(((selectedMenu.price - getCurrentRecipeHPP()) / selectedMenu.price) * 100).toFixed(1)}%)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={saveRecipe}
                                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold"
                                >
                                    💾 Simpan Resep
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}
        </section>
    );
}

export default Gramasi;
