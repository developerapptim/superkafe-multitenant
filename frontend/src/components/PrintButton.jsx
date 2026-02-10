import { useState } from 'react';
import { printReceipt, downloadReceiptPDF } from '../utils/receiptPrinter';

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
export default function PrintButton({ order, settings, variant = 'primary', className = '' }) {
    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = async () => {
        if (!order || isPrinting) return;

        setIsPrinting(true);
        try {
            await printReceipt(order, settings);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!order || isPrinting) return;

        setIsPrinting(true);
        try {
            await downloadReceiptPDF(order, settings);
        } finally {
            setIsPrinting(false);
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
                    {isPrinting ? '⏳' : '🖨️'}
                </button>
                <button
                    onClick={handleDownloadPDF}
                    disabled={isPrinting}
                    className={`${variants.icon} ${isPrinting ? 'opacity-50 cursor-wait' : ''}`}
                    title="Download PDF"
                >
                    📄
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
                        <span>🖨️</span>
                        <span>Cetak Struk</span>
                    </>
                )}
            </button>
            <button
                onClick={handleDownloadPDF}
                disabled={isPrinting}
                className={`px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-all ${isPrinting ? 'opacity-50 cursor-wait' : ''}`}
                title="Download PDF"
            >
                📄
            </button>
        </div>
    );
}
