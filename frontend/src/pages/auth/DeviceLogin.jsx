import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShoppingBag, FiUser, FiShield, FiLogOut } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Numpad from '../../components/Numpad';

/**
 * Device Login - Shared Tablet Screen
 * Untuk tablet yang sudah terdaftar ke tenant tertentu
 */
const DeviceLogin = () => {
  const navigate = useNavigate();
  const [tenantSlug, setTenantSlug] = useState(null);
  const [tenantName, setTenantName] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    checkDeviceBinding();
  }, []);

  const checkDeviceBinding = async () => {
    try {
      // Check localStorage untuk tenant_slug
      const savedSlug = localStorage.getItem('tenant_slug');
      
      if (!savedSlug) {
        // Device belum terdaftar, redirect ke global login
        toast.error('Device belum terdaftar. Silakan login dengan email terlebih dahulu.');
        navigate('/auth/login');
        return;
      }

      setTenantSlug(savedSlug);

      // Fetch staff list
      const response = await api.get(`/auth/staff-list/${savedSlug}`);
      
      if (response.data.success) {
        setStaffList(response.data.data);
        setTenantName(response.data.tenantName);
      }
    } catch (error) {
      console.error('Error fetching staff list:', error);
      toast.error('Gagal memuat daftar staff');
      navigate('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffSelect = (staff) => {
    setSelectedStaff(staff);
    setPin('');
  };

  const handlePINSubmit = async (pinValue) => {
    setLoginLoading(true);

    try {
      const response = await api.post('/auth/login-pin', {
        tenantSlug,
        employeeId: selectedStaff.id,
        pin: pinValue
      });

      if (response.data.success) {
        const { token, user } = response.data;

        // Simpan data ke localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        toast.success(`Selamat datang, ${user.name}!`);
        
        // Redirect ke admin dashboard
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 500);
      }
    } catch (error) {
      console.error('PIN login error:', error);
      
      if (error.response?.status === 401) {
        toast.error('PIN salah');
        setPin('');
      } else {
        toast.error(error.response?.data?.error || 'Login gagal');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedStaff(null);
    setPin('');
  };

  const handleAdminLogin = () => {
    navigate('/auth/login');
  };

  const handleUnbindDevice = () => {
    if (confirm('Apakah Anda yakin ingin melepas binding device ini? Anda perlu login dengan email untuk menggunakan device ini lagi.')) {
      localStorage.removeItem('tenant_slug');
      localStorage.removeItem('tenant_name');
      toast.success('Device berhasil di-unbind');
      navigate('/auth/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <FiShoppingBag className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">{tenantName}</h1>
          <p className="text-white/60">Pilih staff atau login sebagai admin</p>
        </div>

        <AnimatePresence mode="wait">
          {!selectedStaff ? (
            /* Staff Selection Screen */
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Staff Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {staffList.map((staff) => (
                  <motion.button
                    key={staff.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleStaffSelect(staff)}
                    className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 hover:bg-white/20 transition-all"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {/* Avatar */}
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold">
                        {staff.image ? (
                          <img
                            src={staff.image}
                            alt={staff.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          staff.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      
                      {/* Name */}
                      <div className="text-center">
                        <p className="font-semibold">{staff.name}</p>
                        <p className="text-xs text-white/60 capitalize">{staff.role}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Admin Login Button */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAdminLogin}
                  className="flex items-center justify-center gap-2 px-6 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all"
                >
                  <FiShield />
                  <span>Login Admin</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUnbindDevice}
                  className="flex items-center justify-center gap-2 px-6 py-3 backdrop-blur-xl bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all text-red-400"
                >
                  <FiLogOut />
                  <span>Unbind Device</span>
                </motion.button>
              </div>
            </motion.div>
          ) : (
            /* PIN Input Screen */
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto"
            >
              {/* Selected Staff Info */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {selectedStaff.image ? (
                      <img
                        src={selectedStaff.image}
                        alt={selectedStaff.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      selectedStaff.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{selectedStaff.name}</p>
                    <p className="text-sm text-white/60 capitalize">{selectedStaff.role}</p>
                  </div>
                </div>
              </div>

              {/* Numpad */}
              <Numpad
                value={pin}
                onChange={setPin}
                maxLength={6}
                onSubmit={handlePINSubmit}
              />

              {/* Back Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleBack}
                className="w-full mt-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              >
                Kembali
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DeviceLogin;
