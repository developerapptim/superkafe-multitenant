import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { useState } from 'react';

import onboarding1 from '../assets/onboarding1.webp';
import onboarding2 from '../assets/onboarding2.webp';
import onboarding3 from '../assets/onboarding3.webp';
import onboarding4 from '../assets/onboarding4.webp';
import onboarding5 from '../assets/onboarding5.webp';

const ONBOARDING_KEY = 'hasSeenOnboarding';

const slides = [
    {
        id: 1,
        image: onboarding1,
        title: 'Selamat Datang di Superkafe',
        description: 'Solusi digital terpadu untuk efisiensi operasional kafe dan warkop Anda.',
        gradient: 'from-amber-500 to-orange-600',
        bgColor: 'bg-amber-50',
        accentColor: 'text-amber-700',
    },
    {
        id: 2,
        image: onboarding2,
        title: 'Manajemen Pesanan Digital',
        description: 'Proses pesanan pelanggan lebih cepat dan akurat langsung dari meja melalui sistem POS yang terintegrasi.',
        gradient: 'from-emerald-500 to-teal-600',
        bgColor: 'bg-emerald-50',
        accentColor: 'text-emerald-700',
    },
    {
        id: 3,
        image: onboarding3,
        title: 'Kontrol Stok Real-time',
        description: 'Pantau ketersediaan bahan baku secara otomatis dan dapatkan notifikasi saat stok menipis.',
        gradient: 'from-blue-500 to-indigo-600',
        bgColor: 'bg-blue-50',
        accentColor: 'text-blue-700',
    },
    {
        id: 4,
        image: onboarding4,
        title: 'Laporan Keuangan Akurat',
        description: 'Analisis performa bisnis Anda kapan saja dengan laporan penjualan harian yang detail dan mudah dipahami.',
        gradient: 'from-purple-500 to-pink-600',
        bgColor: 'bg-purple-50',
        accentColor: 'text-purple-700',
    },
    {
        id: 5,
        image: onboarding5,
        title: 'Serta Berbagai Fitur Lainnya',
        description: 'Mendukung Kafe Anda lebih optimal dengan manajemen karyawan, reservasi meja, hingga sistem shift.',
        gradient: 'from-rose-500 to-red-600',
        bgColor: 'bg-rose-50',
        accentColor: 'text-rose-700',
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
            className={`min-h-screen flex flex-col transition-colors duration-500 p-safe ${currentSlide.bgColor}`}
            style={{ userSelect: 'none' }}
        >
            {/* Skip Button */}
            <div className="flex justify-end p-5">
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
            <div className="flex-1 flex flex-col pt-4">
                <Swiper
                    modules={[Pagination, Autoplay]}
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
                            <div className="flex flex-col items-center justify-center px-8 pb-16 text-center h-full min-h-[60vh]">
                                {/* Illustration / Image */}
                                <div className="w-full max-w-[280px] aspect-square mb-8 flex items-center justify-center">
                                    <img
                                        src={slide.image}
                                        alt={slide.title}
                                        className="w-full h-full object-contain filter drop-shadow-xl"
                                        loading="lazy"
                                    />
                                </div>

                                {/* Title */}
                                <h1 className={`text-2xl font-extrabold mb-4 ${slide.accentColor} leading-tight`}>
                                    {slide.title}
                                </h1>

                                {/* Description */}
                                <p className="text-gray-600 text-[15px] leading-relaxed max-w-sm">
                                    {slide.description}
                                </p>
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>

            {/* Bottom CTA */}
            <div className="px-8 pb-10 pt-4">
                {isLastSlide ? (
                    <button
                        onClick={handleFinish}
                        className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg
                       bg-gradient-to-r from-amber-600 to-orange-600 active:scale-95 transition-all"
                        style={{ boxShadow: '0 8px 30px rgba(217, 119, 6, 0.4)' }}
                    >
                        Mulai Sekarang
                    </button>
                ) : (
                    <div className="h-14" /> // Spacing placeholder so layout doesn't jump
                )}
            </div>
        </div>
    );
};

export default OnboardingScreen;
