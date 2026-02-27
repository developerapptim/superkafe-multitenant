import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CustomSelect from '../../components/CustomSelect';
import toast from 'react-hot-toast';
import useSWR, { mutate } from 'swr';
import api, { employeesAPI, payrollAPI, debtsAPI } from '../../services/api';
import { useRefresh } from '../../context/RefreshContext';

// Fetchers
const employeesFetcher = () => employeesAPI.getAll().then(res => res.data);

function Pegawai() {
    // ===== STATE =====
    const [activeTab, setActiveTab] = useState('employees'); // employees, payroll
    const [showModal, setShowModal] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [payrollMonth, setPayrollMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedEmployeePayroll, setSelectedEmployeePayroll] = useState(null);
    const [payrollData, setPayrollData] = useState(null);
    const [loadingPayroll, setLoadingPayroll] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        role: 'kasir',
        phone: '',
        address: '',
        salary: '',
        role_access: [],
        status: 'active',
        pin: ''
    });

    const { data: employeesData } = useSWR('/employees', employeesFetcher);

    const employees = useMemo(() => Array.isArray(employeesData) ? employeesData : [], [employeesData]);
    const isLoading = !employeesData;

    const { registerRefreshHandler } = useRefresh();

    useEffect(() => {
        return registerRefreshHandler(async () => {
            await mutate('/employees');
        });
    }, [registerRefreshHandler]);

    // Simplified roles: Admin (full access) or Staf (operational access)
    const roles = [
        { value: 'staf', label: '👷 Staf' },
        { value: 'admin', label: '🔑 Admin / Pemilik' }
    ];

    // ===== HELPERS =====
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const getRoleLabel = (role) => {
        const found = roles.find(r => r.value === role);
        return found ? found.label : role;
    };

    // ===== EMPLOYEE CRUD =====
    const openAddModal = () => {
        setEditingEmployee(null);
        setFormData({
            name: '', role: 'staf', phone: '', address: '',
            salary: '',
            status: 'active', pin: ''
        });
        setShowModal(true);
    };

    const openEditModal = (emp) => {
        setEditingEmployee(emp);
        // Map old roles to new simplified roles
        let mappedRole = emp.role || 'staf';
        if (['kasir', 'barista', 'waiter', 'kitchen', 'manager'].includes(mappedRole)) {
            mappedRole = 'staf';
        }
        setFormData({
            name: emp.name || '',
            role: mappedRole,
            phone: emp.phone || '',
            address: emp.address || '',
            salary: emp.salary || '',
            status: emp.status || 'active',
            pin: ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            toast.error('Nama pegawai wajib diisi');
            return;
        }



        const toastId = toast.loading('Menyimpan data pegawai...');
        try {
            const payload = { ...formData };
            // Auto-assign role_access based on role
            if (payload.role === 'admin') {
                payload.role_access = ['*']; // Full access marker
            } else {
                // Staf: limited operational access
                payload.role_access = ['Dashboard', 'POS', 'Meja', 'Menu', 'Pelanggan', 'Inventori', 'Gramasi'];
            }
            // Map pin to pin_code for backend compatibility
            if (payload.pin) {
                payload.pin_code = payload.pin;
            }
            delete payload.pin;


            if (editingEmployee) {
                await employeesAPI.update(editingEmployee.id, payload);
            } else {
                await employeesAPI.create({
                    ...payload,
                    id: `emp_${Date.now()}`,
                    salary: Number(payload.salary) || 0
                });
            }
            mutate('/employees');
            setShowModal(false);
            toast.success('Data pegawai berhasil disimpan', { id: toastId });
        } catch (err) {
            console.error('Error saving employee:', err);
            const msg = err.response?.data?.error || 'Gagal menyimpan data pegawai';
            toast.error(msg, { id: toastId });
        }
    };

    const handleDelete = (id) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="font-medium">Hapus pegawai ini?</p>
                <div className="flex gap-2 justify-end">
                    <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-500">Batal</button>
                    <button onClick={() => confirmDelete(id, t.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500">Hapus</button>
                </div>
            </div>
        ), { duration: 5000, icon: '🗑️' });
    };

    const confirmDelete = async (id, toastId) => {
        toast.dismiss(toastId);
        const loadingToast = toast.loading('Menghapus pegawai...');
        try {
            await employeesAPI.delete(id);
            mutate('/employees');
            toast.success('Pegawai berhasil dihapus', { id: loadingToast });
        } catch (err) {
            toast.error('Gagal menghapus pegawai', { id: loadingToast });
        }
    };

    const handleResetSessions = async () => {
        setShowResetConfirm(false);
        const toastId = toast.loading('Mereset sesi...');
        try {
            await api.post('/users/reset-sessions');
            toast.success('Sesi staff berhasil di-reset', { id: toastId });
        } catch (e) {
            toast.error('Gagal reset sesi', { id: toastId });
        }
    };


    // ===== PAYROLL =====
    const calculatePayroll = async (empId) => {
        setSelectedEmployeePayroll(empId);
        setLoadingPayroll(true);

        const [year, month] = payrollMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        try {
            const res = await payrollAPI.calculate(empId, startDate, endDate);
            setPayrollData(res.data);
        } catch (err) {
            toast.error('Gagal menghitung gaji');
            setPayrollData(null);
        } finally {
            setLoadingPayroll(false);
        }
    };

    // ===== RENDER =====
    if (isLoading) {
        return (
            <section className="p-4 md:p-6 space-y-6">

                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header / Top Bar */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">


                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center gap-2 transition-all font-medium"
                    >
                        ⚡ Reset Sesi
                    </button>
                    <button
                        onClick={openAddModal}
                        className="flex-1 md:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 flex items-center justify-center gap-2 font-bold shadow-lg shadow-purple-500/30 transition-all transform hover:scale-105"
                    >
                        ➕ Tambah Pegawai
                    </button>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex flex-col sm:flex-row gap-1 bg-white/5 p-1 rounded-xl">
                {[
                    { id: 'employees', label: '👥 Daftar Pegawai' },
                    { id: 'payroll', label: '💰 Rekap Gaji' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-3 sm:py-2 px-4 rounded-lg font-medium transition-all ${activeTab === tab.id
                            ? 'bg-purple-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'employees' && (
                <div className="space-y-4">
                    {/* Employee Table */}
                    <div className="glass rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] md:min-w-0">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="text-left p-3 font-medium text-gray-400">Nama</th>
                                        <th className="text-left p-3 font-medium text-gray-400">Posisi</th>
                                        <th className="text-left p-3 font-medium text-gray-400 hidden md:table-cell">Telepon</th>
                                        <th className="text-left p-3 font-medium text-gray-400">Status</th>
                                        <th className="text-right p-3 font-medium text-gray-400">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-gray-500">
                                                Belum ada data pegawai
                                            </td>
                                        </tr>
                                    ) : employees.map(emp => (
                                        <tr key={emp.id} className="border-t border-white/5 hover:bg-white/5">
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
                                                        {emp.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium">{emp.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-gray-400">{getRoleLabel(emp.role)}</td>
                                            <td className="p-3 text-gray-400 hidden md:table-cell">{emp.phone || '-'}</td>
                                            <td className="p-3 text-gray-400 hidden lg:table-cell">{formatCurrency(emp.daily_rate)}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs ${emp.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {emp.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => openEditModal(emp)} className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm">✏️</button>
                                                    <button onClick={() => handleDelete(emp.id)} className="px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm">🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}



            {activeTab === 'payroll' && (
                <div className="space-y-4">
                    {/* Month Selector */}
                    <div className="flex gap-4 items-center flex-wrap">
                        <label className="text-gray-400">Bulan:</label>
                        <input
                            type="month"
                            value={payrollMonth}
                            onChange={(e) => setPayrollMonth(e.target.value)}
                            className="px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        />
                    </div>

                    {/* Employee Selection for Payroll */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {employees.filter(e => e.status === 'active').map(emp => (
                            <div
                                key={emp.id}
                                onClick={() => calculatePayroll(emp.id)}
                                className={`glass rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all ${selectedEmployeePayroll === emp.id ? 'ring-2 ring-purple-500' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold">
                                        {emp.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-medium">{emp.name}</h3>
                                        <p className="text-sm text-gray-400">{getRoleLabel(emp.role)}</p>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>

                    {/* Payroll Result */}
                    {loadingPayroll && (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                        </div>
                    )}

                    {payrollData && !loadingPayroll && (
                        <div className="glass rounded-xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold">📊 Slip Gaji - {payrollData.employee.name}</h3>
                                <button
                                    onClick={() => window.print()}
                                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                >
                                    🖨️ Cetak
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Hari Kerja</p>
                                    <p className="text-2xl font-bold text-green-400">{payrollData.summary?.days_present || 0}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Hari Telat</p>
                                    <p className="text-2xl font-bold text-yellow-400">{payrollData.summary?.days_late || 0}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Gaji Kotor</p>
                                    <p className="text-xl font-bold">{formatCurrency(payrollData.summary?.base_pay || 0)}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Potongan Kasbon</p>
                                    <p className="text-xl font-bold text-red-400">-{formatCurrency(payrollData.summary?.kasbon_deduction || 0)}</p>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-medium">Total Gaji Bersih:</span>
                                    <span className="text-3xl font-bold text-green-400">{formatCurrency(payrollData.summary?.net_pay || 0)}</span>
                                </div>
                            </div>

                            {payrollData.kasbon_details?.length > 0 && (
                                <div className="bg-red-500/10 rounded-lg p-4">
                                    <h4 className="font-medium text-red-400 mb-2">Detail Kasbon:</h4>
                                    <ul className="space-y-1 text-sm">
                                        {payrollData.kasbon_details.map(k => (
                                            <li key={k.id} className="flex justify-between">
                                                <span className="text-gray-400">{k.description || 'Kasbon'}</span>
                                                <span className="text-red-400">{formatCurrency(k.amount)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Employee Modal */}
            {showModal && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">
                                {editingEmployee ? '✏️ Edit Pegawai' : '➕ Tambah Pegawai'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400">✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm text-gray-400 mb-1">Nama *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                        placeholder="Nama lengkap"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Posisi</label>
                                    <CustomSelect
                                        value={formData.role}
                                        options={roles.map(r => ({ value: r.value, label: r.label }))}
                                        onChange={(val) => setFormData({ ...formData, role: val })}
                                        placeholder="Pilih Posisi"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                                    <CustomSelect
                                        value={formData.status}
                                        options={[
                                            { value: 'active', label: 'Aktif' },
                                            { value: 'inactive', label: 'Nonaktif' }
                                        ]}
                                        onChange={(val) => setFormData({ ...formData, status: val })}
                                        placeholder="Pilih Status"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">No. HP</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                        placeholder="081234567890"
                                    />
                                </div>



                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Gaji Bulanan</label>
                                    <input
                                        type="number"
                                        value={formData.salary}
                                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                        placeholder="0"
                                    />
                                </div>



                                <div className="col-span-2">
                                    <label className="block text-sm text-gray-400 mb-1">Alamat</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                        placeholder="Alamat rumah"
                                    />
                                </div>
                            </div>

                            {/* Auto-assigned access info */}
                            <div className="p-3 bg-white/5 rounded-xl border border-purple-500/20">
                                <p className="text-sm text-gray-400">
                                    {formData.role === 'admin' ? (
                                        <span className="text-green-400">✅ Admin memiliki akses ke <strong>semua menu</strong></span>
                                    ) : (
                                        <span>👷 Staf hanya dapat mengakses: Dashboard, Kasir, Meja, Menu, Pelanggan, Inventaris (terbatas), dan Gramasi (tanpa harga)</span>
                                    )}
                                </p>
                            </div>

                            {/* Login Credentials - PIN Only for Shared Tablet */}
                            <div className="p-4 bg-purple-900/20 rounded-xl border border-purple-500/20 space-y-3">
                                <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">🔐 PIN Login (Tablet Kasir)</h4>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        PIN (6 Digit) {editingEmployee && <span className="text-xs text-gray-500 ml-1">(Kosongkan jika tidak ubah)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        value={formData.pin}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                            setFormData({ ...formData, pin: val });
                                        }}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white tracking-[0.5em] text-center text-lg font-mono"
                                        placeholder={editingEmployee ? '••••••' : '000000'}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">PIN digunakan untuk login cepat di Tablet Kasir (Lock Screen)</p>
                                </div>
                            </div>


                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20">Batal</button>
                                <button type="submit" className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold">💾 Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}



            {/* Reset Confirmation Modal */}
            {showResetConfirm && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-sm animate-scale-up text-center border-2 border-red-500/30 shadow-[0_0_50px_-10px_rgba(239,68,68,0.3)]">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            ⚠️
                        </div>
                        <h3 className="text-xl font-bold mb-2">Reset Semua Sesi?</h3>
                        <p className="text-gray-400 mb-6 text-sm">
                            Tindakan ini akan memaksa <strong>LOGOUT</strong> semua staff yang sedang aktif. Gunakan hanya jika diperlukan.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-medium transition-all"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleResetSessions}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02]"
                            >
                                Ya, Reset!
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </section>
    );
}

export default Pegawai;
