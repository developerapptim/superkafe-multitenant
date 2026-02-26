import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { verificationAPI } from '../../services/api';

const OTPVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Get data from navigation state
  const email = location.state?.email;

  useEffect(() => {
    // Redirect jika tidak ada email
    if (!email) {
      toast.error('Data verifikasi tidak ditemukan. Silakan daftar ulang.');
      navigate('/auth/register');
    }
  }, [email, navigate]);

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
        otpCode
      });

      if (response.data.success) {
        toast.success('Email berhasil diverifikasi!');
        
        // Save token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Simpan tenant data jika ada (termasuk theme)
        if (response.data.tenant) {
          localStorage.setItem('tenant', JSON.stringify(response.data.tenant));
        }
        
        // Redirect ke setup wizard (user belum punya tenant)
        setTimeout(() => {
          navigate('/setup-cafe');
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
        email
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back Button */}
        <Link
          to="/auth/register"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <FiArrowLeft />
          <span>Kembali</span>
        </Link>

        {/* Verification Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
          {/* Icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-700 to-amber-800 rounded-2xl flex items-center justify-center">
              <FiMail className="w-10 h-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Verifikasi Email</h1>
          <p className="text-gray-600 text-center mb-2">
            Masukkan kode OTP 6 digit yang telah dikirim ke:
          </p>
          <p className="text-amber-700 text-center font-medium mb-8">
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
                  className="w-12 h-14 text-center text-2xl font-bold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all text-gray-900"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700">
              <p>⏰ Kode OTP berlaku selama 10 menit</p>
              <p className="mt-1">📧 Cek folder spam jika tidak menerima email</p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memverifikasi...' : 'Verifikasi'}
            </button>
          </form>

          {/* Resend OTP */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm mb-2">
              Tidak menerima kode?
            </p>
            <button
              onClick={handleResendOTP}
              disabled={resending || countdown > 0}
              className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
