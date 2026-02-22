# Requirements Document

## Introduction

Aplikasi SuperKafe adalah platform manajemen kafe multi-tenant yang menggunakan dynamic routing dengan pattern `/:tenantSlug` untuk storefront setiap tenant. Saat ini terdapat konflik routing dimana URL statis seperti `/setup-cafe` tertangkap oleh dynamic route dan dianggap sebagai tenant slug, sehingga menghalangi user yang baru login via Google OAuth untuk mengakses setup wizard.

Fitur ini bertujuan untuk memperbaiki hierarchy routing di frontend dan menambahkan validasi reserved keywords di backend untuk mencegah konflik slug di masa depan.

## Glossary

- **Tenant**: Cabang warkop/kafe yang terdaftar dalam sistem multi-tenant
- **Slug**: Identifier unik berbentuk URL-friendly string untuk mengakses storefront tenant (contoh: `warkop-jaya`)
- **Dynamic_Route**: Route pattern yang menggunakan parameter dinamis (contoh: `/:tenantSlug`)
- **Static_Route**: Route dengan path tetap yang tidak menggunakan parameter (contoh: `/setup-cafe`, `/admin`)
- **Reserved_Keyword**: Kata-kata yang tidak boleh digunakan sebagai tenant slug karena konflik dengan static routes
- **Setup_Wizard**: Halaman untuk user baru membuat tenant pertama kali setelah registrasi
- **Storefront**: Halaman menu customer yang diakses melalui tenant slug
- **Router**: Komponen React Router yang menangani routing di frontend
- **Validation_Layer**: Logika validasi di backend untuk memastikan slug tidak menggunakan reserved keywords

## Requirements

### Requirement 1: Prioritas Routing Frontend

**User Story:** Sebagai developer, saya ingin static routes diprioritaskan di atas dynamic routes, sehingga URL seperti `/setup-cafe` tidak tertangkap oleh pattern `/:tenantSlug`.

#### Acceptance Criteria

1. WHEN THE Router menerima request ke `/setup-cafe`, THE Router SHALL mengarahkan ke Setup_Wizard component
2. WHEN THE Router menerima request ke `/admin/*`, THE Router SHALL mengarahkan ke admin routes
3. WHEN THE Router menerima request ke `/auth/*`, THE Router SHALL mengarahkan ke auth routes
4. WHEN THE Router menerima request ke valid tenant slug, THE Router SHALL mengarahkan ke Storefront component
5. WHEN THE Router menerima request ke path yang tidak cocok dengan Static_Route atau valid tenant slug, THE Router SHALL mengarahkan ke 404 atau landing page

### Requirement 2: Reserved Keywords Validation di Backend

**User Story:** Sebagai system administrator, saya ingin mencegah tenant menggunakan slug yang konflik dengan static routes, sehingga routing system tetap berfungsi dengan benar.

#### Acceptance Criteria

1. WHEN user mencoba membuat tenant dengan slug yang merupakan Reserved_Keyword, THEN THE Validation_Layer SHALL menolak request dengan error message yang jelas
2. WHEN user mencoba cek ketersediaan slug yang merupakan Reserved_Keyword, THEN THE Validation_Layer SHALL mengembalikan status "tidak tersedia"
3. THE Validation_Layer SHALL memvalidasi slug terhadap daftar Reserved_Keyword: `setup-cafe`, `admin`, `dashboard`, `auth`, `api`
4. WHEN slug validation berhasil (bukan Reserved_Keyword dan format valid), THEN THE Validation_Layer SHALL mengizinkan proses pembuatan tenant dilanjutkan

### Requirement 3: Slug Format Validation

**User Story:** Sebagai system administrator, saya ingin memastikan semua tenant slug mengikuti format yang konsisten dan aman untuk URL.

#### Acceptance Criteria

1. WHEN user memasukkan slug, THE Validation_Layer SHALL memvalidasi bahwa slug hanya mengandung huruf kecil, angka, dan tanda hubung
2. WHEN slug mengandung karakter tidak valid, THEN THE Validation_Layer SHALL menolak dengan error message yang menjelaskan format yang benar
3. WHEN slug valid dan bukan Reserved_Keyword, THEN THE Validation_Layer SHALL mengizinkan slug digunakan

### Requirement 4: Setup Wizard Accessibility

**User Story:** Sebagai user baru yang login via Google OAuth, saya ingin dapat mengakses setup wizard untuk membuat tenant pertama saya, sehingga saya dapat mulai menggunakan aplikasi.

#### Acceptance Criteria

1. WHEN user baru berhasil login via Google OAuth dan belum memiliki tenant, THEN THE Router SHALL mengarahkan user ke `/setup-cafe`
2. WHEN user mengakses `/setup-cafe` secara langsung, THE Router SHALL menampilkan Setup_Wizard component
3. WHEN user sudah memiliki tenant dan mengakses `/setup-cafe`, THE Router SHALL mengarahkan ke dashboard tenant mereka
4. WHEN user di Setup_Wizard submit form dengan slug valid, THE Router SHALL membuat tenant dan redirect ke dashboard

### Requirement 5: Backward Compatibility

**User Story:** Sebagai existing tenant, saya ingin storefront saya tetap dapat diakses melalui slug yang sudah ada, sehingga customer saya tidak mengalami gangguan.

#### Acceptance Criteria

1. WHEN customer mengakses URL dengan existing tenant slug, THE Router SHALL menampilkan Storefront component dengan data tenant yang benar
2. WHEN tenant slug tidak ditemukan di database, THE Router SHALL menampilkan error message atau redirect ke landing page
3. THE Router SHALL mempertahankan semua nested routes di bawah `/:tenantSlug` (contoh: `/:slug/keranjang`, `/:slug/pesanan`)
