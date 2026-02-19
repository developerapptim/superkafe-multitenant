import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiTrendingUp, FiUsers, FiZap, FiCheck, FiArrowRight } from 'react-icons/fi';

const LandingPage = () => {
  const features = [
    {
      icon: <FiShoppingBag className="w-6 h-6" />,
      title: "Kelola Kafe",
      description: "Sistem POS modern untuk mengelola menu, pesanan, dan transaksi dengan mudah"
    },
    {
      icon: <FiTrendingUp className="w-6 h-6" />,
      title: "Analitik Real-time",
      description: "Pantau performa bisnis Anda dengan dashboard analitik yang komprehensif"
    },
    {
      icon: <FiUsers className="w-6 h-6" />,
      title: "Multi-tenant",
      description: "Kelola banyak cabang dengan database terpisah untuk setiap lokasi"
    },
    {
      icon: <FiZap className="w-6 h-6" />,
      title: "Cepat & Efisien",
      description: "Proses pesanan lebih cepat dengan antarmuka yang intuitif dan responsif"
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "Gratis",
      period: "selamanya",
      features: [
        "1 Cabang",
        "Menu Unlimited",
        "Laporan Dasar",
        "Support Email"
      ],
      highlighted: false
    },
    {
      name: "Professional",
      price: "Rp 299.000",
      period: "/bulan",
      features: [
        "5 Cabang",
        "Menu Unlimited",
        "Laporan Lengkap",
        "Analitik Advanced",
        "Priority Support",
        "Custom Domain"
      ],
      highlighted: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      features: [
        "Unlimited Cabang",
        "Semua Fitur Pro",
        "Dedicated Support",
        "Custom Integration",
        "SLA 99.9%"
      ],
      highlighted: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 backdrop-blur-md bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <FiShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                SuperKafe
              </span>
              <span className="text-xs px-2 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                by LockApp
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/auth/login"
                className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                Masuk
              </Link>
              <Link
                to="/auth/register"
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Daftar Gratis
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Kelola Kafe
              </span>
              <br />
              <span className="text-white">Modern & Efisien</span>
            </h1>
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
              Platform SaaS multitenant untuk mengelola bisnis kafe Anda dengan sistem POS modern, 
              analitik real-time, dan manajemen inventaris yang powerful.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/auth/register"
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
              >
                Mulai Gratis
                <FiArrowRight />
              </Link>
              <a
                href="#features"
                className="px-8 py-4 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all"
              >
                Lihat Fitur
              </a>
            </div>
          </motion.div>

          {/* Hero Image/Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16"
          >
            <div className="relative max-w-5xl mx-auto">
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <FiShoppingBag className="w-20 h-20 mx-auto mb-4 text-purple-400" />
                    <p className="text-white/60">Dashboard Preview</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Fitur Unggulan</h2>
            <p className="text-white/70 text-lg">Semua yang Anda butuhkan untuk mengelola bisnis kafe</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Harga Transparan</h2>
            <p className="text-white/70 text-lg">Pilih paket yang sesuai dengan kebutuhan bisnis Anda</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`backdrop-blur-xl rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-2 border-purple-500/50 shadow-2xl shadow-purple-500/20 scale-105'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-center mb-4">
                    <span className="px-3 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
                      PALING POPULER
                    </span>
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-white/60">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <FiCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth/register"
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:shadow-lg hover:shadow-purple-500/50'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  Mulai Sekarang
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/20 rounded-3xl p-12"
          >
            <h2 className="text-4xl font-bold mb-4">Siap Memulai?</h2>
            <p className="text-xl text-white/70 mb-8">
              Daftar sekarang dan dapatkan akses gratis ke semua fitur dasar
            </p>
            <Link
              to="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
            >
              Daftar Gratis Sekarang
              <FiArrowRight />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 backdrop-blur-md bg-white/5 border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <FiShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold">SuperKafe by LockApp</span>
            </div>
            <p className="text-white/60 text-sm">
              © 2025 SuperKafe. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
