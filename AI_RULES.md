# AI DEVELOPMENT RULES & GUIDELINES

## 1. CORE PHILOSOPHY
* **Context:** Building a MERN Stack POS System for a "warkop" (Coffee Shop) in Indonesia.
* **Language:** Use **Bahasa Indonesia** for all UI text, comments, and explanations. Code variables remain in English.

## 2. FILE SYSTEM & STRUCTURE
* **CHECK FIRST:** Before creating any file, SCAN the directory. If a file with a similar name exists (case-insensitive), USE THAT FILE.
* **NO DUPLICATES:** Do not create `inventoryController.js` if `InventoryController.js` exists.
* **STYLE:** Follow existing patterns (Tailwind for UI, Express for API).

## 3. BACKEND (NODE/EXPRESS)
* **THE TRINITY RULE:** If you add a Controller function, you MUST also add the Route, and ensure the Route is registered in `server.js`.
* **ERROR HANDLING:** Always wrap async controller logic in `try-catch`. Return proper HTTP codes (200, 400, 404, 500).
* **DATABASE:** Use Mongoose. Always use `.lean()` for read-only queries for performance.

## 4. FRONTEND (REACT/VITE)
* **DEFENSIVE CODING:**
    * Use Optional Chaining: `user?.role` instead of `user.role`.
    * Use Default Values: `(list || []).map(...)` instead of `list.map(...)`.
* **MOBILE FIRST:** The Customer facing app must be optimized for mobile screens. Use safe-area padding (`pb-28`) for pages with bottom navigation.
* **STATE MANAGEMENT:** Handle `loading` and `error` states explicitly in UI.

## 5. LOCALIZATION
* **CURRENCY:** Format all prices to IDR (e.g., `Rp 15.000`).
* **TIME:** Use WIB (Waktu Indonesia Barat) or local server time for logs/display.

## 6. SECURITY
* **ROLE CHECKS:** Ensure sensitive actions (Delete, Edit Price) verify `req.user.role` on the Backend, not just hidden on Frontend.
* **DATA PRIVACY:** Never send password hashes or sensitive internal flags to the Frontend.

## 7. STABILITY & MODIFICATIONS (ANTI-REGRESSION)
* **DO NOT BREAK EXISTING CODE:** Saat diminta mengubah atau menambahkan fitur, pastikan fungsionalitas lain di dalam file atau komponen tersebut tidak terganggu.
* **LASER FOCUS:** Ubah *hanya* bagian yang diminta. Jangan melakukan *refactoring* pada fungsi lain yang tidak relevan dengan tugas saat ini meskipun Anda merasa bisa memperbaikinya, kecuali diminta secara eksplisit.

## 8. SMART DEPENDENCIES (LEVEL-UP RECOMMENDATIONS)
* **THOUGHTFUL SUGGESTIONS:** Boleh menyarankan dependensi/library `npm` baru JIKA itu memberikan keuntungan signifikan (keamanan, performa, best-practice) dibandingkan menulis kode secara manual.
* **EDUCATE THE USER:** Jika menyarankan *package* baru, WAJIB jelaskan dengan singkat *mengapa* *package* tersebut lebih baik digunakan.
* **NATIVE ALTERNATIVE:** Jika fungsionalitasnya sangat sederhana, tetap prioritaskan JavaScript murni agar aplikasi tidak terlalu berat.

## 9. ANTI-HALLUCINATION & SCOPE CREEP
* **NO ASSUMPTIONS:** Jangan mengarang (invent) nama file, variabel, atau *endpoint* API yang tidak ada. Jika Anda membutuhkan informasi tentang struktur database atau file lain untuk menyelesaikan tugas, **BERTANYALAH** terlebih dahulu.
* **NO "NICE-TO-HAVE" FEATURES:** Jangan menambahkan fitur ekstra, animasi berlebihan, atau validasi kompleks di luar dari apa yang diminta. Tetap berpegang pada spesifikasi MVP.

## 10. AI OUTPUT FORMATTING
* **PARTIAL CODE UPDATES:** Jika hanya mengubah sebagian kecil dari file yang besar, JANGAN menulis ulang seluruh isi file. Gunakan komentar seperti `// ... existing code ...` untuk merepresentasikan bagian yang tidak berubah. Berikan hanya blok kode yang dimodifikasi beserta sedikit konteks sekitarnya.
* **EXPLAIN FIRST, CODE LATER:** Berikan penjelasan singkat tentang apa yang akan diubah sebelum memberikan blok kode agar mudah diverifikasi.

## 11. THINK LIKE AN ARCHITECT (SYSTEM ROBUSTNESS)
* **BEYOND THE HAPPY PATH:** Jangan hanya fokus membuat fitur berfungsi di kondisi ideal. Pertimbangkan *edge cases*, potensi kegagalan, dan keandalan sistem secara keseluruhan.
* **PROPER ERROR HANDLING & LOGGING:** * Jangan hanya menggunakan `try-catch` kosong atau `console.log`. 
    * Berikan respons *error* yang ramah dan aman bagi *client* (jangan bocorkan *stack trace*), namun siapkan *logging* internal yang detail (konteks, waktu, *payload*) untuk keperluan *debugging*.
* **AUDITABILITY:** Untuk aksi krusial seperti transaksi kasir, perubahan harga, atau penghapusan inventaris, selalu pertimbangkan/implementasikan pencatatan jejak (*audit trail*).
* **TESTABILITY & SECURITY BY DESIGN:** Tulis kode yang modular dan mudah diuji (*testable*). Selalu terapkan prinsip kehati-hatian (*defensive programming*), validasi *input* secara ketat dari *client*, dan jika memungkinkan, sarankan skenario *testing* (unit/integration) untuk fitur kritis tersebut.