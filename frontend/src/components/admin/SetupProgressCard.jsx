import React, { useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../components/TenantRouter'; // Asumsi helper route
import api from '../../services/api';

const fetcher = url => api.get(url).then(res => res.data);

const SetupProgressCard = () => {
    const navigate = useNavigate();
    const { tenantSlug } = useTenant();

    const { data: settingsData } = useSWR('/settings', fetcher);
    const { data: menuData } = useSWR('/menu', fetcher);
    const { data: tablesData } = useSWR('/tables', fetcher);
    const { data: inventoryResponse } = useSWR('/inventory?limit=1', fetcher);
    const { data: recipesData } = useSWR('/recipes', fetcher);

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user?.role === 'admin';

    // Jika bukan admin, jangan tampilkan
    if (!isAdmin) return null;

    const tasks = useMemo(() => {
        if (!settingsData) return [];

        const menuItems = Array.isArray(menuData) ? menuData : [];
        const tables = Array.isArray(tablesData) ? tablesData : [];
        let inventoryData = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : (Array.isArray(inventoryResponse) ? inventoryResponse : []);
        const recipes = Array.isArray(recipesData) ? recipesData : [];

        // Check kondisi setiap task
        return [
            {
                id: 'logo',
                title: 'Upload Logo Usaha',
                desc: 'Upload logo agar struk lebih profesional',
                isCompleted: !!settingsData.logo && !settingsData.logo.includes('Picsart'), // Assuming default contains Picsart
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/pengaturan` : '/admin/pengaturan'),
            },
            {
                id: 'whatsapp',
                title: 'Lengkapi No. WhatsApp',
                desc: 'Agar pelanggan bisa langsung terhubung dengan Anda',
                isCompleted: !!settingsData?.phone && settingsData?.phone !== '',
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/pengaturan` : '/admin/pengaturan'),
            },
            {
                id: 'wajib_bayar',
                title: 'Atur Sistem Kasir',
                desc: 'Pilih tipe pemesanan: Wajib Bayar Dulu (QSR) atau Bayar Nanti (FSR)',
                isCompleted: typeof settingsData?.isCashPrepaymentRequired !== 'undefined', 
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/pengaturan` : '/admin/pengaturan'),
            },
            {
                id: 'menu',
                title: 'Tambah Makanan/Menu Pertama',
                desc: 'Buat daftar menu agar pelanggan bisa memesan',
                isCompleted: menuItems.length > 0,
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/menu` : '/admin/menu'),
            },
            {
                id: 'meja',
                title: 'Tambah Meja (Opsional)',
                desc: 'Setup meja jika Anda melayani Dine-In',
                isCompleted: tables.length > 0,
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/meja` : '/admin/meja'),
            },
            {
                id: 'inventaris',
                title: 'Tambah Bahan Baku',
                desc: 'Catat inventaris untuk mengontrol stok harian',
                isCompleted: inventoryData.length > 0,
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/inventaris` : '/admin/inventaris'),
            },
            {
                id: 'gramasi',
                title: 'Hubungkan Resep & Gramasi',
                desc: 'Setup resep HPP agar stok otomatis terpotong saat pesanan dibuat',
                isCompleted: recipes.length > 0,
                action: () => navigate(tenantSlug ? `/${tenantSlug}/admin/gramasi` : '/admin/gramasi'),
            }
        ];
    }, [settingsData, menuData, tablesData, inventoryResponse, recipesData, navigate, tenantSlug]);

    const completedTasksCount = tasks.filter(t => t.isCompleted).length;
    const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;
    const isCompletedAll = completedTasksCount === tasks.length;

    React.useEffect(() => {
        if (isCompletedAll && settingsData) {
            localStorage.setItem('has_completed_setup', 'true');
            window.dispatchEvent(new Event('setup_status_changed'));
            
            // Hit backend to update status flag
            api.post('/tenant/complete-setup').catch(err => {
                // optional fallback or error log
            });
        }
    }, [isCompletedAll, settingsData]);

    if (!settingsData || isCompletedAll) return null; // Sembunyikan jika isLoading atau semua selesai

    return (
        <div className="glass rounded-xl p-6 mb-6 border border-purple-500/20 max-w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        🚀 Panduan Setup SuperKafe
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">Selesaikan setup berikut agar kafe Anda siap menggunakan fitur secara maksimal.</p>
                </div>
                <div className="flex bg-white/5 rounded-full px-4 py-2 items-center gap-3 border border-white/10 shrink-0">
                    <span className="text-xs font-bold text-gray-300">Progress: {completedTasksCount}/{tasks.length} Selesai</span>
                    <div className="w-24 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tasks.map(task => (
                    <div 
                        key={task.id} 
                        className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                            task.isCompleted 
                            ? 'bg-green-500/5 border-green-500/20 opacity-60 pointer-events-none' 
                            : 'bg-white/5 border-purple-500/20 hover:border-purple-500 cursor-pointer hover:bg-white/10 shadow-lg'
                        }`}
                        onClick={task.isCompleted ? undefined : task.action}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                                task.isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-500'
                            }`}>
                                {task.isCompleted && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${task.isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                                    {task.title}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1.5">{task.desc}</p>
                            </div>
                        </div>
                        {!task.isCompleted && (
                            <div className="mt-3 flex justify-end">
                                <span className="text-xs font-medium text-purple-400 animate-pulse flex items-center gap-1">
                                    Lengkapi <span className="text-lg leading-none">→</span>
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SetupProgressCard;
