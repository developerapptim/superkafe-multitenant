import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!username || !password) {
            toast.error('Username dan password wajib diisi');
            return;
        }

        setIsLoading(true);
        const toastId = toast.loading('Memproses login...');

        try {
            // Adjust API URL based on your proxy setup or direct
            const response = await api.post('/auth/login', {
                ...
                username,
                password
            });

            const { token, user } = response.data;

            // Save to localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            toast.success(`Selamat datang, ${user.name}!`, { id: toastId });

            // Redirect based on role? Or just to dashboard
            navigate('/admin/dashboard');

        } catch (err) {
            console.error('Login error:', err);
            const msg = err.response?.data?.error || 'Gagal login, periksa koneksi';
            toast.error(msg, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0F0A1F] relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>

            <div className="glass rounded-2xl p-8 w-full max-w-md relative z-10 border border-purple-500/20 shadow-2xl backdrop-blur-xl bg-[#1E1B4B]/60">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2,21H20V19H2M20,8H18V5H20M20,3H4V13A4,4 0 0,0 8,17H14A4,4 0 0,0 18,13V10H20A2,2 0 0,0 22,8V5C22,3.89 21.1,3 20,3Z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-1">
                        Warkop Santai
                    </h1>
                    <p className="text-gray-400 text-sm">Sistem Manajemen Warkop Modern</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2 ml-1">Username</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">👤</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/20 border border-purple-500/30 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                placeholder="Masukkan username"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2 ml-1">Password / PIN</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔒</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/20 border border-purple-500/30 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                placeholder="******"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-900/40 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Memproses...</span>
                            </div>
                        ) : (
                            '🚀 Masuk Dashboard'
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-xs text-gray-500">
                        Belum punya akun? Hubungi Administrator
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] text-gray-600 bg-black/20 p-2 rounded-lg">
                        <span className="bg-purple-900/30 text-purple-400 px-2 py-1 rounded">Admin: password</span>
                        <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded">Kasir: 123456</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
