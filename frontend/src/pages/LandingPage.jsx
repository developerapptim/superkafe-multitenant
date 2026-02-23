import { useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiPackage, FiShoppingCart, FiBarChart2 } from 'react-icons/fi';
import HeroSlider from '../components/landing/HeroSlider';
import FeatureCard from '../components/landing/FeatureCard';
import PricingCard from '../components/landing/PricingCard';
import LandingNavbar from '../components/landing/LandingNavbar';

const LandingPage = () => {
  const navigate = useNavigate();

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
      price: 'Rp 225.000',
      period: 'bulan',
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
      price: 'Rp 2.000.000',
      originalPrice: 'Rp 2.500.000',
      period: 'tahun',
      badge: 'DISKON 20%',
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
      price: 'Rp 7.500.000',
      period: 'Sekali Bayar',
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

  const handleSelectPlan = (plan) => {
    navigate('/auth/register', { state: { selectedPlan: plan.name } });
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
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-amber-400 transition-colors">Contact</a>
              <a href="#" className="hover:text-amber-400 transition-colors">FAQs</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Terms of Service</a>
            </div>
            <p className="text-gray-400 text-sm">
              © 2024 SuperKafe x LockApp.id. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
