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
        
        // Redirect ke admin dashboard via legacy route (will redirect to tenant-specific)
        setTimeout(() => {
          navigate('/admin');
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900 text-center">
          <div className="w-16 h-16 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1771859487/SuperKafe_i51g7i.png" 
              alt="SuperKafe Logo" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-gray-900">{tenantName}</h1>
          <p className="text-gray-600">Pilih staff atau login sebagai admin</p>
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
                    className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-amber-700 hover:shadow-lg transition-all"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {/* Avatar */}
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center text-2xl font-bold text-white">
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
                        <p className="font-semibold text-gray-900">{staff.name}</p>
                        <p className="text-xs text-gray-600 capitalize">{staff.role}</p>
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
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl hover:border-amber-700 hover:shadow-lg transition-all text-gray-900"
                >
                  <FiShield />
                  <span>Login Admin</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUnbindDevice}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-red-200 rounded-xl hover:border-red-500 hover:shadow-lg transition-all text-red-600"
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
              <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-700 to-amber-800 flex items-center justify-center text-xl font-bold flex-shrink-0 text-white">
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
                    <p className="font-semibold text-lg text-gray-900">{selectedStaff.name}</p>
                    <p className="text-sm text-gray-600 capitalize">{selectedStaff.role}</p>
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
                className="w-full mt-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-amber-700 hover:shadow-lg transition-all text-gray-900"
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
