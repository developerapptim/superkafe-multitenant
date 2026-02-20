import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShield, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Numpad from './Numpad';
import { globalAuthAPI } from '../services/api';

/**
 * Admin Override Modal
 * Untuk verifikasi PIN admin tanpa logout dari akun staff
 */
const AdminOverrideModal = ({ isOpen, onClose, onSuccess, action = 'melakukan aksi ini' }) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePINSubmit = async (pinValue) => {
    setLoading(true);

    try {
      const tenantSlug = localStorage.getItem('tenant_slug');
      
      const response = await globalAuthAPI.verifyAdminPIN({
        tenantSlug,
        pin: pinValue
      });

      if (response.data.success) {
        toast.success(`Diotorisasi oleh ${response.data.adminName}`);
        onSuccess();
        handleClose();
      }
    } catch (error) {
      console.error('Admin PIN verification error:', error);
      
      if (error.response?.status === 401) {
        toast.error('PIN admin tidak valid');
        setPin('');
      } else {
        toast.error(error.response?.data?.error || 'Verifikasi gagal');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="backdrop-blur-xl bg-slate-900/90 border border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <FiShield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Otorisasi Admin</h2>
                    <p className="text-sm text-white/60">Masukkan PIN admin</p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              {/* Info */}
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-white/80">
                  Diperlukan otorisasi admin untuk {action}
                </p>
              </div>

              {/* Numpad */}
              <Numpad
                value={pin}
                onChange={setPin}
                maxLength={6}
                onSubmit={handlePINSubmit}
              />

              {/* Cancel Button */}
              <button
                onClick={handleClose}
                className="w-full mt-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AdminOverrideModal;
