# SuperKafe Multitenant - Frontend Guide

## 🎨 Arsitektur Baru

Frontend telah diubah dari single-page menu menjadi platform SaaS Multitenant dengan desain glassmorphism premium.

## 📁 Struktur Routing

### 1. Landing Page (`/`)
- Halaman utama SuperKafe by LockApp
- Menampilkan fitur, pricing, dan CTA
- Desain glassmorphism dengan animasi framer-motion

### 2. Auth Routes
- `/auth/login` - Login dengan tenant_slug, username, dan password
- `/auth/register` - Registrasi tenant baru
- `/login` - Legacy login (backward compatibility)

### 3. Dynamic Storefront (`/:slug`)
- URL dinamis berdasarkan tenant slug
- Contoh: `/warkop-pusat`, `/warkop-jakarta`
- Otomatis set `tenant_slug` di localStorage
- Menampilkan menu customer untuk tenant tersebut

Sub-routes:
- `/:slug` - Menu customer
- `/:slug/keranjang` - Keranjang belanja
- `/:slug/pesanan` - Pesanan saya
- `/:slug/bantuan` - Bantuan

### 4. Admin Routes (`/admin/*`)
- Protected routes untuk admin/kasir
- Menggunakan tenant_slug dari localStorage
- Semua route admin tetap sama seperti sebelumnya

## 🔐 Tenant Authentication Flow

### Registrasi Tenant Baru
1. User mengisi form di `/auth/register`
2. Data dikirim ke `POST http://76.13.196.116:5001/api/tenants/register`
3. Backend membuat:
   - Entry di database utama (collection `tenants`)
   - Database baru untuk tenant (`superkafe_[slug]`)
   - Seeding data awal (settings)
4. User diarahkan ke `/auth/login` dengan slug yang sudah terisi

### Login
1. User mengisi tenant_slug, username, dan password di `/auth/login`
2. `tenant_slug` disimpan di localStorage
3. Axios interceptor otomatis menambahkan header `x-tenant-id` ke setiap request
4. Backend middleware `tenantResolver` menggunakan header ini untuk routing ke database tenant yang benar
5. Setelah login sukses, redirect ke `/admin/dashboard`

### Akses Storefront
1. User mengakses `/:slug` (contoh: `/warkop-pusat`)
2. Component `DynamicStorefront` mengambil slug dari URL
3. Slug disimpan di localStorage sebagai `tenant_slug`
4. Semua API request otomatis menggunakan tenant tersebut
5. Menu dan data ditampilkan dari database tenant yang sesuai

## 🎨 Desain Glassmorphism

### Karakteristik
- Background: Gradient dari slate-900 via purple-900 ke slate-900
- Cards: `backdrop-blur-xl bg-white/10 border border-white/20`
- Hover effects: `hover:bg-white/20`
- Shadows: `shadow-2xl shadow-purple-500/20`
- Animated background elements dengan blur dan pulse

### Komponen Utama
- **LandingPage**: Hero, Features, Pricing, CTA
- **TenantLogin**: Form login dengan glassmorphism
- **TenantRegister**: Form registrasi dengan slug availability check

## 🔧 Axios Interceptor

Setiap request otomatis menyertakan:
```javascript
headers: {
  'x-tenant-id': localStorage.getItem('tenant_slug') || 'warkop-pusat',
  'x-api-key': 'warkop_secret_123',
  'Authorization': `Bearer ${token}` // jika ada
}
```

## 📱 Responsive Design

Semua komponen menggunakan Tailwind CSS dengan breakpoints:
- Mobile first approach
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px

## 🚀 Development

```bash
# Install dependencies
npm install

# Run development server (port 5002)
npm run dev

# Build for production
npm run build
```

## 🌐 URL Examples

### Production URLs
- Landing: `https://superkafe.com/`
- Register: `https://superkafe.com/auth/register`
- Login: `https://superkafe.com/auth/login`
- Storefront: `https://superkafe.com/warkop-pusat`
- Admin: `https://superkafe.com/admin/dashboard`

### Development URLs
- Landing: `http://localhost:5002/`
- Register: `http://localhost:5002/auth/register`
- Login: `http://localhost:5002/auth/login`
- Storefront: `http://localhost:5002/warkop-pusat`
- Admin: `http://localhost:5002/admin/dashboard`

## 🔄 Migration dari Single-tenant

### Perubahan Utama
1. ✅ Root `/` sekarang menampilkan LandingPage (bukan MenuCustomer)
2. ✅ MenuCustomer dipindah ke `/:slug`
3. ✅ Login dipindah ke `/auth/login` dengan input tenant_slug
4. ✅ Tambahan route `/auth/register` untuk registrasi tenant
5. ✅ Axios interceptor otomatis menambahkan `x-tenant-id` header

### Backward Compatibility
- Route `/login` masih ada untuk legacy support
- Admin routes tidak berubah
- API endpoints tidak berubah (hanya tambahan header)

## 🎯 Next Steps

1. Customize landing page sesuai brand
2. Tambahkan email verification untuk registrasi
3. Implementasi forgot password
4. Tambahkan tenant settings page
5. Implementasi billing & subscription
