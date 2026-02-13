# Warkop POS Project - AI Context & Skills

## 1. Project Overview
Aplikasi Point of Sales (POS) untuk manajemen Warkop.
- **Frontend:** Single file HTML/JS (hasil export Canva Code + Custom Logic).
- **Backend:** Node.js / Express.
- **Database:** MongoDB.
- **Fitur Utama:** Kasir, Manajemen Stok, Notifikasi WhatsApp (Otomatis).

## 2. Tech Stack & Rules
- **Database:** Gunakan Mongoose untuk interaksi MongoDB. Pastikan selalu handle error `try/catch` pada query database.
- **Frontend Logic:**
  - JANGAN ubah struktur CSS/Class bawaan Canva kecuali diminta (untuk menjaga desain).
  - Tambahkan logika JavaScript di bagian bawah body atau file script terpisah.
  - Gunakan `fetch` API untuk komunikasi dengan Backend.

## 3. Specialized Skills (Tasks)

### @database_check
Tugas: Memastikan koneksi dan skema MongoDB benar.
Langkah:
1. Cek file koneksi database.
2. Pastikan Schema untuk `Products` (Stok) dan `Transactions` (Kasir) sesuai.
   - *Product Schema:* { nama, harga, stok_awal, stok_saat_ini }
   - *Transaction Schema:* { tanggal, items: [], total_bayar, metode_pembayaran }

### @fitur_kasir
Tugas: Menangani logika halaman kasir.
Aturan:
1. Saat item dipilih, kurangi stok sementara di UI.
2. Hitung total secara real-time.
3. Tombol "Bayar" harus mengirim data ke endpoint `/api/transaction` DAN memicu skill `@update_stok`.

### @update_stok
Tugas: Sinkronisasi stok setelah transaksi.
Aturan:
1. Backend menerima request transaksi.
2. Kurangi jumlah stok di MongoDB berdasarkan item yang terjual.
3. Jika stok < 5, picu skill `@notif_wa`.

### @notif_wa
Tugas: Mengirim peringatan stok menipis.
Aturan:
1. Cek kredensial API WhatsApp (pastikan ada di `.env`).
2. Kirim pesan ke nomor owner: "Peringatan: Stok [Nama Barang] tersisa [Jumlah]".

## 4. Coding Style
- Gunakan komentar bahasa Indonesia yang singkat.
- Selalu buat fungsi yang modular (satu fungsi = satu tugas).
- Utamakan performa, hindari re-render UI yang berlebihan pada file HTML besar.

// test deploy manual