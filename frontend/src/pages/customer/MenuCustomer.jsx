import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { menuAPI, categoriesAPI, bannerAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';

function MenuCustomer() {
    const { tableId } = useOutletContext();
    const { cart, addToCart, updateQty } = useCart();

    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [banners, setBanners] = useState([]);
    const [activeBanner, setActiveBanner] = useState(0);
    const [activeCategory, setActiveCategory] = useState('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [menuRes, catRes, bannerRes] = await Promise.all([
                menuAPI.getAll(),
                categoriesAPI.getAll(),
                bannerAPI.getAll(true)
            ]);

            const menuData = Array.isArray(menuRes.data) ? menuRes.data : [];
            const catData = Array.isArray(catRes.data) ? catRes.data : [];
            const bannerData = Array.isArray(bannerRes.data) ? bannerRes.data : [];

            const sortedMenu = menuData.sort((a, b) => {
                if (a.status === 'NON_ACTIVE' && b.status !== 'NON_ACTIVE') return 1;
                if (a.status !== 'NON_ACTIVE' && b.status === 'NON_ACTIVE') return -1;
                return 0;
            });
            setMenuItems(sortedMenu);
            setCategories(catData);
            setBanners(bannerData);
        } catch (err) {
            console.error('Error fetching menu:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    // Filter menu items
    const filteredItems = menuItems.filter(item => {
        if (activeCategory === 'all') return true;

        const selectedCat = categories.find(c => c.id === activeCategory);
        if (!selectedCat) return false;

        // Check if item matches Category ID or Category Name (Legacy)
        const itemCat = item.category ? String(item.category) : '';
        const matchId = itemCat === selectedCat.id || item.categoryId === selectedCat.id;
        const matchName = itemCat.toLowerCase() === selectedCat.name.toLowerCase();

        const matchCategory = matchId || matchName;

        const matchSearch = !search ||
            item.name?.toLowerCase().includes(search.toLowerCase());
        return matchCategory && matchSearch;
    });

    // Get cart quantity for an item
    const getCartQty = (itemId) => {
        const cartItem = cart.find(i => i.id === itemId);
        return cartItem ? cartItem.qty : 0;
    };

    const handleAddToCart = (item) => {
        addToCart({
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image
        });
    };

    // Auto-rotate banner
    useEffect(() => {
        if (banners.length <= 1) return;
        const timer = setInterval(() => {
            setActiveBanner(prev => (prev + 1) % banners.length);
        }, 4000);
        return () => clearInterval(timer);
    }, [banners.length]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="py-4 space-y-4">
            {/* Banner Slider */}
            {banners.length > 0 && (
                <div className="relative rounded-xl overflow-hidden border border-purple-500/20 h-36 md:h-48">
                    <AnimatePresence mode="wait">
                        <motion.img
                            key={activeBanner}
                            src={banners[activeBanner]?.image_url}
                            alt={banners[activeBanner]?.title || 'Banner Promo'}
                            className="w-full h-full object-cover"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.3 }}
                        />
                    </AnimatePresence>
                    {banners.length > 1 && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {banners.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveBanner(i)}
                                    className={`w-2 h-2 rounded-full transition-all ${i === activeBanner ? 'bg-white w-5' : 'bg-white/40'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-xl bg-white/5 border border-purple-500/30 text-white placeholder-gray-400"
                    placeholder="Cari menu..."
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide scroll-smooth">
                <button
                    onClick={() => setActiveCategory('all')}
                    className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all overflow-hidden flex-shrink-0 ${activeCategory === 'all'
                        ? 'text-white'
                        : 'bg-white/10 text-gray-300'
                        }`}
                >
                    {activeCategory === 'all' && (
                        <motion.div
                            layoutId="activeTabCustomer"
                            className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 -z-10"
                        />
                    )}
                    <span className="relative z-10">🍽️ Semua</span>
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id || cat.name}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all overflow-hidden flex-shrink-0 ${activeCategory === cat.id
                            ? 'text-white'
                            : 'bg-white/10 text-gray-300'
                            }`}
                    >
                        {activeCategory === cat.id && (
                            <motion.div
                                layoutId="activeTabCustomer"
                                className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 -z-10"
                            />
                        )}
                        <span className="relative z-10">{cat.icon || '📦'} {cat.name}</span>
                    </button>
                ))}
            </div>

            {/* Menu Grid */}
            {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="text-gray-400">Tidak ada menu ditemukan</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                    <AnimatePresence mode='popLayout'>
                        {filteredItems.map(item => {
                            const cartQty = getCartQty(item.id);
                            const isSoldOut = item.status === 'SOLD_OUT';
                            const isNonActive = item.status === 'NON_ACTIVE';
                            const isDisabled = isSoldOut || isNonActive;

                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                    className={`bg-white/5 rounded-xl overflow-hidden border border-purple-500/20 transition-all hover:border-purple-500/50 ${isNonActive ? 'opacity-50' : ''}`}
                                >
                                    {/* Image */}
                                    <div className={`aspect-square bg-gradient-to-br from-purple-900/50 to-blue-900/50 relative ${isSoldOut ? 'grayscale' : ''}`}>
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-4xl">
                                                ☕
                                            </div>
                                        )}

                                        {/* Status / Label Badges */}
                                        {!isSoldOut && !isNonActive && item.label && item.label !== 'none' && (
                                            <div className={`absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg ${item.label === 'best-seller' ? 'bg-red-600 text-white' :
                                                item.label === 'signature' ? 'bg-amber-500 text-white' :
                                                    item.label === 'new' ? 'bg-green-600 text-white' : ''
                                                }`}>
                                                {item.label === 'best-seller' ? 'BEST SELLER' :
                                                    item.label === 'signature' ? 'SIGNATURE' :
                                                        item.label === 'new' ? 'NEW' : ''}
                                            </div>
                                        )}
                                        {/* Discount Percentage Badge */}
                                        {!!item.base_price && item.base_price > item.price && !isSoldOut && !isNonActive && (
                                            <div className="absolute top-2 right-2 px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold shadow-lg">
                                                -{Math.round((1 - item.price / item.base_price) * 100)}%
                                            </div>
                                        )}
                                        {/* Bundle badge */}
                                        {item.is_bundle && !isSoldOut && !isNonActive && (
                                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-bold">
                                                📦 BUNDLING
                                            </div>
                                        )}
                                        {isSoldOut && (
                                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                <span className="text-red-400 font-bold">HABIS</span>
                                            </div>
                                        )}
                                        {isNonActive && (
                                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                                <span className="text-gray-400 font-bold text-center px-2">TIDAK TERSEDIA</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="p-3">
                                        <h3 className="font-medium text-sm truncate">{item.name}</h3>
                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                            {item.base_price && item.base_price > item.price ? (
                                                <>
                                                    <span className="text-gray-400 line-through text-xs">{formatCurrency(item.base_price)}</span>
                                                    <span className="text-green-400 font-bold text-sm">{formatCurrency(item.price)}</span>
                                                </>
                                            ) : (
                                                <span className="text-purple-400 font-bold">{formatCurrency(item.price)}</span>
                                            )}
                                        </div>

                                        {/* Add to Cart */}
                                        {isDisabled ? (
                                            <div className="w-full mt-2 py-2 rounded-lg bg-gray-600/50 text-center text-sm text-gray-400 cursor-not-allowed">
                                                {isSoldOut ? 'HABIS' : 'TIDAK TERSEDIA'}
                                            </div>
                                        ) : cartQty === 0 ? (
                                            <motion.button
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleAddToCart(item)}
                                                className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-medium"
                                            >
                                                + Tambah
                                            </motion.button>
                                        ) : (
                                            <div className="flex items-center justify-between mt-2 bg-white/10 rounded-lg">
                                                <button
                                                    onClick={() => updateQty(item.id, cartQty - 1)}
                                                    className="w-10 h-10 flex items-center justify-center text-lg font-bold text-red-400"
                                                >
                                                    -
                                                </button>
                                                <span className="font-bold">{cartQty}</span>
                                                <button
                                                    onClick={() => updateQty(item.id, cartQty + 1)}
                                                    className="w-10 h-10 flex items-center justify-center text-lg font-bold text-green-400"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

export default MenuCustomer;
