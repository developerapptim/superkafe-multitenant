import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Reorder, motion, AnimatePresence, useDragControls } from "framer-motion";
import CustomSelect from '../../components/CustomSelect';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import api, { menuAPI, categoriesAPI } from '../../services/api';

// Fetcher
// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

// Animation Variants
const containerVars = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVars = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const MenuItem = ({ item, saveOrder, getCategoryEmoji, getCategoryName, formatCurrency, handleToggleStatus, openEditModal, handleDelete }) => {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={item}
            variants={itemVars}
            initial="hidden"
            animate="show"
            exit="hidden"
            layoutId={item.id}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={saveOrder}
            className="p-3 md:p-4 bg-white/5 border border-white/5 rounded-xl hover:border-purple-500/30 transition-colors relative group"
        >
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                {/* Top Section: Drag + Image + Info */}
                <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                    {/* Drag Handle */}
                    <div
                        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-white pt-2 md:pt-0 touch-none p-2"
                        onPointerDown={(e) => dragControls.start(e)}
                        title="Geser untuk mengurutkan"
                    >
                        ⋮⋮
                    </div>

                    {/* Image */}
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-surface/50 overflow-hidden flex-shrink-0 select-none pointer-events-none">
                        {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                                {getCategoryEmoji(item.category)}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 select-none">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold truncate text-base md:text-lg text-white">
                                {item.name}
                            </h4>
                            <div className="flex gap-1">
                                {item.label === 'best-seller' && <span title="Best Seller" className="text-sm">🔥</span>}
                                {item.label === 'signature' && <span title="Signature" className="text-sm">⭐</span>}
                                {item.label === 'new' && <span title="New" className="text-sm">🆕</span>}
                            </div>
                            {!item.is_active && (
                                <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full border border-red-500/20 whitespace-nowrap">Nonaktif</span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm mt-1">
                            <span className="text-gray-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                {getCategoryEmoji(item.category)} {getCategoryName(item.category)}
                            </span>
                            <span className="text-green-400 font-bold font-mono text-sm md:text-base">{formatCurrency(item.price)}</span>
                        </div>
                        {/* Stock Indicator */}
                        <div className="mt-1">
                            {!item.use_stock_check ? (
                                <span className="text-[10px] text-blue-400 flex items-center gap-1">
                                    📦 Stok: Unlimited
                                </span>
                            ) : (
                                <span className={`text-[10px] flex items-center gap-1 ${item.available_qty < 5 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                    📦 Stok: {item.available_qty}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="flex items-center justify-end gap-2 w-full md:w-auto pt-2 md:pt-0 border-t border-white/5 md:border-none">
                    {/* STATUS TOGGLE */}
                    <button
                        onClick={() => handleToggleStatus(item)}
                        className={`flex-1 md:flex-none py-1.5 md:py-2 px-3 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${item.is_active
                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
                        title={item.is_active ? "Nonaktifkan" : "Aktifkan"}
                    >
                        {item.is_active ? (
                            <><span>⚡</span> <span className="md:hidden">Aktif</span></>
                        ) : (
                            <><span>⛔</span> <span className="md:hidden">Off</span></>
                        )}
                    </button>

                    <button
                        onClick={() => openEditModal(item)}
                        className="flex-1 md:flex-none py-1.5 md:py-2 px-3 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
                        title="Edit"
                    >
                        <span>✏️</span> <span className="md:hidden text-sm">Edit</span>
                    </button>
                    <button
                        onClick={() => handleDelete(item)}
                        className="flex-1 md:flex-none py-1.5 md:py-2 px-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                        title="Hapus"
                    >
                        <span>🗑️</span> <span className="md:hidden text-sm">Hapus</span>
                    </button>
                </div>
            </div>
        </Reorder.Item>
    );
};

function MenuManagement() {
    // SWR Data Fetching
    const { data: menuData, error: menuError } = useSWR('/menu', fetcher);
    const { data: categoriesData, error: categoriesError } = useSWR('/categories', fetcher);

    // Derived State
    const menuItems = useMemo(() => Array.isArray(menuData) ? menuData : [], [menuData]);
    const categories = useMemo(() => Array.isArray(categoriesData) ? categoriesData : [], [categoriesData]);

    // Loading & Error States from SWR
    const loading = !menuData && !menuError;
    const error = menuError || categoriesError ? 'Gagal memuat data' : null;

    // Local UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Modal states
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null); // New state for editing category

    // Form states
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        price: '',
        category: '',
        description: '',
        image: '',
        label: 'none',
        is_active: true,
        use_stock_check: true
    });
    const [categoryForm, setCategoryForm] = useState({ name: '', emoji: '📦' });

    // Filter menu items
    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [menuItems, searchTerm, selectedCategory]);

    // Local state for Reorder (Sync with filteredItems)
    const [localItems, setLocalItems] = useState([]);

    useEffect(() => {
        setLocalItems(filteredItems);
    }, [filteredItems]);

    const handleReorder = async (newOrder) => {
        setLocalItems(newOrder); // Optimistic update

        // Only save if we are in 'all' category and no search, or handle relative reordering?
        // User wants to reorder "Menu appearing in Customer page".
        // Customer page usually shows ALL or by category. 
        // If we reorder in 'all', we save the global order.

        // Debounce or just save on drag end?
        // Reorder.Group onReorder triggers every frame? No, it triggers on swap.
        // We usually use onReorder to set state, then useEffect or plain callback?
        // Wait, Reorder.Group calls onReorder with new array. We must update state.
        // We should trigger API save separately or debounce it. 
        // Best practice: Update state immediately, trigger API in useEffect or custom handler?
        // Let's us onDragEnd on the Item? 'onDragEnd' is available on Reorder.Item?
        // Correction: Reorder.Group `onReorder` updates state. The actual "drop" event isn't strictly exposed as "onDrop".
        // Use a ref to track if order changed and save?
        // Or simpler: Save on every reorder? Too many requests.
        // Better: Update LOCAL state in onReorder.
        // AND add logic to save. Since framer-motion doesn't have "onDragEnd" for Group, we can put onDragEnd on the Item to trigger save of current `localItems`.
    };

    const saveOrder = async () => {
        // Prepare IDs
        const ids = localItems.map(i => i.id);
        if (ids.length === 0) return;

        try {
            await menuAPI.reorder(ids);
            toast.success('Urutan disimpan', { id: 'reorder-toast', duration: 2000 });
            // mutate('/menu'); // Optional, but local state is already ahead. localItems is authoritative for UI now.
            // Actually, we should probably silence the mutate or it might jump back if SWR revalidates.
        } catch (err) {
            toast.error('Gagal menyimpan urutan');
        }
    };

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value);
    };

    // Generate ID
    const generateId = () => `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Handle image upload
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Ukuran gambar maksimal 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    // Open add modal
    const openAddModal = () => {
        setEditingItem(null);
        setFormData({
            id: generateId(),
            name: '',
            price: '',
            category: categories.length > 0 ? categories[0].id : '',
            description: '',
            image: '',
            label: 'none',
            is_active: true,
            use_stock_check: true
        });
        setShowMenuModal(true);
    };

    // Open edit modal
    const openEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            id: item.id,
            name: item.name,
            price: item.price,
            category: item.category || '',
            description: item.description || '',
            image: item.image || '',
            label: item.label || 'none',
            is_active: item.is_active !== false,
            use_stock_check: item.use_stock_check !== false
        });
        setShowMenuModal(true);
    };

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.price) {
            toast.error('Nama dan harga wajib diisi');
            return;
        }

        const toastId = toast.loading('Menyimpan menu...');
        try {
            const dataToSend = {
                ...formData,
                price: Number(formData.price)
            };

            if (editingItem) {
                await menuAPI.update(formData.id, dataToSend);
            } else {
                await menuAPI.create(dataToSend);
            }

            mutate('/menu'); // Refresh menu cache
            setShowMenuModal(false);
            toast.success('Menu berhasil disimpan', { id: toastId });
        } catch (err) {
            console.error('Error saving menu:', err);
            toast.error('Gagal menyimpan menu', { id: toastId });
        }
    };

    // Toggle Status
    const handleToggleStatus = async (item) => {
        const newStatus = !item.is_active;
        try {
            await menuAPI.update(item.id, { is_active: newStatus });
            mutate('/menu');
            toast.success(`Menu ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
        } catch (err) {
            toast.error('Gagal mengubah status');
        }
    };

    // Toggle Stock Check
    const handleToggleStockCheck = async (item) => {
        const newMode = !item.use_stock_check;
        try {
            await menuAPI.update(item.id, { use_stock_check: newMode });
            mutate('/menu');
            toast.success(`Mode Stok: ${newMode ? 'Aktif' : 'Unlimited'}`);
        } catch (err) {
            toast.error('Gagal mengubah mode stok');
        }
    };

    // Handle delete
    const handleDelete = (item) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="font-medium">Hapus menu "{item.name}"?</p>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => confirmDeleteMenu(item.id, t.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500"
                    >
                        Hapus
                    </button>
                </div>
            </div>
        ), { duration: 5000, icon: '🗑️' });
    };

    const confirmDeleteMenu = async (id, toastId) => {
        toast.dismiss(toastId);
        const loadingToast = toast.loading('Menghapus menu...');
        try {
            await menuAPI.delete(id);
            mutate('/menu'); // Refresh menu cache
            toast.success('Menu berhasil dihapus', { id: loadingToast });
        } catch (err) {
            console.error('Error deleting menu:', err);
            toast.error('Gagal menghapus menu', { id: loadingToast });
        }
    };



    // Open Category Modal for Create
    const openCreateCategoryModal = () => {
        setEditingCategory(null);
        setCategoryForm({ name: '', emoji: '📦' });
        setShowCategoryModal(true);
    };

    // Open Category Modal for Edit
    const openEditCategoryModal = (cat) => {
        setEditingCategory(cat);
        setCategoryForm({ name: cat.name, emoji: cat.emoji || '📦' });
        setShowCategoryModal(true);
    };

    // Handle Delete Category
    const handleDeleteCategory = (cat) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="font-medium">Hapus kategori "{cat.name}"?</p>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => confirmDeleteCategory(cat.id, t.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500"
                    >
                        Hapus
                    </button>
                </div>
            </div>
        ), { duration: 5000, icon: '🗑️' });
    };

    const confirmDeleteCategory = async (id, toastId) => {
        toast.dismiss(toastId);
        const loadingToast = toast.loading('Menghapus kategori...');
        try {
            await categoriesAPI.delete(id);
            mutate('/categories'); // Refresh categories
            toast.success('Kategori berhasil dihapus', { id: loadingToast });
            if (selectedCategory === id) setSelectedCategory('all');
        } catch (err) {
            console.error('Error deleting category:', err);
            // Show specific error message from backend if available
            const errorMsg = err.response?.data?.error || 'Gagal menghapus kategori';
            toast.error(errorMsg, { id: loadingToast, duration: 4000 });
        }
    };
    const handleCategorySubmit = async (e) => {
        e.preventDefault();

        if (!categoryForm.name) {
            toast.error('Nama kategori wajib diisi');
            return;
        }

        const toastId = toast.loading('Menyimpan kategori...');
        try {
            if (editingCategory) {
                await categoriesAPI.update(editingCategory.id, {
                    name: categoryForm.name,
                    emoji: categoryForm.emoji
                });
            } else {
                await categoriesAPI.create({
                    id: `cat_${Date.now()}`,
                    name: categoryForm.name,
                    emoji: categoryForm.emoji
                });
            }
            mutate('/categories'); // Refresh categories cache
            setShowCategoryModal(false);
            setCategoryForm({ name: '', emoji: '📦' });
            setEditingCategory(null);
            toast.success('Kategori berhasil disimpan', { id: toastId });
        } catch (err) {
            console.error('Error saving category:', err);
            toast.error('Gagal menyimpan kategori', { id: toastId });
        }
    };

    // Get category emoji
    const getCategoryEmoji = (catId) => {
        const cat = categories.find(c => c.id === catId);
        return cat?.emoji || '📦';
    };

    const getCategoryName = (catId) => {
        const cat = categories.find(c => c.id === catId);
        return cat?.name || catId;
    };

    if (loading) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold hidden md:block">🍽️ Manajemen Menu</h2>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold hidden md:block">🍽️ Manajemen Menu</h2>
                <div className="glass rounded-xl p-6 text-center">
                    <p className="text-red-400">{error}</p>
                    <button onClick={() => mutate('/menu')} className="mt-4 px-4 py-2 bg-purple-500 rounded-lg hover:bg-purple-600">
                        Coba Lagi
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold hidden md:block">🍽️ Manajemen Menu</h2>
                <button
                    onClick={openAddModal}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                    <span>➕</span> Tambah Menu
                </button>
            </div>

            {/* Categories */}
            <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">📁 Kategori</h3>

                    <button
                        onClick={openCreateCategoryModal}
                        className="px-3 py-1 rounded-lg bg-purple-500/50 hover:bg-purple-500 text-xs font-medium flex items-center gap-1 transition-all"
                    >
                        <span>➕</span> Tambah
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`relative p-2 md:p-3 rounded-xl text-left border transition-all flex items-center justify-between group overflow-hidden ${selectedCategory === 'all'
                            ? 'border-purple-500 text-white'
                            : 'border-transparent hover:bg-white/10'
                            }`}
                    >
                        {selectedCategory === 'all' && (
                            <motion.div
                                layoutId="activeCat"
                                className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 -z-10"
                            />
                        )}
                        <div className="z-10 min-w-0">
                            <span className="font-bold block text-xs md:text-sm truncate">Semua</span>
                            <span className="text-[10px] text-gray-400 truncate">{menuItems.length} Menu</span>
                        </div>
                        <span className="text-sm md:text-lg opacity-50 group-hover:opacity-100 transition-opacity z-10 shrink-0">🍽️</span>
                    </button>
                    {categories.map(cat => {
                        const count = menuItems.filter(m => m.category === cat.id).length;
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <div
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`relative group p-2 md:p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer overflow-hidden ${isSelected
                                    ? 'border-purple-500 text-white'
                                    : 'border-white/5 hover:bg-white/10'
                                    }`}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="activeCat"
                                        className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 -z-10"
                                    />
                                )}
                                <div className="min-w-0 pr-1 flex-1">
                                    <span className="font-bold block truncate text-xs md:text-sm" title={cat.name}>{cat.name}</span>
                                    <span className="text-[10px] text-gray-400 truncate">{count} Menu</span>
                                </div>
                                <div className="flex gap-1 shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openEditCategoryModal(cat); }}
                                        className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/10 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 flex items-center justify-center transition-colors"
                                        title="Edit"
                                        style={{ display: 'flex' }}
                                    >
                                        <span className="text-[10px]">✏️</span>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                                        className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-white/10 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                                        title="Hapus"
                                        style={{ display: 'flex' }}
                                    >
                                        <span className="text-[10px]">✕</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Search */}
            <div className="glass rounded-xl overflow-hidden">
                <div className="p-4 border-b border-purple-500/20">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        placeholder="🔍 Cari menu..."
                    />
                </div>

                {/* Menu List */}
                {/* Menu List */}
                {/* Menu List */}
                <Reorder.Group
                    axis="y"
                    values={localItems}
                    onReorder={setLocalItems}
                    className="space-y-3"
                >
                    <AnimatePresence mode='popLayout'>
                        {localItems.length === 0 ? (
                            <motion.div
                                variants={itemVars}
                                className="p-8 text-center text-gray-400 bg-white/5 rounded-xl border border-dashed border-white/10"
                            >
                                <div className="text-4xl mb-2">📋</div>
                                <p>Tidak ada menu ditemukan</p>
                            </motion.div>
                        ) : (
                            localItems.map(item => (
                                <MenuItem
                                    key={item.id}
                                    item={item}
                                    saveOrder={saveOrder}
                                    getCategoryEmoji={getCategoryEmoji}
                                    getCategoryName={getCategoryName}
                                    formatCurrency={formatCurrency}
                                    handleToggleStatus={handleToggleStatus}
                                    openEditModal={openEditModal}
                                    handleDelete={handleDelete}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </Reorder.Group>
            </div>

            {/* Menu Modal */}
            {
                showMenuModal && createPortal(
                    <div className="modal-overlay">
                        <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold">
                                    {editingItem ? '✏️ Edit Menu' : '➕ Tambah Menu Baru'}
                                </h3>
                                <button
                                    onClick={() => setShowMenuModal(false)}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nama Menu *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                        placeholder="Contoh: Kopi Susu Gula Aren"
                                        required
                                    />
                                </div>

                                {/* Price & Category */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Harga *</label>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                            placeholder="15000"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                                        <CustomSelect
                                            value={formData.category}
                                            options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                                            onChange={(val) => setFormData({ ...formData, category: val })}
                                            placeholder="-- Pilih Kategori --"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Label</label>
                                        <CustomSelect
                                            value={formData.label}
                                            options={[
                                                { value: 'none', label: 'Tidak Ada' },
                                                { value: 'best-seller', label: '🔥 Best Seller' },
                                                { value: 'signature', label: '⭐ Signature' },
                                                { value: 'new', label: '🆕 Baru' }
                                            ]}
                                            onChange={(val) => setFormData({ ...formData, label: val })}
                                            placeholder="Pilih Label"
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Deskripsi</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                        rows={2}
                                        placeholder="Deskripsi menu..."
                                    />
                                </div>

                                {/* Image */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Gambar</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-lg bg-white/5 border border-purple-500/30 overflow-hidden flex items-center justify-center">
                                            {formData.image ? (
                                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">📷</span>
                                            )}
                                        </div>
                                        <label className="flex-1">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                            <div className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-center cursor-pointer transition-colors">
                                                📤 Upload Gambar
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Toggles */}
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4 rounded accent-purple-500"
                                        />
                                        <span className="text-sm">Aktif Dijual</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.use_stock_check}
                                            onChange={(e) => setFormData({ ...formData, use_stock_check: e.target.checked })}
                                            className="w-4 h-4 rounded accent-purple-500"
                                        />
                                        <span className="text-sm">Cek Stok Otomatis</span>
                                    </label>
                                </div>

                                {/* Submit */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowMenuModal(false)}
                                        className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold transition-all"
                                    >
                                        💾 Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    , document.body)
            }

            {/* Category Modal */}
            {
                showCategoryModal && createPortal(
                    <div className="modal-overlay">
                        <div className="glass rounded-2xl p-6 w-full max-w-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold">
                                    {editingCategory ? '✏️ Edit Kategori' : '➕ Tambah Kategori'}
                                </h3>
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleCategorySubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nama Kategori *</label>
                                    <input
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                        placeholder="Contoh: Makanan Berat"
                                        required
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCategoryModal(false)}
                                        className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold transition-all"
                                    >
                                        💾 Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    , document.body)
            }
        </section >
    );
}

export default MenuManagement;
