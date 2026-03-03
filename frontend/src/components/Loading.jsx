import { useState } from 'react';

function Loading() {
    const [isLight] = useState(() => {
        try {
            const tenantData = typeof window !== 'undefined' ? localStorage.getItem('tenant') : null;
            if (tenantData) {
                const tenant = JSON.parse(tenantData);
                return tenant.selectedTheme === 'light-coffee';
            }
        } catch (error) {
            console.error('Error reading theme in Loading:', error);
        }
        return false;
    });

    return (
        <div className={`flex items-center justify-center min-h-screen w-full z-50 fixed inset-0 transition-colors duration-300 ${isLight ? 'bg-[#FDF8F5]' : 'bg-[#0F0A1F]'}`}>
            <div className="text-center">
                <div className={`w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4 ${isLight ? 'border-[#8C6244]' : 'border-purple-500'}`}></div>
                <p className={`text-sm animate-pulse ${isLight ? 'text-[#5D4037]' : 'text-gray-400'}`}>Memuat halaman...</p>
            </div>
        </div>
    );
}

export default Loading;
