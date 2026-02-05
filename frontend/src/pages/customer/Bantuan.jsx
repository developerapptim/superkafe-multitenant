import { useOutletContext } from 'react-router-dom';

function Bantuan() {
    const { settings } = useOutletContext();

    const faqs = [
        {
            q: 'Bagaimana cara memesan?',
            a: 'Pilih menu yang diinginkan, atur jumlah, lalu klik "Pesan Sekarang" di halaman keranjang.'
        },
        {
            q: 'Berapa lama pesanan saya diproses?',
            a: 'Rata-rata pesanan diproses dalam 5-15 menit tergantung antrian.'
        },
        {
            q: 'Bagaimana cara membayar?',
            a: 'Pembayaran dapat dilakukan secara tunai atau QRIS di kasir setelah pesanan siap.'
        },
        {
            q: 'Apakah bisa request khusus?',
            a: 'Bisa! Tuliskan permintaan khusus di kolom "Catatan" saat checkout.'
        }
    ];

    return (
        <div className="px-4 py-4 space-y-6">
            <h2 className="text-xl font-bold">❓ Bantuan</h2>

            {/* Contact */}
            <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-bold mb-3">📞 Hubungi Kami</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Butuh bantuan? Panggil pelayan atau hubungi kami:
                </p>
                <div className="space-y-2">
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); alert('🔔 Pelayan sedang dipanggil!'); }}
                        className="block w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-center font-medium"
                    >
                        🔔 Panggil Pelayan
                    </a>
                    <a
                        href={`https://wa.me/62${settings?.phone || '81234567890'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3 rounded-xl bg-green-600 text-center font-medium"
                    >
                        💬 WhatsApp
                    </a>
                </div>
            </div>

            {/* FAQs */}
            <div>
                <h3 className="font-bold mb-3">📖 FAQ</h3>
                <div className="space-y-3">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                            <p className="font-medium text-sm mb-2">{faq.q}</p>
                            <p className="text-gray-400 text-sm">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* About */}
            <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-bold mb-2">🏪 Tentang Kami</h3>
                <p className="text-sm text-gray-400">
                    {settings?.businessName || 'Warkop Santai'} - {settings?.tagline || 'Ngopi Enak, Harga Merakyat'}
                </p>
                {settings?.address && (
                    <p className="text-sm text-gray-400 mt-2">📍 {settings.address}</p>
                )}
            </div>

            {/* Credits */}
            <div className="text-center text-xs text-gray-500 py-4">
                <p>Powered by LockApp.id</p>
                <p className="mt-1">© 2026 All Rights Reserved</p>
            </div>
        </div>
    );
}

export default Bantuan;
