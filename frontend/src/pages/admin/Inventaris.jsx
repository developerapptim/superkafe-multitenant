import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api, { inventoryAPI, settingsAPI } from '../../services/api';
import SmartText from '../../components/SmartText';



// Custom Dropdown for Status Filter
// Custom Dropdown for Status Filter
const StatusFilterDropdown = ({ currentFilter, onFilterChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const [coords, setCoords] = useState(null);

    const options = [
        { value: 'all', label: 'Semua Status', color: 'text-gray-300', icon: '📋' },
        { value: 'Aman', label: 'Aman', color: 'text-green-400', icon: '✅' },
        { value: 'Rendah', label: 'Rendah', color: 'text-yellow-400', icon: '⚠️' },
        { value: 'Habis', label: 'Habis', color: 'text-red-400', icon: '❌' }
    ];

    const selectedOption = options.find(opt => opt.value === currentFilter) || options[0];

    // Helper to update coords
    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 8, // 8px gap
                left: rect.left,
                width: rect.width
            });
        }
    };

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true); // Capture scroll
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                // Check if clicking inside the portal (we can't easily check ref inside portal from here without another ref)
                // But typically, the portal is outside. 
                // Easier way: The backdrop usage in portal or checking event target against portal.
                // Simple workaround: We will use a transparent fixed backdrop in the portal.
                setIsOpen(false);
            }
        };
        // Only if NOT open, because if open, the portal's backdrop handles it? 
        // Actually, let's stick to the backdrop pattern for simplicity and robustness.
        // So we don't need this complex listener if we use a backdrop.
    }, []);

    return (
        <div className="relative min-w-[180px]" ref={containerRef}>
            <button
                onClick={() => {
                    if (!isOpen) setCoords(null); // Reset coords when opening
                    setIsOpen(!isOpen);
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-[#1e1e2d] border border-purple-500/30 text-white flex items-center justify-between focus:outline-none focus:border-purple-500 hover:bg-white/5 transition-all"
            >
                <div className="flex items-center gap-2">
                    <span>{selectedOption.icon}</span>
                    <span className={`${selectedOption.color} font-medium`}>{selectedOption.label}</span>
                </div>
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Menu via Portal */}
            {isOpen && createPortal(
                <>
                    {/* Transparent Backdrop for click-outside */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)}></div>

                    {coords && (
                        <div
                            className="fixed z-[9999] bg-[#1e1e2d] border border-purple-500/30 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top"
                            style={{
                                top: coords.top,
                                left: coords.left,
                                width: coords.width
                            }}
                        >
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onFilterChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-white/5 transition-colors ${currentFilter === option.value ? 'bg-purple-500/20' : ''
                                        }`}
                                >
                                    <span>{option.icon}</span>
                                    <span className={`${option.color} font-medium`}>{option.label}</span>
                                    {currentFilter === option.value && (
                                        <span className="ml-auto text-purple-400">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </>,
                document.body
            )}
        </div>
    );
};

const fetcher = url => api.get(url).then(res => res.data); // Added fetcher

function Inventaris() {
    // Check if user is admin (has full access) or staf (limited view)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    // Fetch settings to check staff permission
    const { data: settingsData } = useSWR('/settings', fetcher);

    // Determine edit permission
    const isAdmin = user.role === 'admin' || user.role === 'owner' || (user.role_access && user.role_access.includes('*'));
    const isStaff = user.role === 'staf' || user.role === 'kasir';
    const canEdit = isAdmin || (isStaff && settingsData?.allowStaffEditInventory);

    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('bahan');
    const [visibleIngredients, setVisibleIngredients] = useState(20); // Pagination state

    // Stats
    const [stats, setStats] = useState({
        totalItems: 0,
        lowStock: 0,
        assetValue: 0,
        assetWithPPN: 0
    });

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false); // Replaced showStockModal
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    // Removed stockAdjustment state as stock update modal is removed

    // Form states
    const [formData, setFormData] = useState({
        id: '',
        nama: '',
        type: 'physical', // Default type
        stok: 0,
        satuan_beli: 'pcs',
        harga_beli: 0,
        stok_min: 0,
        use_konversi: false,
        isi_prod: 1,
        satuan_prod: 'gram',
        satuan: 'pcs'
    });

    // Opname state
    const [opnameData, setOpnameData] = useState([]);

    // Custom Units state
    const [customUnits, setCustomUnits] = useState([]);

    // Tooltip State for Price
    const [activeTooltipId, setActiveTooltipId] = useState(null);
    const [showUnitsModal, setShowUnitsModal] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');

    // Filter & Restock State (Moved to top)
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'Aman', 'Rendah', 'Habis'
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
    const [restockData, setRestockData] = useState({
        amount: '',
        unitPrice: '',
        totalPrice: '',
        conversionRate: 1
    });

    // Top Usage State


    // Fetch data
    useEffect(() => {
        fetchData();
    }, []);



    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await inventoryAPI.getAll();
            const items = res.data;
            setIngredients(items);

            // Calculate stats
            const lowStockItems = items.filter(i => i.stok <= i.stok_min);
            const totalValue = items.reduce((sum, i) => {
                const modalPerUnit = i.use_konversi && i.isi_prod > 0
                    ? i.harga_beli / i.isi_prod
                    : i.harga_beli;
                return sum + (i.stok * modalPerUnit);
            }, 0);

            setStats({
                totalItems: items.length,
                lowStock: lowStockItems.length,
                assetValue: totalValue,
                assetWithPPN: totalValue * 1.11
            });


            // Fetch custom units
            try {
                const settingsRes = await settingsAPI.get();
                if (settingsRes.data && settingsRes.data.customUnits) {
                    setCustomUnits(settingsRes.data.customUnits);
                }
            } catch (err) {
                console.error('Error fetching units:', err);
                // Fallback handled by combining defaults
            }

            // Prepare opname data
            setOpnameData(items.map(i => ({
                id: i.id,
                nama: i.nama,
                stokSistem: i.stok,
                stokFisik: i.stok,
                selisih: 0,
                harga: i.use_konversi && i.isi_prod > 0 ? i.harga_beli / i.isi_prod : i.harga_beli
            })));

            setError(null);
        } catch (err) {
            console.error('Error fetching inventory:', err);
            setError('Gagal memuat data inventaris');
        } finally {
            setLoading(false);
        }
    };

    // Handle Delete with Toast Confirmation
    const handleDelete = (id) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="font-medium">Yakin ingin menghapus bahan ini?</span>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 py-1 text-xs rounded-md bg-gray-600 text-white hover:bg-gray-500"
                    >
                        Batal
                    </button>
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            executeDelete(id);
                        }}
                        className="px-3 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600"
                    >
                        Hapus
                    </button>
                </div>
            </div>
        ), {
            duration: 5000,
            style: {
                background: '#1F2937',
                color: '#fff',
                border: '1px solid #4B5563',
            },
        });
    };

    const executeDelete = async (id) => {
        try {
            await inventoryAPI.delete(id);
            toast.success('Bahan berhasil dihapus', { duration: 3000 });
            fetchData(); // Refresh data

        } catch (err) {
            console.error('Error deleting:', err);
            const msg = err.response?.data?.error || 'Gagal menghapus bahan';
            toast.error(msg);
        }
    };

    // Get stock status
    const getStockStatus = (item) => {
        if (item.stok <= 0) return { color: 'red', text: 'Habis' };
        if (item.stok <= item.stok_min) return { color: 'yellow', text: 'Rendah' };
        return { color: 'green', text: 'Aman' };
    };

    // Filter ingredients
    const filteredItems = ingredients.filter(item => {
        const matchesSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase());
        const status = getStockStatus(item);
        const matchesStatus = filterStatus === 'all' || status.text === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const displayedItems = filteredItems.slice(0, visibleIngredients);
    const hasMoreItems = visibleIngredients < filteredItems.length;

    const loadMoreIngredients = () => {
        setVisibleIngredients(prev => prev + 20);
    };

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    // Generate ID
    const generateId = () => `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate modal per unit
    const getModalPerUnit = (item) => {
        // Fix: Robust detection for calculation
        // Ensure we calculate per-gram/ml price if conversion exists
        const isKonversi = (item.isi_prod && Number(item.isi_prod) > 1) || item.use_konversi === true;

        // PRIORITIZE Moving Average (harga_modal) if available
        if (item.harga_modal > 0) return item.harga_modal;

        // Fallback to Last Purchase Price calculation
        if (isKonversi && item.isi_prod > 0) {
            return item.harga_beli / item.isi_prod;
        }
        return item.harga_beli;
    };



    // Open add modal
    const openAddModal = () => {
        setEditingItem(null);
        setFormData({
            id: generateId(),
            nama: '',
            type: 'physical',
            stok: 0,
            satuan_beli: 'pcs',
            harga_beli: 0,
            stok_min: 0,
            use_konversi: false,
            isi_prod: 1,
            satuan_prod: 'gram',
            satuan: 'pcs'
        });
        setShowModal(true);
    };

    // Open edit modal
    const openEditModal = (item) => {
        setEditingItem(item); // Keep track of what we are editing

        // Fix: Robust detection of conversion state
        // If isi_prod > 1, it MUST be a conversion item (e.g. 1000 grams per Kg)
        // Or if explicitly set to true in DB
        const isKonversi = (item.isi_prod && Number(item.isi_prod) > 1) || item.use_konversi === true;

        setFormData({
            id: item.id,
            nama: item.nama,
            type: item.type || 'physical',
            // Fix: If conversion is ON, the stock in DB is in Production Units (e.g. 3000 gram).
            // We need to divide by isi_prod (1000) to show the user the Buying Unit (3 Kg).
            stok: isKonversi && item.isi_prod > 0 ? (item.stok / item.isi_prod) : item.stok,
            satuan_beli: item.satuan_beli || 'pcs',
            harga_beli: item.harga_beli,
            stok_min: item.stok_min || 0,
            use_konversi: isKonversi,
            isi_prod: item.isi_prod || 1,
            satuan_prod: item.satuan_prod || 'gram',
            satuan: item.satuan || 'pcs'
        });
        setShowModal(true);
    };

    // Open History Modal
    const openHistoryModal = async (item) => {
        setEditingItem(item);
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try {
            const res = await api.get(`/inventory/${item.id}/history`);
            setHistoryData(res.data);
        } catch (err) {
            console.error('Error fetching history:', err);
            toast.error('Gagal memuat riwayat');
        } finally {
            setHistoryLoading(false);
        }
    };



    const openRestockModal = (item) => {
        setEditingItem(item);
        setRestockData({
            amount: '',
            unitPrice: item.harga_beli || '',
            totalPrice: '',
            conversionRate: item.isi_prod || 1
        });
        setShowRestockModal(true);
    };

    const handleRestockChange = (field, value) => {
        let newData = { ...restockData, [field]: value };

        if (field === 'amount' || field === 'unitPrice') {
            const amount = Number(field === 'amount' ? value : restockData.amount);
            const price = Number(field === 'unitPrice' ? value : restockData.unitPrice);
            if (amount && price) {
                newData.totalPrice = amount * price;
            }
        }

        setRestockData(newData);
    };

    const handleRestockSubmit = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Memproses restock...');
        try {
            await inventoryAPI.restock({
                id: editingItem.id,
                amount: Number(restockData.amount),
                totalPrice: Number(restockData.totalPrice),
                conversionRate: Number(restockData.conversionRate)
            });
            await fetchData();
            setShowRestockModal(false);
            toast.success('Restock berhasil! HPP diperbarui.', { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error('Gagal restock', { id: toastId });
        }
    };

    // Simulation for Restock
    const getRestockSimulation = () => {
        if (!editingItem || !restockData.amount || !restockData.totalPrice) return null;

        const currentStock = editingItem.stok || 0;
        const currentHPP = editingItem.harga_modal || 0;

        const addedStock = Number(restockData.amount) * Number(restockData.conversionRate);
        const purchaseCost = Number(restockData.totalPrice);

        const newTotalStock = currentStock + addedStock;
        const currentAsset = currentStock * currentHPP;
        const newAsset = currentAsset + purchaseCost;
        const newHPP = newTotalStock > 0 ? newAsset / newTotalStock : 0;

        return {
            stockNow: currentStock,
            stockNew: newTotalStock,
            hppNow: currentHPP,
            hppNew: newHPP,
            diff: newHPP - currentHPP
        };
    };


    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.nama) {
            toast.error('Nama bahan wajib diisi');
            return;
        }

        const toastId = toast.loading('Menyimpan data bahan...');
        try {
            const isiProd = Number(formData.isi_prod);
            const hargaBeli = Number(formData.harga_beli);
            const hargaModal = formData.use_konversi && isiProd > 0 ? (hargaBeli / isiProd) : hargaBeli;

            // Determine correct unit to save
            const unitToSave = formData.use_konversi ? formData.satuan_prod : formData.satuan_beli;

            const dataToSend = {
                ...formData,

                // Fix: Update satuan explicitly
                satuan: unitToSave,

                // Ensure use_konversi is sent explicitly
                use_konversi: formData.use_konversi,

                // Calculate final stock with conversion logic
                stok: formData.type === 'non_physical'
                    ? 0
                    : (formData.use_konversi && isiProd > 0 ? Number(formData.stok) * isiProd : Number(formData.stok)),

                stok_min: formData.type === 'non_physical' ? 0 : Number(formData.stok_min),
                harga_beli: hargaBeli,
                isi_prod: isiProd,
                // Mapped fields for backend as requested
                has_conversion: formData.use_konversi,
                conversion_rate: isiProd,
                production_unit: formData.satuan_prod,
                cost_per_unit: hargaModal,
                harga_modal: hargaModal // Keep original schema field too
            };

            if (editingItem) {
                const result = await Swal.fire({
                    title: 'Perubahan Data Sensitif!',
                    text: "Anda sedang mengubah data master bahan. Perubahan harga akan mempengaruhi perhitungan HPP dan Laporan Laba/Rugi secara otomatis. Yakin data sudah benar?",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'Ya, Simpan Perubahan',
                    cancelButtonText: 'Batal',
                    background: '#1f2937', // Dark theme support
                    color: '#fff',
                    customClass: {
                        container: 'z-[99999]', // Ensure it's above other modals
                        popup: 'w-[90%] md:w-[32em] rounded-xl', // Responsive width
                        title: 'text-lg md:text-2xl', // Responsive title
                        htmlContainer: 'text-sm md:text-base' // Responsive text
                    }
                });

                if (!result.isConfirmed) {
                    toast.dismiss(toastId);
                    return;
                }

                await inventoryAPI.update(formData.id, dataToSend);
            } else {
                await inventoryAPI.create(dataToSend);
            }

            await fetchData();
            setShowModal(false);

            if (!isAdmin) {
                toast.success('Bahan disimpan. Perubahan Anda terekam oleh admin.', { id: toastId, duration: 4000 });
            } else {
                toast.success('Bahan berhasil disimpan', { id: toastId });
            }
        } catch (err) {
            console.error('Error saving ingredient:', err);
            toast.error('Gagal menyimpan bahan', { id: toastId });
        }
    };

    // Helper to prevent "05" issue in number inputs
    const handleNumberChange = (field, value) => {
        // Remove leading zero if it's followed by a number (not a dot)
        // Example: "05" -> "5", "0.5" -> "0.5", "0" -> "0"
        let cleanValue = value;
        if (cleanValue.length > 1 && cleanValue.startsWith('0') && cleanValue[1] !== '.') {
            cleanValue = cleanValue.replace(/^0+/, '');
        }
        setFormData(prev => ({ ...prev, [field]: cleanValue }));
    };

    // Removed handleStockAdjust since logic is removed

    // Handle opname change
    const handleOpnameChange = (id, stokFisik) => {
        setOpnameData(prev => prev.map(item => {
            if (item.id === id) {
                const fisik = Number(stokFisik);
                return {
                    ...item,
                    stokFisik: fisik,
                    selisih: fisik - item.stokSistem
                };
            }
            return item;
        }));
    };

    // Save opname
    const saveOpname = async () => {
        const itemsWithDiff = opnameData.filter(i => i.selisih !== 0);
        if (itemsWithDiff.length === 0) {
            toast('Tidak ada selisih stok untuk disimpan', { icon: 'ℹ️' });
            return;
        }

        const toastId = toast.loading('Menyimpan opname stok...');
        try {
            for (const item of itemsWithDiff) {
                await inventoryAPI.adjustStock(item.id, {
                    qty: item.selisih,
                    note: 'Stock Opname'
                });
            }
            await fetchData();
            toast.success(`Opname berhasil disimpan untuk ${itemsWithDiff.length} bahan`, { id: toastId });
        } catch (err) {
            console.error('Error saving opname:', err);
            toast.error('Gagal menyimpan opname', { id: toastId });
        }
    };

    const defaultUnits = ['gram', 'ml', 'pcs', 'ekor', 'buah', 'ikat', 'kg', 'liter', 'box', 'kaleng'];
    // Merge defaults with custom units, removing duplicates and sorting alphabetically
    const units = [...new Set([...defaultUnits, ...customUnits])].sort((a, b) => a.localeCompare(b));

    // Handle Add Unit
    const handleAddUnit = async (e) => {
        e.preventDefault();
        if (!newUnitName.trim()) return;

        const toastId = toast.loading('Menambahkan satuan...');
        try {
            const res = await settingsAPI.addUnit(newUnitName.trim());
            setCustomUnits(res.data.customUnits);
            setNewUnitName('');
            toast.success('Satuan berhasil ditambahkan', { id: toastId });
        } catch (err) {
            console.error('Error adding unit:', err);
            toast.error('Gagal menambahkan satuan', { id: toastId });
        }
    };

    // Handle Delete Unit
    const handleDeleteUnit = async (unitName) => {
        if (!confirm(`Hapus satuan "${unitName}"?`)) return;

        const toastId = toast.loading('Menghapus satuan...');
        try {
            const res = await settingsAPI.removeUnit(unitName);
            setCustomUnits(res.data.customUnits);
            toast.success('Satuan berhasil dihapus', { id: toastId });
        } catch (err) {
            console.error('Error removing unit:', err);
            toast.error('Gagal menghapus satuan', { id: toastId });
        }
    };

    if (loading) {
        return (
            <section className="p-4 md:p-6 space-y-6">

                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="p-4 md:p-6 space-y-6">

                <div className="glass rounded-xl p-6 text-center">
                    <p className="text-red-400">{error}</p>
                    <button onClick={fetchData} className="mt-4 px-4 py-2 bg-purple-500 rounded-lg hover:bg-purple-600">
                        Coba Lagi
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
                {/* <h2 className="text-2xl font-bold hidden md:block">📦 Inventaris</h2> - Moved to Header */}
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto relative z-10">
                    <button
                        onClick={() => setShowUnitsModal(true)}
                        className="w-full md:w-auto bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                    >
                        <span>📏</span> Kelola Satuan
                    </button>
                    {canEdit && (
                        <button
                            onClick={openAddModal}
                            className="w-full md:w-auto bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                        >
                            <span>➕</span> Tambah Bahan
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards - Hide financial cards for Staf */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="glass rounded-xl p-3 md:p-4">
                    <p className="text-[10px] md:text-xs text-gray-400">Total Bahan</p>
                    <p className="text-lg md:text-xl font-bold">{stats.totalItems}</p>
                </div>
                <div className="glass rounded-xl p-3 md:p-4">
                    <p className="text-[10px] md:text-xs text-gray-400">Stok Rendah</p>
                    <p className="text-lg md:text-xl font-bold text-red-400">{stats.lowStock}</p>
                </div>
                {isAdmin && (
                    <>
                        <div className="glass rounded-xl p-3 md:p-4">
                            <p className="text-[10px] md:text-xs text-gray-400">Nilai Aset Stok</p>
                            <SmartText className="text-lg md:text-xl font-bold text-green-400">{formatCurrency(stats.assetValue)}</SmartText>
                        </div>
                        <div className="glass rounded-xl p-3 md:p-4">
                            <p className="text-[10px] md:text-xs text-gray-400">Nilai + PPN</p>
                            <SmartText className="text-lg md:text-xl font-bold text-purple-400">{formatCurrency(stats.assetWithPPN)}</SmartText>
                        </div>
                    </>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="mb-6 transition-all duration-300">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('bahan')}
                        className={`flex-1 py-3 px-2 rounded-xl text-xs md:text-sm transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'bahan'
                            ? 'bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/20 transform scale-105'
                            : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10'
                            }`}
                    >
                        <span className="text-xl md:text-2xl mb-1">📋</span>
                        <span className="font-semibold leading-tight">Master</span>
                        <span className="font-semibold leading-tight">Bahan</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('opname')}
                        className={`flex-1 py-3 px-2 rounded-xl text-xs md:text-sm transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'opname'
                            ? 'bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/20 transform scale-105'
                            : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10'
                            }`}
                    >
                        <span className="text-xl md:text-2xl mb-1">📝</span>
                        <span className="font-semibold leading-tight">Stock</span>
                        <span className="font-semibold leading-tight">Opname</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 px-2 rounded-xl text-xs md:text-sm transition-all flex flex-col items-center justify-center gap-1 ${activeTab === 'history'
                            ? 'bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/20 transform scale-105'
                            : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10'
                            }`}
                    >
                        <span className="text-xl md:text-2xl mb-1">📜</span>
                        <span className="font-semibold leading-tight">Riwayat</span>
                        <span className="font-semibold leading-tight">Stok</span>
                    </button>
                </div>
            </div>



            {/* Tab: Master Bahan */}
            {activeTab === 'bahan' && (
                <>
                    {/* Search Bar & Filter - Shared */}

                    <div className="glass rounded-xl p-4 mb-4 border border-purple-500/20 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setVisibleIngredients(20); // Reset pagination on search
                                }}
                                className="w-full px-4 py-2 pl-10 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                                placeholder="🔍 Cari bahan..."
                            />
                            <div className="absolute left-3 top-2.5 text-gray-400">
                                {/* Icon placeholder if needed, input has padding-left */}
                            </div>
                        </div>

                        {/* Status Filter Dropdown */}
                        <StatusFilterDropdown
                            currentFilter={filterStatus}
                            onFilterChange={setFilterStatus}
                        />
                    </div>

                    {/* Desktop View: Table */}
                    <div className="hidden md:block glass rounded-xl overflow-hidden border border-purple-500/20">
                        <div className="max-h-[calc(100vh-240px)] overflow-y-auto overflow-x-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
                            <table className="w-full text-sm relative border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="sticky top-0 z-20 px-4 py-3 text-left font-semibold text-gray-200 bg-[#1e1e2d]">Nama Bahan</th>
                                        <th className="sticky top-0 z-20 px-4 py-3 text-center font-semibold text-gray-200 bg-[#1e1e2d]">Stok</th>
                                        {isAdmin && (
                                            <>
                                                <th className="sticky top-0 z-20 px-4 py-3 text-right font-semibold text-gray-200 bg-[#1e1e2d]">Harga Beli</th>
                                                <th className="sticky top-0 z-20 px-4 py-3 text-right font-semibold text-gray-200 bg-[#1e1e2d]">Modal/Unit</th>
                                                <th className="sticky top-0 z-20 px-4 py-3 text-right font-semibold text-gray-200 bg-[#1e1e2d]">Nilai Stok</th>
                                            </>
                                        )}
                                        <th className="sticky top-0 z-20 px-4 py-3 text-center font-semibold text-gray-200 bg-[#1e1e2d]">Status</th>
                                        <th className="sticky top-0 z-20 px-4 py-3 text-center font-semibold text-gray-200 bg-[#1e1e2d]">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-purple-500/10">
                                    {displayedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 7 : 4} className="px-4 py-8 text-center text-gray-400">
                                                Tidak ada bahan ditemukan
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedItems.map(item => {
                                            const status = getStockStatus(item);
                                            const modalPerUnit = getModalPerUnit(item);
                                            const stockValue = item.stok * modalPerUnit;

                                            // Robust detection for display
                                            const isKonversi = (item.isi_prod && Number(item.isi_prod) > 1) || item.use_konversi === true;

                                            return (
                                                <tr key={item.id} className="hover:bg-white/5">
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <SmartText className="font-medium text-white">{item.nama}</SmartText>
                                                            {item.type === 'non_physical' && (
                                                                <span className="mt-1 inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit">
                                                                    ⚡ Jasa / Non-Stok
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isKonversi && (
                                                            <div className="text-xs text-gray-400 mt-1">
                                                                1 {item.satuan_beli} = {item.isi_prod} {item.satuan_prod}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`px-4 py-3 text-center ${item.stok < 0 ? 'text-red-500 font-bold' : ''}`}>
                                                        {item.type === 'non_physical' ? (
                                                            <span className="text-xl text-gray-500 font-bold">∞</span>
                                                        ) : (
                                                            // Dual-View Logic: Show Buy Unit if conversion exists (isi_prod > 1) and buy unit is defined
                                                            (item.isi_prod > 1 && item.satuan_beli) ? (
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <span className="text-sm font-bold text-white">
                                                                        {parseFloat((item.stok / item.isi_prod).toFixed(2))} <span className="text-sm font-bold text-white-400">{item.satuan_beli}</span>
                                                                    </span>
                                                                    <span className="text-[11px] text-gray-400 mt-0.5">
                                                                        ({Math.floor(item.stok / item.isi_prod)} {item.satuan_beli} + {(item.stok % item.isi_prod).toFixed(0)} {item.satuan_prod})
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="font-bold text-white text-base">
                                                                    {item.stok} <span className="font-normal text-gray-400 text-sm">{item.satuan_prod || item.satuan || 'unit'}</span>
                                                                </span>
                                                            )
                                                        )}
                                                    </td>
                                                    {isAdmin && (
                                                        <>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-2 relative">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="font-medium text-white">
                                                                            {formatCurrency(modalPerUnit * (isKonversi ? item.isi_prod : 1))}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-500">Avg</span>
                                                                    </div>

                                                                    {/* Info Icon - Show only if Last Price exists and differs from Average */}
                                                                    {item.lastBuyPrice && Math.abs(item.lastBuyPrice - (modalPerUnit * (isKonversi ? item.isi_prod : 1))) > 10 && (
                                                                        <button
                                                                            className="text-gray-400 hover:text-blue-400 transition-colors focus:outline-none"
                                                                            onClick={() => {
                                                                                if (activeTooltipId === item.id) {
                                                                                    setActiveTooltipId(null);
                                                                                } else {
                                                                                    setActiveTooltipId(item.id);
                                                                                    // Auto-hide after 3 seconds
                                                                                    setTimeout(() => setActiveTooltipId(null), 3000);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                        </button>
                                                                    )}

                                                                    {/* Tooltip Popover */}
                                                                    {activeTooltipId === item.id && (
                                                                        <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-gray-900/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white transform transition-all animate-in fade-in slide-in-from-top-2">
                                                                            <p className="font-bold text-gray-400 mb-1 border-b border-white/10 pb-1">Harga Beli Terakhir</p>
                                                                            <div className="flex justify-between items-center mt-1">
                                                                                <span className="text-emerald-400 font-mono text-sm">
                                                                                    {item.lastBuyPrice ? formatCurrency(item.lastBuyPrice) : '-'}
                                                                                </span>
                                                                            </div>
                                                                            {item.lastBuyDate && (
                                                                                <p className="text-[10px] text-gray-500 mt-1 text-right">
                                                                                    {new Date(item.lastBuyDate).toLocaleDateString('id-ID')}
                                                                                </p>
                                                                            )}
                                                                            <div className="absolute -top-2 right-2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900/95"></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{formatCurrency(modalPerUnit)}</td>
                                                            <td className="px-4 py-3 text-right">{formatCurrency(stockValue)}</td>
                                                        </>
                                                    )}
                                                    <td className="px-4 py-3 text-center">
                                                        {item.type === 'non_physical' ? (
                                                            <span className="px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">
                                                                Info
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-1 rounded-full text-xs bg-${status.color}-500/20 text-${status.color}-400`}>
                                                                {status.text}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {canEdit ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => openHistoryModal(item)}
                                                                    className="p-2 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                                                                    title="Riwayat Stok & Harga"
                                                                >
                                                                    🕒
                                                                </button>
                                                                <button
                                                                    onClick={() => openRestockModal(item)}
                                                                    className="p-2 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                                                    title="Restock (Beli)"
                                                                >
                                                                    📥
                                                                </button>
                                                                <button
                                                                    onClick={() => openEditModal(item)}
                                                                    className="p-2 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(item.id)}
                                                                    className="p-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                                    title="Hapus"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-500 italic">Read Only</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View: Card List */}
                    <div className="md:hidden space-y-4">
                        {displayedItems.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 glass rounded-xl">
                                Tidak ada bahan ditemukan
                            </div>
                        ) : (
                            displayedItems.map(item => {
                                const status = getStockStatus(item);
                                const modalPerUnit = getModalPerUnit(item);
                                const stockValue = item.stok * modalPerUnit;
                                const isKonversi = (item.isi_prod && Number(item.isi_prod) > 1) || item.use_konversi === true;

                                return (
                                    <div key={item.id} className="glass rounded-xl p-4 border border-purple-500/10 active:scale-[0.99] transition-transform">
                                        {/* Row 1: Header */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="font-bold text-white text-lg leading-tight">
                                                    <SmartText maxLength={25}>{item.nama}</SmartText>
                                                </div>
                                                {item.type === 'non_physical' && (
                                                    <span className="inline-block mt-1 text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20">
                                                        ⚡ Jasa / Non-Stok
                                                    </span>
                                                )}
                                                {isKonversi && (
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        📦 1 {item.satuan_beli} = {item.isi_prod} {item.satuan_prod}
                                                    </p>
                                                )}
                                            </div>
                                            {item.type !== 'non_physical' && (
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold bg-${status.color}-500/20 text-${status.color}-400 shrink-0`}>
                                                    {status.text}
                                                </span>
                                            )}
                                        </div>

                                        {/* Row 2: Stock Display (Big) */}
                                        <div className="mb-4 bg-white/5 rounded-lg p-3 text-center border border-white/5">
                                            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Stok Saat Ini</p>
                                            {item.type === 'non_physical' ? (
                                                <span className="text-3xl text-gray-500 font-bold">∞</span>
                                            ) : (
                                                <div className="flex items-baseline justify-center gap-1">
                                                    {(item.isi_prod > 1 && item.satuan_beli) ? (
                                                        <>
                                                            <span className="text-2xl font-bold text-white">
                                                                {parseFloat((item.stok / item.isi_prod).toFixed(2))}
                                                            </span>
                                                            <span className="text-sm text-gray-400 font-medium">{item.satuan_beli}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-2xl font-bold text-white">
                                                                {item.stok}
                                                            </span>
                                                            <span className="text-sm text-gray-400 font-medium">{item.satuan_prod || item.satuan || 'unit'}</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 3: Grid Info */}
                                        {isAdmin && item.type !== 'non_physical' && (
                                            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                                                <div className="bg-white/5 rounded-lg p-2">
                                                    <p className="text-[10px] text-gray-400 mb-0.5">Hrg Beli</p>
                                                    <SmartText className="text-xs font-medium text-emerald-400">
                                                        {formatCurrency(modalPerUnit * (isKonversi ? item.isi_prod : 1))}
                                                    </SmartText>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-2">
                                                    <p className="text-[10px] text-gray-400 mb-0.5">Modal/Unit</p>
                                                    <SmartText className="text-xs font-medium text-white">
                                                        {formatCurrency(modalPerUnit)}
                                                    </SmartText>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-2">
                                                    <p className="text-[10px] text-gray-400 mb-0.5">Ni. Stok</p>
                                                    <SmartText className="text-xs font-bold text-purple-400">
                                                        {formatCurrency(stockValue)}
                                                    </SmartText>
                                                </div>
                                            </div>
                                        )}

                                        {/* Row 4: Actions (Large Buttons) */}
                                        {canEdit && (
                                            <div className="grid grid-cols-4 gap-2">
                                                <button
                                                    onClick={() => openRestockModal(item)}
                                                    className="col-span-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                                                >
                                                    📥 Restock
                                                </button>
                                                <button
                                                    onClick={() => openHistoryModal(item)}
                                                    className="py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-medium hover:bg-amber-500/30 flex items-center justify-center active:scale-95 transition-all"
                                                >
                                                    🕒
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(item)}
                                                    className="py-2.5 rounded-lg bg-orange-500/20 text-orange-400 font-medium hover:bg-orange-500/30 flex items-center justify-center active:scale-95 transition-all"
                                                >
                                                    ✏️
                                                </button>
                                                {/* Hidden delete on mobile default to prevent accidents, or keep it if requested. User said "Tombol Aksi (Edit, Hapus, History) yang besar". I will put delete in valid place. 4 cols allow it. */}
                                            </div>
                                        )}
                                        {/* Row 4 extended for delete if needed, or put delete next to edit. 
                                            Let's refine grid to 4 cols: [Restock (2)] [History] [Edit] 
                                            Delete is dangerous, maybe better in a 'more' menu or just add a 5th row?
                                            User requested: "Edit, Hapus, History".
                                            My layout: Restock (most important), History, Edit. 
                                            I should add Delete. 
                                            Let's try grid-cols-4.
                                        */}
                                        {canEdit && (
                                            <div className="grid grid-cols-4 gap-2 mt-2">
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="col-span-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                                >
                                                    🗑️ Hapus Bahan
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Load More Button - Shared */}
                    {hasMoreItems && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={loadMoreIngredients}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full border border-purple-500/30 transition-all flex items-center gap-2 group"
                            >
                                <span>Muat Lebih Banyak</span>
                                <svg className="w-4 h-4 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                        </div>
                    )}
                </>
            )
            }

            {/* Tab: Stock Opname */}
            {
                activeTab === 'opname' && (
                    <div className="glass rounded-xl p-4">
                        <h3 className="font-bold mb-4">📝 Rekonsiliasi Stok</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Bandingkan stok sistem dengan stok fisik. Selisih akan dicatat dan disesuaikan.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nama Bahan</th>
                                        <th className="px-4 py-3 text-right">Stok Sistem</th>
                                        <th className="px-4 py-3 text-right">Stok Fisik</th>
                                        <th className="px-4 py-3 text-right">Selisih</th>
                                        {isAdmin && <th className="px-4 py-3 text-right">Nilai Selisih (Rp)</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-purple-500/10">
                                    {opnameData.map(item => (
                                        <tr key={item.id} className="hover:bg-white/5">
                                            <td className="px-4 py-3">{item.nama}</td>
                                            <td className="px-4 py-3 text-right">{item.stokSistem}</td>
                                            <td className="px-4 py-3 text-right">
                                                <input
                                                    type="number"
                                                    value={item.stokFisik}
                                                    onChange={(e) => handleOpnameChange(item.id, e.target.value)}
                                                    className="w-20 px-2 py-1 rounded bg-white/10 border border-purple-500/30 text-right text-white"
                                                />
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${item.selisih > 0 ? 'text-green-400' :
                                                item.selisih < 0 ? 'text-red-400' : ''
                                                }`}>
                                                {item.selisih > 0 ? '+' : ''}{item.selisih}
                                            </td>
                                            {isAdmin && (
                                                <td className={`px-4 py-3 text-right ${item.selisih > 0 ? 'text-green-400' :
                                                    item.selisih < 0 ? 'text-red-400' : ''
                                                    }`}>
                                                    {formatCurrency(item.selisih * item.harga)}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button
                            onClick={saveOpname}
                            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold"
                        >
                            💾 Simpan Opname
                        </button>
                    </div>
                )
            }

            {/* Tab: Riwayat Stok */}
            {
                activeTab === 'history' && (
                    <div className="glass rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-purple-500/20 flex justify-between items-center">
                            <h3 className="font-bold">📜 Riwayat Pergerakan Stok</h3>
                        </div>
                        <StockHistoryTable />
                    </div>
                )
            }

            {/* Restock Modal */}
            {
                showRestockModal && editingItem && createPortal(
                    <div className="modal-overlay">
                        <div className="glass rounded-2xl p-6 w-full max-w-lg">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold">🛒 Restock: {editingItem.nama}</h3>
                                <button onClick={() => setShowRestockModal(false)} className="text-gray-400 hover:text-white">✕</button>
                            </div>

                            <form onSubmit={handleRestockSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Jumlah Beli ({editingItem.satuan_beli})</label>
                                        <input
                                            type="number"
                                            value={restockData.amount}
                                            onChange={(e) => handleRestockChange('amount', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Harga Satuan (Rp)</label>
                                        <input
                                            type="number"
                                            value={restockData.unitPrice}
                                            onChange={(e) => handleRestockChange('unitPrice', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                            placeholder="0"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Total (Auto)</label>
                                        <input
                                            type="number"
                                            value={restockData.totalPrice}
                                            onChange={(e) => handleRestockChange('totalPrice', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-gray-400 cursor-not-allowed"
                                            readOnly
                                            placeholder="Rp 0"
                                        />
                                    </div>
                                </div>

                                {/* Simulation Display */}
                                {getRestockSimulation() && (
                                    <div className="bg-white/5 p-4 rounded-lg space-y-2 text-sm border border-white/10">
                                        <h4 className="font-bold text-gray-300 border-b border-white/10 pb-1 mb-2">📊 Simulasi Perhitungan</h4>

                                        <div className="flex justify-between items-center">
                                            <span>Stok:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">{getRestockSimulation().stockNow}</span>
                                                <span>→</span>
                                                <span className="font-bold text-green-400">{getRestockSimulation().stockNew} {editingItem.satuan_prod}</span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span>HPP (Modal/Unit):</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">{formatCurrency(getRestockSimulation().hppNow)}</span>
                                                <span>→</span>
                                                <span className={`font-bold ${getRestockSimulation().diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {formatCurrency(getRestockSimulation().hppNew)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 italic">
                                            *Harga modal dihitung ulang rata-rata (Moving Average)
                                        </p>
                                    </div>
                                )}

                                <button type="submit" className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold transition-all shadow-lg active:scale-95">
                                    ✅ Konfirmasi Restock
                                </button>
                            </form>
                        </div>
                    </div>
                    , document.body)
            }

            {/* Existing Modals */}
            {/* Existing Modals */}
            {
                showModal && createPortal(
                    <div className="modal-overlay">
                        <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold">
                                    {editingItem ? '✏️ Edit Bahan' : '➕ Tambah Bahan Baru'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Type Selection */}
                                <div className="flex p-1 bg-white/5 rounded-lg mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'physical' })}
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'physical'
                                            ? 'bg-red-500 text-white shadow-lg'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        🔴 Stok Fisik
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'non_physical' })}
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'non_physical'
                                            ? 'bg-blue-500 text-white shadow-lg'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        🔵 Biaya/Jasa
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nama Bahan *</label>
                                    <input
                                        type="text"
                                        value={formData.nama}
                                        onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                        placeholder="Contoh: Kopi Bubuk Robusta"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {formData.type === 'physical' ? (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Stok Awal</label>
                                            <input
                                                type="number"
                                                value={formData.stok}
                                                onChange={(e) => handleNumberChange('stok', e.target.value)}
                                                className={`w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500 ${editingItem ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={!!editingItem}
                                            />
                                            {editingItem && (
                                                <p className="text-[10px] text-amber-500 mt-1 italic">
                                                    *Untuk mengubah jumlah stok, gunakan fitur Stock Opname.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1 opacity-50">Stok (Auto)</label>
                                            <input
                                                type="text"
                                                value="∞"
                                                disabled
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Satuan Beli</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white flex justify-between items-center focus:outline-none focus:border-purple-500 transition-colors hover:bg-white/10"
                                            >
                                                <span className={!formData.satuan_beli ? 'text-gray-500' : ''}>
                                                    {formData.satuan_beli || 'Pilih Satuan'}
                                                </span>
                                                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUnitDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {isUnitDropdownOpen && (
                                                <>
                                                    {/* Backdrop to close on click outside */}
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsUnitDropdownOpen(false)}></div>

                                                    {/* Dropdown Menu */}
                                                    <div className="absolute z-50 w-full mt-1 bg-[#1f2937] border border-purple-500/30 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                                        {units.map(u => (
                                                            <button
                                                                key={u}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, satuan_beli: u });
                                                                    setIsUnitDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2 hover:bg-purple-500/20 text-white transition-colors border-b border-white/5 last:border-0 ${formData.satuan_beli === u ? 'bg-purple-500/20 text-purple-400 font-bold' : ''}`}
                                                            >
                                                                {u}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Harga Beli (Rp)</label>
                                        <input
                                            type="number"
                                            value={formData.harga_beli}
                                            onChange={(e) => handleNumberChange('harga_beli', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                    {formData.type === 'physical' ? (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Stok Minimum</label>
                                            <input
                                                type="number"
                                                value={formData.stok_min}
                                                onChange={(e) => handleNumberChange('stok_min', e.target.value)}
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1 opacity-50">Stok Minimum</label>
                                            <input
                                                type="text"
                                                value="N/A"
                                                disabled
                                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed"
                                            />
                                        </div>
                                    )}
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer mb-4">
                                    <input
                                        type="checkbox"
                                        checked={formData.use_konversi}
                                        onChange={(e) => setFormData({ ...formData, use_konversi: e.target.checked })}
                                        className="w-5 h-5 rounded accent-purple-500"
                                    />
                                    <span className="font-medium">Centang Jika Satuan Beli & Produksi Berbeda</span>
                                </label>

                                {formData.use_konversi && (
                                    <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-purple-500/20">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Isi per {formData.satuan_beli || 'Unit'} *
                                                </label>
                                                <input
                                                    type="number"
                                                    value={formData.isi_prod}
                                                    onChange={(e) => setFormData({ ...formData, isi_prod: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg bg-gray-900/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1">Satuan Produksi</label>
                                                <select
                                                    value={formData.satuan_prod}
                                                    onChange={(e) => setFormData({ ...formData, satuan_prod: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-lg bg-gray-900/50 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                                >
                                                    {units.map(u => <option key={u} value={u} className="bg-gray-900">{u}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Harga Modal Dasar Calculator */}
                                        <div className="pt-2 border-t border-white/10">
                                            <p className="text-sm text-gray-400 mb-1">Harga Modal Dasar (untuk Gramasi/HPP)</p>
                                            <p className="text-lg font-bold text-green-400">
                                                {formatCurrency(formData.harga_beli > 0 && formData.isi_prod > 0 ? (formData.harga_beli / formData.isi_prod) : formData.harga_beli)}
                                                <span className="text-sm font-normal text-gray-400 ml-1">/ {formData.satuan_prod || 'unit'}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {!formData.use_konversi && (
                                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                        <p className="text-sm text-gray-400 mb-1">Harga Modal Dasar</p>
                                        <p className="text-lg font-bold text-green-400">
                                            {formatCurrency(formData.harga_beli)}
                                            <span className="text-sm font-normal text-gray-400 ml-1">/ {formData.satuan_beli || 'unit'}</span>
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold shadow-lg shadow-purple-500/20 transition-all"
                                    >
                                        💾 Simpan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    , document.body)
            }

            {/* Manage Units Modal */}
            {/* Manage Units Modal */}
            {
                showUnitsModal && createPortal(
                    <div className="modal-overlay">
                        <div className="glass rounded-2xl p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold">📏 Kelola Satuan</h3>
                                <button
                                    onClick={() => setShowUnitsModal(false)}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleAddUnit} className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={newUnitName}
                                    onChange={(e) => setNewUnitName(e.target.value)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Nama satuan baru..."
                                />
                                <button
                                    type="submit"
                                    disabled={!newUnitName.trim()}
                                    className="px-4 py-2 rounded-lg bg-green-500 disabled:opacity-50 hover:bg-green-600 font-medium"
                                >
                                    Tambah
                                </button>
                            </form>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                <h4 className="text-sm text-gray-400 mb-2">Satuan Kustom (Bisa Dihapus)</h4>
                                {customUnits.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">Belum ada satuan kustom.</p>
                                ) : (
                                    customUnits.map(unit => (
                                        <div key={unit} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-purple-500/10">
                                            <span>{unit}</span>
                                            <button
                                                onClick={() => handleDeleteUnit(unit)}
                                                className="text-red-400 hover:text-red-300 text-sm"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    ))
                                )}

                                <h4 className="text-sm text-gray-400 mt-4 mb-2">Satuan Bawaan (Tidak Bisa Dihapus)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {defaultUnits.map(unit => (
                                        <span key={unit} className="px-2 py-1 rounded bg-white/5 text-xs text-gray-400 border border-white/5">
                                            {unit}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }





            {/* History Modal */}
            {
                showHistoryModal && createPortal(
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-[#1f2937] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        🕒 Riwayat Stok & Harga
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1">{editingItem?.nama}</p>
                                </div>
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-0 overflow-auto flex-1">
                                {historyLoading ? (
                                    <div className="flex justify-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Tanggal</th>
                                                <th className="px-6 py-3 font-medium">Tipe</th>
                                                <th className="px-6 py-3 font-medium text-right">Jumlah</th>
                                                <th className="px-6 py-3 font-medium text-right">Harga Beli (Pasar)</th>
                                                <th className="px-6 py-3 font-medium text-right">Rata-rata Harga Beli</th>
                                                <th className="px-6 py-3 font-medium">Catatan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {historyData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 italic">
                                                        Belum ada riwayat
                                                    </td>
                                                </tr>
                                            ) : (
                                                historyData.map((hist) => (
                                                    <tr key={hist._id || hist.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-3 text-gray-300">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{hist.date}</span>
                                                                <span className="text-xs text-gray-500">{hist.time}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-medium border ${hist.type === 'restock' || hist.type === 'in' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                hist.type === 'out' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                }`}>
                                                                {hist.type === 'in' || hist.type === 'restock' ? 'Restock' :
                                                                    hist.type === 'out' ? 'Keluar' : 'Koreksi'}
                                                            </span>
                                                        </td>
                                                        <td className={`px-6 py-3 text-right font-bold ${hist.qty > 0 ? 'text-emerald-400' : 'text-red-400'
                                                            }`}>
                                                            {hist.type === 'out' ? '-' : '+'}{hist.qty} {editingItem?.satuan_prod || 'unit'}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-emerald-300">
                                                            {(hist.type === 'restock' || hist.type === 'in') && hist.hargaBeli
                                                                ? formatCurrency(hist.hargaBeli)
                                                                : '-'}
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-gray-300">
                                                            {(() => {
                                                                const isKonversi = (editingItem?.isi_prod && Number(editingItem.isi_prod) > 1) || editingItem?.use_konversi === true;
                                                                const rate = isKonversi ? (Number(editingItem.isi_prod) || 1) : 1;
                                                                return hist.modalBaru ? formatCurrency(hist.modalBaru * rate) : '-';
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-3 text-gray-400 max-w-xs truncate" title={hist.note}>
                                                            {hist.note || '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/10 bg-white/5 text-right text-xs text-gray-500">
                                Menampilkan riwayat transaksi terakhir saat ini.
                            </div>
                        </div>
                    </div>
                    , document.body)
            }
        </section >
    );
}

// Sub-component for Stock History to keep main file cleaner
function StockHistoryTable() {
    const [history, setHistory] = useState([]);
    const [filter, setFilter] = useState('semua');
    const [filterDate, setFilterDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(10);

    // Custom Dropdown State
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Custom Date Picker State
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const datePickerRef = useRef(null);
    const [viewDate, setViewDate] = useState(new Date()); // For calendar navigation

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
                setIsDatePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper for Custom Date Picker
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleDateClick = (day) => {
        const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        // Format YYYY-MM-DD
        const dateString = date.toLocaleDateString('en-CA');
        setFilterDate(dateString);
        setIsDatePickerOpen(false);
    };

    const clearDate = () => {
        setFilterDate('');
        setIsDatePickerOpen(false);
    };

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate.setMonth(viewDate.getMonth() + offset));
        setViewDate(new Date(newDate));
    };

    // Initial load
    useEffect(() => {
        loadHistory();
    }, []);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(10);
    }, [filter, filterDate]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            // Backend returns all history (ignoring params for now based on controller analysis)
            // But we pass params just in case backend is updated later
            const res = await inventoryAPI.getHistory({
                limit: 1000 // Request a large batch
            });

            if (res.data.pagination) {
                setHistory(res.data.data);
            } else {
                setHistory(Array.isArray(res.data) ? res.data : []);
            }
        } catch (err) {
            console.error('Failed to load history', err);
            toast.error('Gagal memuat riwayat');
        } finally {
            setLoading(false);
        }
    };

    // Client-side Filtering
    const filteredHistory = history.filter(item => {
        const matchType = filter === 'semua' || item.type === filter || (filter === 'in' && item.type === 'restock');
        const matchDate = !filterDate || item.date === filterDate;
        return matchType && matchDate;
    });

    // Client-side Pagination (Slice)
    const displayedHistory = filteredHistory.slice(0, visibleCount);
    const hasMore = visibleCount < filteredHistory.length;

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    return (
        <div className="p-4">
            {/* Filters */}
            <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2 mb-4">
                {/* Custom Date Picker */}
                <div className="relative w-full sm:w-auto" ref={datePickerRef}>
                    <button
                        onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                        className={`w-full sm:w-auto min-w-[140px] flex items-center justify-between bg-white/10 border ${filterDate ? 'border-purple-500 bg-purple-500/10' : 'border-purple-500/30'} rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500 hover:bg-white/20 transition-colors cursor-pointer`}
                    >
                        <span className={filterDate ? 'text-white font-medium' : 'text-gray-400'}>
                            {filterDate ? new Date(filterDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pilih Tanggal'}
                        </span>
                        {filterDate ? (
                            <span onClick={(e) => { e.stopPropagation(); clearDate(); }} className="ml-2 hover:text-red-400">✕</span>
                        ) : (
                            <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        )}
                    </button>

                    {isDatePickerOpen && (
                        <div className="absolute right-0 sm:right-auto sm:left-0 mt-1 w-64 bg-[#1f2937] border border-purple-500/30 rounded-lg shadow-xl z-50 p-4 animate-fade">
                            {/* Calendar Header */}
                            <div className="flex justify-between items-center mb-4">
                                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded">&lt;</button>
                                <span className="font-semibold text-white">
                                    {viewDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                </span>
                                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded">&gt;</button>
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                                {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map(d => (
                                    <div key={d} className="text-gray-500 font-medium">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center">
                                {/* Empty slots for start of month */}
                                {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {/* Days */}
                                {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toLocaleDateString('en-CA');
                                    const isSelected = filterDate === dateStr;
                                    const isToday = new Date().toLocaleDateString('en-CA') === dateStr;

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => handleDateClick(day)}
                                            className={`p-2 rounded-full hover:bg-white/20 text-xs transition-colors
                                                ${isSelected ? 'bg-purple-600 text-white font-bold' : 'text-gray-300'}
                                                ${isToday && !isSelected ? 'border border-purple-500 text-purple-400' : ''}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/10 flex justify-center">
                                <button onClick={() => { setViewDate(new Date()); }} className="text-xs text-purple-400 hover:text-purple-300">
                                    Hari Ini
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="relative w-full sm:w-auto" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full sm:w-32 flex items-center justify-between bg-white/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500 hover:bg-white/20 transition-colors"
                    >
                        <span>
                            {filter === 'semua' ? 'Semua' :
                                filter === 'in' ? 'Masuk' :
                                    filter === 'out' ? 'Keluar' : 'Opname'}
                        </span>
                        <svg className={`w-3 h-3 ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-1 w-full bg-[#1f2937] border border-purple-500/30 rounded-lg shadow-xl z-50 overflow-hidden animate-fade">
                            {['semua', 'in', 'out', 'opname'].map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => { setFilter(opt); setIsDropdownOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-500/20 transition-colors ${filter === opt ? 'text-purple-400 font-medium bg-purple-500/10' : 'text-gray-300'}`}
                                >
                                    {opt === 'semua' ? 'Semua' : opt === 'in' ? 'Masuk' : opt === 'out' ? 'Keluar' : 'Opname'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable Table Container */}
            <div className="border border-white/5 rounded-xl overflow-hidden bg-[#1f2937]/50">
                <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-[#1f2937] shadow-md">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-300">Waktu</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-300">Bahan</th>
                                <th className="px-4 py-3 text-center font-semibold text-gray-300">Tipe</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-300">Jumlah</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-300">Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && history.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto"></div></td></tr>
                            ) : displayedHistory.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Belum ada riwayat yang cocok</td></tr>
                            ) : (
                                displayedHistory.map((item) => (
                                    <tr key={item._id || item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-gray-300">
                                            <div className="font-medium">{item.date}</div>
                                            <div className="text-xs text-gray-500">{item.time}</div>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-white">
                                            <SmartText>{item.ingName}</SmartText>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${item.type === 'in' || item.type === 'restock' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                item.type === 'out' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                }`}>
                                                {item.type === 'in' || item.type === 'restock' ? 'MASUK' :
                                                    item.type === 'out' ? 'KELUAR' :
                                                        item.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono font-bold ${item.type === 'out' ? 'text-red-400' : 'text-emerald-400'
                                            }`}>
                                            {item.type === 'out' ? '-' : '+'}{item.qty}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
                                            <SmartText>{item.note || '-'}</SmartText>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Load More */}
                <div className="p-4 border-t border-white/5 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="text-xs text-gray-400">
                        Menampilkan {displayedHistory.length} dari {filteredHistory.length} data
                    </span>

                    {hasMore && (
                        <button
                            onClick={handleLoadMore}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-purple-900/20 w-full sm:w-auto"
                        >
                            Muat Lebih Banyak ({filteredHistory.length - displayedHistory.length} lagi)
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}






export default Inventaris;
