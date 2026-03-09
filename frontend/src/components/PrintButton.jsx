import { useState } from 'react';
import { printReceipt, downloadReceiptPDF } from '../utils/receiptPrinter';
import { FiPrinter, FiDownload } from 'react-icons/fi';
import useSWR from 'swr';
import api from '../services/api';

/**
 * PrintButton Component
 * Provides print and PDF download functionality for receipts
 * 
 * @param {Object} props
 * @param {Object} props.order - Order data to print
 * @param {Object} props.settings - Business settings for receipt
 * @param {string} props.variant - 'primary' | 'secondary' | 'icon'
 * @param {string} props.className - Additional CSS classes
 */
export default function PrintButton({ order, size = 'normal', variant = 'primary', className = '' }) {
    const { data: settings } = useSWR('/settings', url => api.get(url).then(res => res.data));
    const [isPrinting, setIsPrinting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePrint = async () => {
        if (!order || isPrinting) return;

        setIsPrinting(true);
        try {
            await printReceipt(order, settings);
        } finally {
            // Wait 2.5 seconds before allowing another print to prevent double printing
            setTimeout(() => {
                if (window && window.isMounted !== false) setIsPrinting(false);
            }, 2500);
        }
    };

    const handleDownloadPDF = async () => {
        if (!order || isDownloading) return;
        setIsDownloading(true);
        try {
            await downloadReceiptPDF(order, settings);
        } finally {
            setIsDownloading(false);
        }
    };

    // Variant styles
    const variants = {
        primary: 'w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20',
        secondary: 'w-full py-2.5 rounded-xl bg-white/5 border border-purple-500/30 hover:bg-purple-500/10 text-purple-300 font-medium transition-all flex items-center justify-center gap-2',
        icon: 'p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 text-gray-400 hover:text-purple-300 transition-all'
    };

    if (variant === 'icon') {
        return (
            <div className="flex gap-1">
                <button
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className={`${variants.icon} ${isPrinting ? 'opacity-50 cursor-wait' : ''} ${className}`}
                    title="Cetak Struk"
                >
                    {isPrinting ? '⏳' : <FiPrinter />}
                </button>
                <button
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="p-3 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                    title="Download PDF"
                >
                    <FiDownload size={20} className={isDownloading ? "animate-bounce" : ""} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={handlePrint}
                disabled={isPrinting}
                className={`flex-1 ${variants[variant]} ${isPrinting ? 'opacity-50 cursor-wait' : ''} ${className}`}
            >
                {isPrinting ? (
                    <>
                        <span className="animate-spin">⏳</span>
                        <span>Memproses...</span>
                    </>
                ) : (
                    <>
                        <FiPrinter size={size === 'small' ? 14 : 16} />
                        <span>Cetak Struk</span>
                    </>
                )}
            </button>
            <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors border shadow-md disabled:opacity-50
                    ${variant === 'primary' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30' : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'}
                `}
                title="Download PDF"
            >
                <FiDownload size={size === 'small' ? 14 : 16} className={isDownloading ? "animate-bounce" : ""} />
            </button>
        </div>
    );
}
