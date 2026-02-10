import { useState } from 'react';
import useSWR from 'swr';
import { feedbackAPI } from '../../services/api';
import toast from 'react-hot-toast';

const fetcher = url => feedbackAPI.getAll().then(res => res.data);

function FeedbackList() {
    const { data: feedbacks, error, isLoading } = useSWR('/feedback', fetcher, { refreshInterval: 60000 });
    const [searchTerm, setSearchTerm] = useState('');

    if (error) return <div className="text-red-400 p-4">Gagal memuat data masukan.</div>;
    if (isLoading) return <div className="text-white p-4">Memuat...</div>;

    const filteredFeedbacks = (feedbacks || []).filter(item =>
        item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                <input
                    type="text"
                    placeholder="Cari pesan atau nama..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500 outline-none"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFeedbacks.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-gray-400">Belum ada masukan belum.</p>
                    </div>
                ) : (
                    filteredFeedbacks.map((item) => (
                        <div key={item._id} className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:border-purple-500/30 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xs uppercase">
                                        {item.name.substring(0, 2)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-white">{item.name}</h3>
                                        <div className="flex text-yellow-400 text-xs">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i}>{i < item.rating ? '⭐' : '☆'}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-500">
                                    {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg">
                                "{item.message}"
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default FeedbackList;
