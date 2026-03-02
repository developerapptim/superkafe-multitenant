import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { useState } from 'react';

const ONBOARDING_KEY = 'hasSeenOnboarding';

const slides = [
    {
        id: 1,
        icon: '📱',
        title: 'Sistem Order Digital',
        description: 'Terima pesanan dari meja atau takeaway langsung dari layar. Tidak perlu lagi catatan manual yang berantakan.',
        gradient: 'from-amber-500 to-orange-600',
        bgColor: 'bg-amber-50',
        accentColor: 'text-amber-700',
    },
    {
        id: 2,
        icon: '📦',
        title: 'Manajemen Stok',
        description: 'Pantau persediaan bahan baku secara real-time. Dapat notifikasi otomatis sebelum stok habis.',
        gradient: 'from-emerald-500 to-teal-600',
        bgColor: 'bg-emerald-50',
        accentColor: 'text-emerald-700',
    },
    {
        id: 3,
        icon: '📊',
        title: 'Laporan Keuangan',
        description: 'Lihat ringkasan penjualan harian, mingguan, dan bulanan. Semua data transaksi tersimpan otomatis.',
        gradient: 'from-blue-500 to-indigo-600',
        bgColor: 'bg-blue-50',
        accentColor: 'text-blue-700',
    },
    {
        id: 4,
        icon: '✨',
        title: 'Banyak Fitur Kafe Lainnya',
        description: 'Kelola pegawai, meja, diskon, struk digital, dan masih banyak lagi — semuanya dalam satu aplikasi.',
        gradient: 'from-purple-500 to-pink-600',
        bgColor: 'bg-purple-50',
        accentColor: 'text-purple-700',
    },
];

const OnboardingScreen = () => {
    const navigate = useNavigate();
    const [activeIndex, setActiveIndex] = useState(0);
    const isLastSlide = activeIndex === slides.length - 1;

    const handleFinish = () => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        navigate('/auth/login', { replace: true });
    };

    const handleSkip = () => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        navigate('/auth/login', { replace: true });
    };

    const currentSlide = slides[activeIndex];

    return (
        <div
            className={`min-h-screen flex flex-col transition-colors duration-500 ${currentSlide.bgColor}`}
            style={{ userSelect: 'none' }}
        >
            {/* Skip Button */}
            <div className="flex justify-end p-5 pt-safe">
                {!isLastSlide && (
                    <button
                        onClick={handleSkip}
                        className="text-gray-400 text-sm font-medium px-3 py-1"
                    >
                        Lewati
                    </button>
                )}
            </div>

            {/* Swiper Slides */}
            <div className="flex-1 flex flex-col">
                <Swiper
                    modules={[Pagination]}
                    pagination={{
                        clickable: true,
                        bulletClass: 'swiper-pagination-bullet !bg-gray-300 !opacity-100 !w-2 !h-2',
                        bulletActiveClass: `swiper-pagination-bullet-active !w-6 !h-2 !rounded-full !bg-amber-600`,
                    }}
                    onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
                    className="w-full flex-1"
                    style={{ height: '100%' }}
                    spaceBetween={0}
                    allowTouchMove={true}
                >
                    {slides.map((slide) => (
                        <SwiperSlide key={slide.id}>
                            <div className="flex flex-col items-center justify-center px-8 pt-4 pb-16 text-center h-full min-h-[70vh]">
                                {/* Icon / Illustration */}
                                <div
                                    className={`w-36 h-36 rounded-3xl bg-gradient-to-br ${slide.gradient} flex items-center justify-center text-6xl shadow-xl mb-10`}
                                    style={{
                                        boxShadow: `0 20px 60px rgba(0,0,0,0.15)`,
                                    }}
                                >
                                    {slide.icon}
                                </div>

                                {/* Title */}
                                <h1 className={`text-3xl font-extrabold mb-4 ${slide.accentColor} leading-tight`}>
                                    {slide.title}
                                </h1>

                                {/* Description */}
                                <p className="text-gray-500 text-base leading-relaxed max-w-xs">
                                    {slide.description}
                                </p>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* Bottom CTA */}
            <div className="px-8 pb-safe pb-10 pt-4">
                {isLastSlide ? (
                    <button
                        onClick={handleFinish}
                        className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg
                       bg-gradient-to-r from-amber-600 to-orange-600 active:scale-95 transition-all"
                        style={{ boxShadow: '0 8px 30px rgba(217, 119, 6, 0.4)' }}
                    >
                        Mulai Sekarang 🚀
                    </button>
                ) : (
                    <div className="h-14" /> // Spacing placeholder so layout doesn't jump
                )}
            </div>
        </div>
    );
};

export default OnboardingScreen;
