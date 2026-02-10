import { useState, useEffect } from 'react';
import PointsModal from './PointsModal';
import { customersAPI } from '../services/api';
import {
    calculatePointsEarned,
    DEFAULT_POINT_RATIO
} from '../utils/tierUtils';

/**
 * Points Earned Banner Component
 * Shows points notification on order success page
 * Only visible when loyalty is enabled in settings
 * 
 * @param {Object} props
 * @param {Object} props.order - Submitted order data
 * @param {Object} props.settings - App settings including loyaltySettings
 */
export default function PointsEarnedBanner({ order, settings }) {
    const [showModal, setShowModal] = useState(false);
    const [customerData, setCustomerData] = useState(null);
    const [loadingCustomer, setLoadingCustomer] = useState(false);



    // Check if loyalty is enabled
    const loyaltyEnabled = settings?.loyaltySettings?.enableLoyalty;
    const pointRatio = settings?.loyaltySettings?.pointRatio || DEFAULT_POINT_RATIO;
    const pointsEarned = order ? calculatePointsEarned(order.total, pointRatio) : 0;

    // Fetch customer data when modal opens
    useEffect(() => {
        const phone = order?.customerPhone || order?.phone;
        if (showModal && phone && !customerData && !loadingCustomer) {
            setLoadingCustomer(true);
            console.log('Fetching customer points for phone:', phone);
            customersAPI.getPoints(phone)
                .then(res => {
                    console.log('Customer points fetched:', res.data);
                    setCustomerData(res.data);
                })
                .catch(err => {
                    console.error('Failed to fetch customer data:', err);
                    // Fallback to order data
                    setCustomerData({
                        name: order.customerName,
                        phone: phone,
                        points: pointsEarned,
                        tier: 'bronze',
                        totalSpent: order.total
                    });
                })
                .finally(() => {
                    setLoadingCustomer(false);
                });
        }
    }, [showModal, order?.customerPhone, order?.phone]);

    // Don't render if loyalty is disabled or no order
    if (!loyaltyEnabled || !order) return null;

    // If no points earned (small order), don't show
    if (pointsEarned === 0) return null;

    const handleOpenModal = () => {
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    // Build display data: use fetched customerData if available, otherwise fallback
    const displayData = customerData || {
        name: order.customerName,
        phone: order.customerPhone || order.phone,
        points: pointsEarned,
        tier: 'bronze',
        totalSpent: order.total
    };

    return (
        <>
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl p-4 border border-purple-500/30 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                            💎
                        </div>
                        <div>
                            <p className="text-green-400 font-bold text-lg">
                                🎉 +{pointsEarned} Poin
                            </p>
                            <p className="text-gray-400 text-sm">telah ditambahkan!</p>
                        </div>
                    </div>

                    <button
                        onClick={handleOpenModal}
                        className="px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-all flex items-center gap-2"
                    >
                        <span>💎</span>
                        <span className="hidden sm:inline">Lihat Detail</span>
                    </button>
                </div>
            </div>

            {/* Points Modal */}
            <PointsModal
                isOpen={showModal}
                onClose={handleCloseModal}
                customerData={displayData}
                settings={settings}
                loading={loadingCustomer}
            />
        </>
    );
}
