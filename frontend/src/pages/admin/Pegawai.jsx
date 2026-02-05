import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CustomSelect from '../../components/CustomSelect';
import toast from 'react-hot-toast';
import useSWR, { mutate } from 'swr';
import api, { employeesAPI, attendanceAPI, payrollAPI, debtsAPI } from '../../services/api';

// Fetchers
const employeesFetcher = () => employeesAPI.getAll().then(res => res.data);
const attendanceFetcher = ([, params]) => attendanceAPI.getAll(params).then(res => res.data);
const todayAttendanceFetcher = () => attendanceAPI.getToday().then(res => res.data);

function Pegawai() {
    // ===== STATE =====
    const [activeTab, setActiveTab] = useState('employees'); // employees, attendance, payroll
    const [showKioskMode, setShowKioskMode] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [payrollMonth, setPayrollMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedEmployeePayroll, setSelectedEmployeePayroll] = useState(null);
    const [payrollData, setPayrollData] = useState(null);
    const [loadingPayroll, setLoadingPayroll] = useState(false);

    // Kiosk state
    const [pinInput, setPinInput] = useState('');
    const [kioskStep, setKioskStep] = useState('pin'); // pin, action
    const [verifiedEmployee, setVerifiedEmployee] = useState(null);

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        role: 'kasir',
        phone: '',
        address: '',
        salary: '',
        daily_rate: '',
        pin_code: '',
        role_access: [],
        status: 'active',
        username: '',
        password: ''
    });

    // ===== DATA FETCHING =====
    const { data: employeesData } = useSWR('/employees', employeesFetcher);
    const { data: todayAttendance } = useSWR('/attendance/today', todayAttendanceFetcher);
    const { data: dateAttendance } = useSWR(
        ['attendance', { date: attendanceDate }],
        attendanceFetcher
    );

    const employees = useMemo(() => Array.isArray(employeesData) ? employeesData : [], [employeesData]);
    const isLoading = !employeesData;

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
            salary: '', daily_rate: '', pin_code: '',
            status: 'active', username: '', password: ''
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
            daily_rate: emp.daily_rate || '',
            pin_code: emp.pin_code || '',
            status: emp.status || 'active',
            username: emp.username || '',
            password: ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            toast.error('Nama pegawai wajib diisi');
            return;
        }

        // PIN validation
        if (formData.pin_code && formData.pin_code.length !== 6) {
            toast.error('PIN harus 6 digit');
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
            if (!payload.username?.trim()) delete payload.username;
            if (!payload.password) delete payload.password;


            if (editingEmployee) {
                await employeesAPI.update(editingEmployee.id, payload);
            } else {
                await employeesAPI.create({
                    ...payload,
                    id: `emp_${Date.now()}`,
                    salary: Number(payload.salary) || 0,
                    daily_rate: Number(payload.daily_rate) || 0
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

    // ===== KIOSK MODE =====
    const handleNumpadClick = (num) => {
        if (pinInput.length < 6) {
            setPinInput(prev => prev + num);
        }
    };

    const handleNumpadClear = () => {
        setPinInput('');
    };

    const handleNumpadBackspace = () => {
        setPinInput(prev => prev.slice(0, -1));
    };

    const handlePinSubmit = async () => {
        if (pinInput.length !== 6) {
            toast.error('PIN harus 6 digit');
            return;
        }

        const toastId = toast.loading('Memverifikasi PIN...');
        try {
            const res = await employeesAPI.verifyPin(pinInput);
            setVerifiedEmployee(res.data);
            setKioskStep('action');
            toast.success(`Halo, ${res.data.employee.name}!`, { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.error || 'PIN tidak valid', { id: toastId });
            setPinInput('');
        }
    };

    const handleClockIn = async () => {
        const toastId = toast.loading('Mencatat absen masuk...');
        try {
            const res = await attendanceAPI.clockIn(verifiedEmployee.employee.id);
            toast.success(res.data.message, { id: toastId });
            mutate('/attendance/today');
            resetKiosk();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal absen masuk', { id: toastId });
        }
    };

    const handleClockOut = async () => {
        const toastId = toast.loading('Mencatat absen pulang...');
        try {
            const res = await attendanceAPI.clockOut(verifiedEmployee.employee.id);
            toast.success(res.data.message, { id: toastId });
            mutate('/attendance/today');
            resetKiosk();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal absen pulang', { id: toastId });
        }
    };

    const resetKiosk = () => {
        setPinInput('');
        setKioskStep('pin');
        setVerifiedEmployee(null);
    };

    const closeKiosk = () => {
        setShowKioskMode(false);
        resetKiosk();
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

    // ===== ATTENDANCE EDIT =====
    const [editingAttendance, setEditingAttendance] = useState(null);
    const [attendanceForm, setAttendanceForm] = useState({ clock_in_time: '', clock_out_time: '', status: 'hadir', notes: '' });

    const openAttendanceEdit = (att) => {
        setEditingAttendance(att);
        setAttendanceForm({
            clock_in_time: att.clock_in_time || '',
            clock_out_time: att.clock_out_time || '',
            status: att.status || 'hadir',
            notes: att.notes || ''
        });
    };

    const saveAttendanceEdit = async () => {
        if (!editingAttendance) return;
        const toastId = toast.loading('Menyimpan perubahan...');
        try {
            await attendanceAPI.update(editingAttendance.id, attendanceForm);
            mutate(['attendance', { date: attendanceDate }]);
            mutate('/attendance/today');
            toast.success('Absensi diperbarui', { id: toastId });
            setEditingAttendance(null);
        } catch (err) {
            toast.error('Gagal menyimpan', { id: toastId });
        }
    };

    // ===== RENDER =====
    if (isLoading) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold hidden md:block">👥 Manajemen Pegawai</h2>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="text-2xl font-bold hidden md:block">👥 Manajemen Pegawai</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium flex items-center justify-center gap-2"
                    >
                        🔄 Reset Sesi
                    </button>
                    <button
                        onClick={() => setShowKioskMode(true)}
                        className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium flex items-center justify-center gap-2"
                    >
                        ⏰ Mode Absensi
                    </button>
                    <button
                        onClick={openAddModal}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                        ➕ Tambah Pegawai
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-col sm:flex-row gap-1 bg-white/5 p-1 rounded-xl">
                {[
                    { id: 'employees', label: '👥 Daftar Pegawai' },
                    { id: 'attendance', label: '📋 Riwayat Absensi' },
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
                                        <th className="text-left p-3 font-medium text-gray-400 hidden lg:table-cell">Gaji Harian</th>
                                        <th className="text-left p-3 font-medium text-gray-400">Status</th>
                                        <th className="text-left p-3 font-medium text-gray-400">PIN</th>
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
                                            <td className="p-3 text-gray-400 font-mono">{emp.pin_code ? '••••••' : '-'}</td>
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

            {activeTab === 'attendance' && (
                <div className="space-y-4">
                    {/* Date Filter */}
                    <div className="flex gap-4 items-center">
                        <label className="text-gray-400">Tanggal:</label>
                        <input
                            type="date"
                            value={attendanceDate}
                            onChange={(e) => setAttendanceDate(e.target.value)}
                            className="px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        />
                        <button
                            onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                            className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                        >
                            Hari Ini
                        </button>
                    </div>

                    {/* Attendance Table */}
                    <div className="glass rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="text-left p-3 font-medium text-gray-400">Nama</th>
                                    <th className="text-left p-3 font-medium text-gray-400">Jam Masuk</th>
                                    <th className="text-left p-3 font-medium text-gray-400">Jam Pulang</th>
                                    <th className="text-left p-3 font-medium text-gray-400">Status</th>
                                    <th className="text-left p-3 font-medium text-gray-400">Catatan</th>
                                    <th className="text-right p-3 font-medium text-gray-400">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(!dateAttendance || dateAttendance.length === 0) ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-500">
                                            Tidak ada data absensi untuk tanggal ini
                                        </td>
                                    </tr>
                                ) : dateAttendance.map(att => (
                                    <tr key={att.id} className="border-t border-white/5 hover:bg-white/5">
                                        <td className="p-3 font-medium">{att.employee_name}</td>
                                        <td className="p-3 text-green-400">{att.clock_in_time || '-'}</td>
                                        <td className="p-3 text-red-400">{att.clock_out_time || '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs ${att.status === 'hadir' ? 'bg-green-500/20 text-green-400' :
                                                att.status === 'telat' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {att.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-gray-400 text-sm">{att.notes || '-'}</td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => openAttendanceEdit(att)}
                                                className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm"
                                            >
                                                ✏️ Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                <div className="mt-2 text-sm text-gray-400">
                                    Gaji Harian: {formatCurrency(emp.daily_rate)}
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
                                    <p className="text-2xl font-bold text-green-400">{payrollData.summary.days_present}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Hari Telat</p>
                                    <p className="text-2xl font-bold text-yellow-400">{payrollData.summary.days_late}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Gaji Kotor</p>
                                    <p className="text-xl font-bold">{formatCurrency(payrollData.summary.base_pay)}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm text-gray-400">Potongan Kasbon</p>
                                    <p className="text-xl font-bold text-red-400">-{formatCurrency(payrollData.summary.kasbon_deduction)}</p>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-medium">Total Gaji Bersih:</span>
                                    <span className="text-3xl font-bold text-green-400">{formatCurrency(payrollData.summary.net_pay)}</span>
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
                                    <label className="block text-sm text-gray-400 mb-1">PIN Absensi (6 digit)</label>
                                    <input
                                        type="text"
                                        value={formData.pin_code}
                                        onChange={(e) => setFormData({ ...formData, pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white font-mono tracking-widest"
                                        placeholder="••••••"
                                        maxLength={6}
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

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Gaji Harian</label>
                                    <input
                                        type="number"
                                        value={formData.daily_rate}
                                        onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
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

                            {/* Login Credentials */}
                            {/* Login Credentials - Now available for all roles */}
                            <div className="p-4 bg-purple-900/20 rounded-xl border border-purple-500/20 space-y-3">
                                <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">🔐 Login Access</h4>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Username {formData.role !== 'admin' && <span className="text-xs text-gray-500">(Wajib untuk login Dashboard)</span>}</label>
                                    <input
                                        type="text"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                        placeholder="Username login"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        Password {formData.role !== 'admin' && <span className="text-xs text-gray-500">(Opsional, bisa pakai PIN)</span>}
                                        {editingEmployee && <span className="text-xs text-gray-500 ml-1">(Kosongkan jika tidak ubah)</span>}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white pr-10"
                                            placeholder={editingEmployee ? "******" : "Password"}
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                                            {showPassword ? '👁️' : '🔒'}
                                        </button>
                                    </div>
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

            {/* Attendance Edit Modal */}
            {editingAttendance && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">✏️ Edit Absensi</h3>
                        <p className="text-gray-400 mb-4">{editingAttendance.employee_name} - {editingAttendance.date}</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Jam Masuk</label>
                                    <input
                                        type="time"
                                        value={attendanceForm.clock_in_time}
                                        onChange={(e) => setAttendanceForm({ ...attendanceForm, clock_in_time: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Jam Pulang</label>
                                    <input
                                        type="time"
                                        value={attendanceForm.clock_out_time}
                                        onChange={(e) => setAttendanceForm({ ...attendanceForm, clock_out_time: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Status</label>
                                <CustomSelect
                                    value={attendanceForm.status}
                                    options={[
                                        { value: 'hadir', label: 'Hadir' },
                                        { value: 'telat', label: 'Telat' },
                                        { value: 'izin', label: 'Izin' },
                                        { value: 'alpha', label: 'Alpha' }
                                    ]}
                                    onChange={(val) => setAttendanceForm({ ...attendanceForm, status: val })}
                                    placeholder="Pilih Status"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Catatan</label>
                                <input
                                    type="text"
                                    value={attendanceForm.notes}
                                    onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                    placeholder="Catatan opsional"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setEditingAttendance(null)} className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20">Batal</button>
                                <button onClick={saveAttendanceEdit} className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 font-bold">💾 Simpan</button>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* Kiosk Mode Modal */}
            {showKioskMode && createPortal(
                <div className="fixed inset-0 bg-black/95 backdrop-blur-lg z-50 flex items-center justify-center">
                    <button
                        onClick={closeKiosk}
                        className="absolute top-4 right-4 w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-2xl text-red-400"
                    >
                        ✕
                    </button>

                    {kioskStep === 'pin' && (
                        <div className="text-center space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">⏰ Absensi Pegawai</h2>
                                <p className="text-gray-400">Masukkan PIN 6 digit Anda</p>
                            </div>

                            {/* PIN Display */}
                            <div className="flex justify-center gap-3">
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <div
                                        key={i}
                                        className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold ${pinInput.length > i ? 'border-purple-500 bg-purple-500/20' : 'border-gray-700 bg-white/5'
                                            }`}
                                    >
                                        {pinInput.length > i ? '•' : ''}
                                    </div>
                                ))}
                            </div>

                            {/* Numpad */}
                            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => handleNumpadClick(String(num))}
                                        className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 text-3xl font-bold transition-all active:scale-95"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    onClick={handleNumpadClear}
                                    className="w-20 h-20 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-xl font-bold text-red-400"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => handleNumpadClick('0')}
                                    className="w-20 h-20 rounded-2xl bg-white/10 hover:bg-white/20 text-3xl font-bold transition-all active:scale-95"
                                >
                                    0
                                </button>
                                <button
                                    onClick={handleNumpadBackspace}
                                    className="w-20 h-20 rounded-2xl bg-yellow-500/20 hover:bg-yellow-500/30 text-xl font-bold text-yellow-400"
                                >
                                    ⌫
                                </button>
                            </div>

                            <button
                                onClick={handlePinSubmit}
                                disabled={pinInput.length !== 6}
                                className="px-12 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Verifikasi →
                            </button>
                        </div>
                    )}

                    {kioskStep === 'action' && verifiedEmployee && (
                        <div className="text-center space-y-8">
                            <div>
                                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-4xl font-bold mb-4">
                                    {verifiedEmployee.employee.name?.charAt(0).toUpperCase()}
                                </div>
                                <h2 className="text-3xl font-bold">Halo, {verifiedEmployee.employee.name}!</h2>
                                <p className="text-gray-400">{getRoleLabel(verifiedEmployee.employee.role)}</p>
                            </div>

                            <div className="flex gap-6 justify-center">
                                <button
                                    onClick={handleClockIn}
                                    disabled={verifiedEmployee.hasClockIn}
                                    className="px-12 py-6 rounded-2xl bg-green-500/20 hover:bg-green-500/30 text-green-400 font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <div className="text-4xl mb-2">🌅</div>
                                    MASUK SHIFT
                                    {verifiedEmployee.hasClockIn && <div className="text-sm mt-1 text-gray-500">Sudah absen</div>}
                                </button>
                                <button
                                    onClick={handleClockOut}
                                    disabled={!verifiedEmployee.hasClockIn || verifiedEmployee.hasClockOut}
                                    className="px-12 py-6 rounded-2xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <div className="text-4xl mb-2">🌇</div>
                                    PULANG SHIFT
                                    {verifiedEmployee.hasClockOut && <div className="text-sm mt-1 text-gray-500">Sudah absen</div>}
                                </button>
                            </div>

                            <button
                                onClick={resetKiosk}
                                className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400"
                            >
                                ← Kembali
                            </button>
                        </div>
                    )}
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
