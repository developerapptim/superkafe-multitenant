import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiPackage, FiShoppingCart, FiBarChart2, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import HeroSlider from '../components/landing/HeroSlider';
import FeatureCard from '../components/landing/FeatureCard';
import PricingCard from '../components/landing/PricingCard';
import LandingNavbar from '../components/landing/LandingNavbar';
import { checkActiveSession, getDashboardUrl } from '../utils/authHelper';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    const session = checkActiveSession();
    if (session) {
      const dashboardUrl = getDashboardUrl();
      if (dashboardUrl) {
        navigate(dashboardUrl);
        return;
      }
    }
    navigate('/auth/login');
  };

  const slides = [
    {
      image: 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1771858573/Gemini_Generated_Image_3z933g3z933g3z93_z0h9jb.png',
      title: 'SuperKafe POS: Kelola Kafe lebih Mudah dan Untung',
      description: 'Sistem kasir lengkap untuk efisiensi dan pertumbuhan bisnis kafe Anda',
      cta: {
        text: 'Order Now',
        action: () => navigate('/auth/register')
      }
    },
    {
      image: 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1771863271/sumup-ridtu_TQV4Y-unsplash_u2pkgo.jpg',
      title: 'Sitem Order Digital dengan Super FItur Lengkap',
      description: 'Kelola Pesanan, Pembayaran, Laporan, dan Managemen Stok yang terintegrasi',
      cta: {
        text: 'Coba Gratis Sekarang',
        action: () => navigate('/auth/register')
      }
    }
  ];

  const features = [
    {
      icon: <FiTrendingUp className="w-8 h-8 text-white" />,
      title: 'Laporan Penjualan',
      description: 'Pantau performa bisnis dengan laporan penjualan real-time dan analitik mendalam'
    },
    {
      icon: <FiPackage className="w-8 h-8 text-white" />,
      title: 'Management Stok',
      description: 'Kelola inventaris dengan mudah, tracking stok otomatis dan notifikasi stok menipis'
    },
    {
      icon: <FiShoppingCart className="w-8 h-8 text-white" />,
      title: 'Order Meja Digital',
      description: 'Sistem pemesanan digital untuk meningkatkan efisiensi pelayanan pelanggan'
    },
    {
      icon: <FiBarChart2 className="w-8 h-8 text-white" />,
      title: 'Puluhan Fitur Canggih Kafe Modern',
      description: 'Lengkap dengan manajemen karyawan, shift, reservasi, dan banyak lagi'
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 'Rp 200.000',
      period: 'bulan',
      planType: 'starter',
      description: 'Solusi fleksibel untuk operasional harian kafe Anda.',
      features: [
        'Akses Lengkap Sistem POS & Kasir',
        'Laporan Keuangan',
        'Manajemen Stok',
        'Otomasi AI',
        'Dukungan Teknis Standar'
      ],
      highlighted: false
    },
    {
      name: 'Bisnis',
      price: 'Rp 1.700.000',
      originalPrice: 'Rp 2.400.000',
      period: 'tahun',
      planType: 'bisnis',
      badge: 'DISKON 29%',
      description: 'Pilihan favorit! Investasi cerdas untuk efisiensi maksimal bisnis Anda.',
      features: [
        'Akses Lengkap Sistem POS & Kasir',
        'Laporan Keuangan',
        'Manajemen Stok',
        'Otomasi AI',
        'Priority Support + Free Managed Setup',
        '(Kami bantu konfigurasi sistem Anda sampai siap pakai)'
      ],
      highlighted: true
    },
    {
      name: 'Lifetime',
      price: 'Rp 5.500.000',
      period: 'Sekali Bayar',
      planType: 'lifetime',
      description: 'Satu kali bayar, kendali kafe di tangan Anda selamanya tanpa biaya langganan.',
      features: [
        'Semua fitur premium sudah termasuk',
        'Akses selamanya tanpa batas waktu',
        'Tidak ada biaya langganan bulanan',
        'Update gratis selamanya',
        'Priority Support Lifetime'
      ],
      highlighted: false
    }
  ];

  // Handle plan selection: redirect to register with plan param
  const handleSelectPlan = (plan) => {
    navigate(`/auth/register?plan=${plan.planType}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <LandingNavbar />

      {/* Hero Slider Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <HeroSlider slides={slides} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Fitur Unggulan
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Pilihan Paket
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Pilih paket yang sesuai dengan kebutuhan bisnis kafe Anda. Semua paket sudah termasuk fitur lengkap untuk mengelola kafe modern.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <PricingCard
                key={index}
                plan={plan}
                index={index}
                onSelect={handleSelectPlan}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer with Contact Info */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <h3 className="text-xl font-bold text-amber-400 mb-3">SuperKafe</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Sistem POS modern untuk kafe dan restoran. Kelola bisnis Anda dengan lebih efisien dan profesional.
              </p>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold text-white mb-3">Kontak Kami</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <FiMail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <a href="mailto:developerapptim@gmail.com" className="hover:text-amber-400 transition-colors">
                    developerapptim@gmail.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <FiPhone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <a href="tel:+62081919371357" className="hover:text-amber-400 transition-colors">
                    081919371357
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <FiMapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>LockApp, Jl Poros Maros KM 21, Sulawesi Selatan 90552</span>
                </li>
              </ul>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold text-white mb-3">Tautan</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#pricing" className="hover:text-amber-400 transition-colors">Harga & Paket</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} SuperKafe x LockApp.id. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
