import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

/**
 * Helper terpusat untuk mendownload/mensharing file, mendukung Web dan Native (Capacitor)
 * @param {Object} options Options konfigurasi download
 * @param {string} options.filename Nama file beserta ekstensi (misal 'qr-menu.png')
 * @param {string} [options.dataBase64] File dalam format Base64 string murni tanpa header `data:image/png;base64,`
 * @param {string} [options.mimeType] MimeType (e.g 'image/png', 'application/pdf')
 */
export const downloadFile = async ({ filename, dataBase64, mimeType }) => {
    try {
        if (!Capacitor.isNativePlatform()) {
            // WEB IMPLEMENTATION
            // Rekonstruksi menjadi Data URI
            const dataUri = `data:${mimeType};base64,${dataBase64}`;

            const link = document.createElement('a');
            link.href = dataUri;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return true;
        }

        // CAPACITOR (ANDROID/IOS) IMPLEMENTATION
        // Tulis file ke cache direktori internal aplikasi
        const writeResult = await Filesystem.writeFile({
            path: filename,
            data: dataBase64,
            directory: Directory.Cache
        });

        // Pakai fitur "Share" native untuk memberi pengguna pilihan simpan
        // (Capacitor Filesystem seringkali terhalang scoped-storage di Android 11+ jika langsung di Document,
        // Share adalah cara terbaik memberikan akses eksplisit ke file manager eksternal)
        const canShare = await Share.canShare();
        if (canShare.value) {
            await Share.share({
                title: 'Simpan File',
                text: `Berikut adalah file ${filename}`,
                url: writeResult.uri,
                dialogTitle: 'Buka atau Simpan'
            });
            return true;
        } else {
            // Fallback, infokan uri
            toast.success(`File disimpan sementara di aplikasi: ${writeResult.uri}`);
            return true;
        }

    } catch (error) {
        console.error('Error in downloadFileHelper:', error);
        toast.error('Gagal memproses file. Pastikan izin penyimpanan diberikan.');
        throw error;
    }
};

/**
 * Konversi Javascript Blob (biasanya dari response axios type=blob) ke Base64 
 */
export const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result akan mengandung header `data:application/pdf;base64,.....`
            // kita harus split dan ambil token index 1
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
