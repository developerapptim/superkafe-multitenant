import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Google Sign-In Button Component
 * 
 * Menggunakan Google Identity Services (One Tap & Button)
 * Docs: https://developers.google.com/identity/gsi/web/guides/overview
 */

const GoogleSignInButton = ({ tenantSlug, onSuccess, mode = 'signin' }) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = () => {
    setLoading(true);

    // Validasi tenant slug
    if (!tenantSlug) {
      toast.error('Tenant slug wajib diisi terlebih dahulu');
      setLoading(false);
      return;
    }

    // Initialize Google Identity Services
    if (typeof window.google === 'undefined') {
      toast.error('Google Sign-In belum siap. Silakan refresh halaman.');
      setLoading(false);
      return;
    }

    // Initialize Google OAuth
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'email profile',
      callback: async (response) => {
        try {
          if (response.error) {
            console.error('Google OAuth Error:', response);
            toast.error('Login dengan Google gagal');
            setLoading(false);
            return;
          }

          // Kirim token ke backend
          const backendResponse = await api.post('/auth/google', {
            idToken: response.access_token,
            tenantSlug: tenantSlug.toLowerCase()
          });

          if (backendResponse.data.success) {
            // Simpan token dan user data
            localStorage.setItem('token', backendResponse.data.token);
            localStorage.setItem('user', JSON.stringify(backendResponse.data.user));
            localStorage.setItem('tenant_slug', tenantSlug.toLowerCase());

            // Show success message
            if (backendResponse.data.isNewUser) {
              toast.success('Akun berhasil dibuat dengan Google! Selamat datang!');
            } else {
              toast.success('Login dengan Google berhasil!');
            }

            // Callback untuk parent component
            if (onSuccess) {
              onSuccess(backendResponse.data);
            }
          }
        } catch (error) {
          console.error('Backend auth error:', error);
          
          if (error.response?.status === 404) {
            toast.error('Tenant tidak ditemukan');
          } else if (error.response?.status === 401) {
            toast.error('Google token tidak valid');
          } else {
            toast.error(error.response?.data?.message || 'Login gagal. Silakan coba lagi.');
          }
        } finally {
          setLoading(false);
        }
      },
    });

    // Request access token
    client.requestAccessToken();
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading || !tenantSlug}
      className="w-full py-3 px-4 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-300 shadow-sm"
    >
      <FcGoogle className="w-5 h-5" />
      <span>
        {loading 
          ? 'Memproses...' 
          : mode === 'signup' 
            ? 'Daftar dengan Google' 
            : 'Masuk dengan Google'
        }
      </span>
    </button>
  );
};

export default GoogleSignInButton;
