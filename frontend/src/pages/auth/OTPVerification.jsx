import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiMail, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { verificationAPI } from '../../services/api';

const OTPVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Get data from navigation state or localStorage
  const email = location.state?.email || localStorage.getItem('pending_email');
  const tenantSlug = location.state?.tenantSlug || localStorage.getItem('tenant_slug');
  const tenantName = location.state?.tenantName || '';

  useEffect(() => {
    // Redirect jika tidak ada email atau tenant slug
    if (!email || !tenantSlug) {
      toast.error('Data verifikasi tidak ditemukan. Silakan daftar ulang.');
      navigate('/auth/register');
    }
  }, [email, tenantSlug, navigate]);

  useEffect(() => {
    // Countdown timer untuk resend OTP
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index, value) => {
    // Hanya terima angka
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus ke input berikutnya
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: pindah ke input sebelumnya
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (!/^\d+$/.test(pastedData)) {
      toast.error('Kode OTP harus berupa angka');
      return;
    }

    const newOtp = pastedData.split('');
    while (newOtp.length < 6) newOtp.push('');
    setOtp(newOtp);

    // Focus ke input terakhir yang terisi
    const lastIndex = Math.min(pastedData.length - 1, 5);
    document.getElementById(`otp-${lastIndex}`)?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      toast.error('Masukkan kode OTP 6 digit');
      return;
    }

    setLoading(true);

    try {
      const response = await verificationAPI.verifyOTP({
        email,
        otpCode,
        tenantSlug
      });

      if (response.data.success) {
        toast.success('Email berhasil diverifikasi!');
        
        // Clear pending data
        localStorage.removeItem('pending_email');
        
        // Redirect ke login
        setTimeout(() => {
          navigate('/auth/login', {
            state: {
              tenant_slug: tenantSlug,
              message: 'Verifikasi berhasil! Silakan login dengan email dan password Anda.'
            }
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error(error.response?.data?.message || 'Verifikasi gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      const response = await verificationAPI.resendOTP({
        email,
        tenantSlug
      });

      if (response.data.success) {
        toast.success('Kode OTP baru telah dikirim ke email Anda');
        setCountdown(60); // 60 detik countdown
        setOtp(['', '', '', '', '', '']); // Reset OTP input
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error(error.response?.data?.message || 'Gagal mengirim ulang OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back Button */}
        <Link
          to="/auth/register"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
        >
          <FiArrowLeft />
          <span>Kembali</span>
        </Link>

        {/* Verification Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <FiMail className="w-10 h-10" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">Verifikasi Email</h1>
          <p className="text-white/60 text-center mb-2">
            Masukkan kode OTP 6 digit yang telah dikirim ke:
          </p>
          <p className="text-purple-400 text-center font-medium mb-8">
            {email}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Input */}
            <div className="flex justify-center gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Info */}
            <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-white/70">
              <p>⏰ Kode OTP berlaku selama 10 menit</p>
              <p className="mt-1">📧 Cek folder spam jika tidak menerima email</p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
          </form>

          {/* Resend OTP */}
          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm mb-2">
              Tidak menerima kode?
            </p>
            <button
              onClick={handleResendOTP}
              disabled={resending || countdown > 0}
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiRefreshCw className={resending ? 'animate-spin' : ''} />
              {countdown > 0 ? `Kirim ulang (${countdown}s)` : 'Kirim ulang kode'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OTPVerification;
