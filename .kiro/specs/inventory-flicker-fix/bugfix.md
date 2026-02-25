# Inventory Page Flicker Fix

## Problem
Setiap kali membuka halaman Inventaris, terjadi kedipan (flicker) yang mengganggu di sepersekian detik pertama.

## Root Cause
1. **Initial loading state** diset ke `true`, menyebabkan conditional rendering yang berbeda
2. Saat loading, menampilkan **spinner** di tengah layar
3. Setelah data loaded, terjadi **layout shift** dari spinner ke tabel/cards
4. Ini menyebabkan **visual flicker** yang mengganggu UX

## Solution
Menggunakan **skeleton loading** pattern untuk mempertahankan layout yang konsisten:

### Changes Made

1. **Initial State Changed**
   ```javascript
   // Before
   const [loading, setLoading] = useState(true);
   
   // After
   const [loading, setLoading] = useState(false);
   ```

2. **Removed Conditional Returns**
   - Dihapus: `if (loading) return <Spinner />`
   - Dihapus: `if (error) return <ErrorMessage />`
   - Sekarang loading/error ditangani inline dalam layout yang sama

3. **Added Skeleton Loading**
   
   **Desktop (Table):**
   - Menampilkan 5 skeleton rows dengan animasi pulse
   - Mempertahankan struktur tabel yang sama
   - Tidak ada layout shift
   
   **Mobile (Cards):**
   - Menampilkan 3 skeleton cards dengan animasi pulse
   - Mempertahankan struktur card yang sama
   - Tidak ada layout shift

4. **Inline Error Handling**
   - Error message ditampilkan di dalam tabel/card list
   - Tombol "Coba Lagi" tetap accessible
   - Tidak ada layout shift

## Benefits
✅ Tidak ada flicker saat pertama kali load
✅ Smooth transition dari skeleton ke data
✅ Better UX dengan visual feedback yang konsisten
✅ Layout tetap stabil (no layout shift)
✅ Improved perceived performance

## Technical Details
- File: `frontend/src/pages/admin/Inventaris.jsx`
- Pattern: Skeleton Loading UI
- Animation: Tailwind `animate-pulse`
- Responsive: Desktop (table) & Mobile (cards)

## Testing
1. Buka halaman Inventaris
2. Refresh halaman (F5)
3. Perhatikan tidak ada kedipan lagi
4. Skeleton loading muncul smooth
5. Data muncul tanpa layout shift
