/**
 * Receipt Printer Utility
 * Handles thermal receipt printing for SuperKafe POS
 * Supports native print dialog (Android/Web) with PDF fallback
 */

import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

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
    const orderTime = order.time || new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=80mm, initial-scale=1.0">
    <title>Struk #${order.id?.slice(-6)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 12px;
            width: 80mm;
            padding: 5mm;
            background: white;
            color: black;
            line-height: 1.4;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .small { font-size: 10px; }
        .tiny { font-size: 8px; color: #666; }
        
        .divider {
            border-bottom: 1px dashed #000;
            margin: 8px 0;
        }
        
        .header {
            text-align: center;
            margin-bottom: 10px;
        }
        .header img {
            max-height: 40px;
            margin-bottom: 5px;
            filter: grayscale(100%);
        }
        .header h1 {
            font-size: 16px;
            text-transform: uppercase;
            margin: 5px 0;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
        }
        
        .item {
            margin: 5px 0;
        }
        .item-name {
            font-weight: bold;
        }
        .item-detail {
            display: flex;
            justify-content: space-between;
            padding-left: 10px;
        }
        .item-note {
            font-size: 10px;
            font-style: italic;
            color: #555;
            padding-left: 10px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
        }
        .grand-total {
            font-size: 14px;
            font-weight: bold;
            border-top: 1px dashed #000;
            padding-top: 5px;
            margin-top: 5px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: bold;
            font-size: 11px;
        }
        .status-paid {
            background: #d4edda;
            color: #155724;
        }
        .status-unpaid {
            background: #f8d7da;
            color: #721c24;
        }
        
        .wifi-box {
            background: #f5f5f5;
            padding: 8px;
            border-radius: 4px;
            margin: 10px 0;
            text-align: center;
        }
        
        .footer {
            text-align: center;
            margin-top: 15px;
        }
        
        @media print {
            body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 3mm !important;
            }
            @page {
                size: 80mm auto;
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        ${settings.logo && settings.showLogoInReceipt !== false ? `<img src="${settings.logo}" alt="Logo" />` : ''}
        <h1>${settings.businessName || 'WARKOP SANTAI'}</h1>
        <p class="small">${settings.address || ''}</p>
        ${settings.phone ? `<p class="small">Telp: ${settings.phone}</p>` : ''}
        ${settings.receiptHeader ? `<p class="small">${settings.receiptHeader}</p>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <!-- Order Info -->
    <div>
        <div class="info-row">
            <span>No. Order:</span>
            <span class="bold">#${order.id?.slice(-6) || '-'}</span>
        </div>
        <div class="info-row">
            <span>Tgl:</span>
            <span>${formatDate(order.createdAt || order.date)} ${orderTime}</span>
        </div>
        <div class="info-row">
            <span>Pelanggan:</span>
            <span>${order.customerName || 'Pelanggan'}</span>
        </div>
        ${order.tableNumber ? `
        <div class="info-row">
            <span>Meja:</span>
            <span class="bold">${order.tableNumber}</span>
        </div>
        ` : ''}
        ${order.source ? `
        <div class="info-row">
            <span>Via:</span>
            <span>${order.source === 'customer-app' ? 'App' : 'Kasir'}</span>
        </div>
        ` : ''}
    </div>
    
    <div class="divider"></div>
    
    <!-- Items -->
    <div>
        ${items.map(item => `
            <div class="item">
                <div class="item-name">${item.name || item.menuName}</div>
                <div class="item-detail">
                    <span>${item.qty || item.quantity}x @${formatCurrency(item.price)}</span>
                    <span>${formatCurrency((item.price || 0) * (item.qty || item.quantity || 1))}</span>
                </div>
                ${item.note ? `<div class="item-note">└ 📝 ${item.note}</div>` : ''}
            </div>
        `).join('')}
    </div>
    
    <div class="divider"></div>
    
    <!-- Totals -->
    <div>
        <div class="total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(order.subtotal || order.total)}</span>
        </div>
        ${order.tax > 0 ? `
        <div class="total-row small">
            <span>Pajak</span>
            <span>${formatCurrency(order.tax)}</span>
        </div>
        ` : ''}
        ${order.discount > 0 ? `
        <div class="total-row small">
            <span>Diskon</span>
            <span>-${formatCurrency(order.discount)}</span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
            <span>TOTAL</span>
            <span>${formatCurrency(order.total)}</span>
        </div>
        <div class="total-row" style="margin-top: 8px;">
            <span>Status Bayar:</span>
            <span class="status-badge ${order.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
                ${order.paymentStatus === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
            </span>
        </div>
    </div>
    
    ${settings.wifiName ? `
    <div class="wifi-box">
        <div class="bold">📶 Free Wi-Fi</div>
        <div>SSID: ${settings.wifiName}</div>
        ${settings.wifiPassword ? `<div>Pass: ${settings.wifiPassword}</div>` : ''}
    </div>
    ` : ''}
    
    <div class="divider"></div>
    
    <!-- Footer -->
    <div class="footer">
        <p>${settings.tagline || settings.receiptFooter || 'Terima kasih atas kunjungan Anda'}</p>
        <p class="tiny" style="margin-top: 8px;">Powered by MarosTech</p>
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
        pdf.save(`Struk-${order.id || Date.now()}.pdf`);

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
