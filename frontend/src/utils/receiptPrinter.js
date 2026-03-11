/**
 * Receipt Printer Utility
 * Handles thermal receipt printing for SuperKafe POS
 * Supports native print dialog (Android/Web) with PDF fallback
 */

import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { downloadFile } from './downloadHelper';

/**
 * Format currency to IDR
 */
const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(val || 0);

/**
 * Format date to Indonesian locale
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

/**
 * Generate thermal-friendly HTML receipt (80mm width)
 * @param {Object} order - Order data
 * @param {Object} settings - Business settings
 * @returns {string} HTML string
 */
export const generateReceiptHTML = (order, settings = {}) => {
    if (!order) return '';

    const items = order.items || [];
    const validDateString = order.timestamp || order.date || order.createdAt;
    const orderTime = order.time || (validDateString ? new Date(validDateString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');

    const businessName = settings.name || settings.businessName || 'SuperKafe';
    const address = settings.address || '';
    const phoneInfo = settings.phone ? `Telp: ${settings.phone}` : '';
    const isPaid = order.paymentStatus === 'paid';

    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=80mm, initial-scale=1.0">
    <title>Struk #${(order.id || '').slice(-6)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 12px;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            background: white;
            color: black;
            line-height: 1.4;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .small { font-size: 10px; }
        .tiny { font-size: 8px; color: #666; }
        
        .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
        
        .header { text-align: center; margin-bottom: 10px; }
        .header img { max-height: 40px; margin-bottom: 5px; filter: grayscale(100%); }
        .header h1 { font-size: 16px; text-transform: uppercase; margin: 5px 0; }
        
        .info-row { display: flex; justify-content: space-between; margin: 2px 0; }
        
        .item { margin: 5px 0; }
        .item-name { font-weight: bold; }
        .item-detail { display: flex; justify-content: space-between; padding-left: 10px; }
        .item-note { font-size: 10px; font-style: italic; color: #555; padding-left: 10px; }
        
        .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
        .grand-total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
        
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-weight: bold; font-size: 11px; margin-top: 5px;}
        .status-paid { background: #d4edda; color: #155724; }
        .status-unpaid { background: #f8d7da; color: #721c24; }
        
        .footer { text-align: center; margin-top: 15px; margin-bottom: 20px;}
        
        @media print {
            body { max-width: 100% !important; padding: 0 1mm !important; font-size: 11px !important; }
            @page { margin: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        ${settings.logo && settings.showLogoInReceipt !== false ? `<img src="${settings.logo}" alt="Logo" />` : ''}
        <h1>${businessName}</h1>
        <p class="small">${address}</p>
        <p class="small">${phoneInfo}</p>
    </div>
    
    <div class="divider"></div>
    
    <div>
        <div class="info-row">
            <span>No. Order:</span>
            <span class="bold" style="color:red;">#${(order.id || '').slice(-6)}</span>
        </div>
        <div class="info-row">
            <span>Tgl:</span>
            <span>${formatDate(validDateString)}</span>
        </div>
        <div class="info-row">
            <span>Waktu:</span>
            <span>${orderTime}</span>
        </div>
        <div class="info-row">
            <span>Pelanggan:</span>
            <span>${order.customerName || 'Pelanggan'}</span>
        </div>
        ${order.tableNumber ? `<div class="info-row">
            <span>Meja:</span>
            <span class="bold" style="color:red;">${order.tableNumber}</span>
        </div>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <div>
        ${items.map(item => {
            const qty = item.qty || item.quantity || 1;
            const price = item.price || 0;
            return `
            <div class="item">
                <div class="item-name">${item.name || item.menuName}</div>
                <div class="item-detail">
                    <span>${qty}x @${formatCurrency(price)}</span>
                    <span>${formatCurrency(qty * price)}</span>
                </div>
                ${item.note ? `<div class="item-note">Catatan: ${item.note}</div>` : ''}
            </div>
            `;
        }).join('')}
    </div>
    
    <div class="divider"></div>
    
    <div>
        ${order.subtotal && order.subtotal !== order.total ? `
        <div class="total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(order.subtotal)}</span>
        </div>` : ''}
        ${order.voucherDiscount > 0 ? `
        <div class="total-row small">
            <span>Diskon Voucher</span>
            <span>-${formatCurrency(order.voucherDiscount)}</span>
        </div>` : ''}
        <div class="total-row grand-total">
            <span>TOTAL</span>
            <span>${formatCurrency(order.total)}</span>
        </div>
    </div>
    
    <div class="divider" style="margin-top:20px;"></div>
    
    <div class="center">
        <span class="small">Status Bayar:</span><br>
        <div class="status-badge ${isPaid ? 'status-paid' : 'status-unpaid'}">
            ${isPaid ? 'LUNAS' : 'BELUM BAYAR'}
        </div>
    </div>
    
    <div class="divider"></div>
    
    <div class="footer">
        <p class="small">Terima kasih atas kunjungan Anda!</p>
        <p class="tiny" style="margin-top:5px;">Powered by SuperKafe</p>
    </div>
</body>
</html>
    `.trim();
};

/**
 * Print receipt using browser print dialog
 * Opens HTML in new window and triggers print
 * @param {Object} order - Order data
 * @param {Object} settings - Business settings
 * @returns {Promise<boolean>} Success status
 */
export const printReceipt = async (order, settings = {}) => {
    const toastId = toast.loading('Menyiapkan struk...');

    try {
        const html = generateReceiptHTML(order, settings);

        // Create a new window with the receipt
        const printWindow = window.open('', '_blank', 'width=320,height=600');

        if (!printWindow) {
            // Popup blocked, fallback to PDF
            toast.loading('Popup diblokir, membuat PDF...', { id: toastId });
            return await downloadReceiptPDF(order, settings, toastId);
        }

        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Trigger print
        printWindow.focus();
        printWindow.print();

        // Close window after print dialog
        // Note: Some browsers close automatically, others don't
        setTimeout(() => {
            try {
                printWindow.close();
            } catch (e) {
                // Window may already be closed
            }
        }, 1000);

        toast.success('Struk siap cetak!', { id: toastId });
        return true;

    } catch (error) {
        console.error('Print error:', error);

        // Fallback to PDF download
        toast.loading('Gagal cetak, membuat PDF...', { id: toastId });
        return await downloadReceiptPDF(order, settings, toastId);
    }
};

/**
 * Download receipt as PDF
 * @param {Object} order - Order data
 * @param {Object} settings - Business settings
 * @param {string} toastId - Toast ID for updates
 * @returns {Promise<boolean>} Success status
 */
export const downloadReceiptPDF = async (order, settings = {}, toastId = null) => {
    const loadingToast = toastId || toast.loading('Membuat PDF...');

    try {
        // Create temporary container
        const container = document.createElement('div');
        container.innerHTML = generateReceiptHTML(order, settings);
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);

        // Find the body element inside our HTML
        const receiptBody = container.querySelector('body') || container;
        receiptBody.style.width = '300px';

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 300));

        // Convert to image
        const dataUrl = await toPng(receiptBody, {
            cacheBust: true,
            pixelRatio: 3,
            backgroundColor: '#ffffff'
        });

        // Calculate dimensions
        const w = receiptBody.offsetWidth || 300;
        const h = receiptBody.offsetHeight || 400;
        const pdfWidth = 80; // mm
        const pdfHeight = (h * pdfWidth) / w;

        // Create PDF
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [pdfWidth, pdfHeight]
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

        // Convert to Base64 and use Capacitor Helper
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        await downloadFile({
            filename: `Struk-${order.id || Date.now()}.pdf`,
            dataBase64: pdfBase64,
            mimeType: 'application/pdf'
        });

        // Cleanup
        document.body.removeChild(container);

        toast.success('PDF berhasil diunduh!', { id: loadingToast });
        return true;

    } catch (error) {
        console.error('PDF generation error:', error);
        toast.error('Gagal membuat PDF. Coba lagi.', { id: loadingToast });
        return false;
    }
};

/**
 * Check if device supports printing
 * @returns {boolean}
 */
export const canPrint = () => {
    return typeof window !== 'undefined' && typeof window.print === 'function';
};

export default {
    generateReceiptHTML,
    printReceipt,
    downloadReceiptPDF,
    canPrint
};
