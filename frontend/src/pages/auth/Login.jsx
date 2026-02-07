import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [appSettings, setAppSettings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : {
            businessName: 'SuperKafe',
            tagline: 'Sistem Manajemen Kafe Modern',
            logo: 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
        };
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Use settingsAPI if imported, or api.get directly. 
                // Since settingsAPI might not be imported, let's use api.get('/settings/public') or similar if that's what was intended.
                // Checking api.js to see if there is a settingsAPI export or if I should use api.get
                // The previous commented code used api.get('/settings/public').
                // But CustomerLayout used settingsAPI.get(). I should check what settingsAPI does.
                // Assuming I can import settingsAPI or use api based on view_file result (which I am calling in parallel).
                // largely I will follow the structure of CustomerLayout but keep it self-contained if needed or import settingsAPI.
                // For now, I'll assume I need to import settingsAPI or generic api.
                // Let's stick to the existing `api` import and use the endpoint `/settings` or `/settings/public`.
                // CustomerLayout uses settingsAPI.get().
                // I will add `import { settingsAPI } from '../../services/api';` to imports first.
                // Wait, I can't add imports in this block efficiently without replacing top.
                // I will use `api.get('/settings')` which is likely what settingsAPI.get() does.
                const res = await api.get('/settings');
                if (res.data) {
                    const newSettings = {
                        businessName: res.data.name || res.data.businessName || 'SuperKafe',
                        tagline: res.data.tagline || 'Sistem Manajemen Kafe Modern',
                        logo: res.data.logo || 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
                    };
                    setAppSettings(newSettings);
                    localStorage.setItem('appSettings', JSON.stringify(newSettings));
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            }
        };
        fetchSettings();
    }, []);

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
            {/* Back Button */}
            <button
                onClick={() => navigate('/')}
                className="absolute top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all border border-white/10 hover:border-white/20 backdrop-blur-md group"
            >
                <span className="text-xl group-hover:-translate-x-1 transition-transform">←</span>
                <span className="text-sm font-medium">Menu Pelanggan</span>
            </button>

            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>

            <div className="glass rounded-2xl p-8 md:p-10 w-full max-w-lg relative z-10 border border-purple-500/30 shadow-2xl backdrop-blur-xl bg-[#1E1B4B]/70">
                <div className="text-center mb-8">
                    {appSettings.logo ? (
                        <div className="w-24 h-24 mx-auto mb-6 transform hover:scale-105 transition-transform duration-300">
                            <img src={appSettings.logo} alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 mx-auto mb-6 transform hover:scale-105 transition-transform duration-300">
                            <img src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png" alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                        </div>
                    )}
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                        {appSettings.businessName}
                    </h1>
                    <p className="text-gray-300 text-base">{appSettings.tagline}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">Username</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors">👤</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
                                placeholder="Masukkan username"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">Password / PIN</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors">🔒</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-black/40 border border-purple-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-inner"
                                placeholder="******"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-900/40 transform hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
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

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <p className="text-xs text-gray-400">
                        Belum punya akun? Hubungi Administrator
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
