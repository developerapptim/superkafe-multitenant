# Requirements Document

## Introduction

Fitur Seamless Branding Integration bertujuan untuk menyelaraskan tampilan Admin Panel dengan identitas visual Landing Page yang menggunakan skema warna Putih-Cokelat. Fitur ini memungkinkan pemilik tenant untuk memilih tema tampilan (light-coffee atau tema default) yang akan tersimpan secara permanen di database, serta memberikan pengalaman onboarding yang personal melalui popup pemilihan tema saat pertama kali membuat akun.

## Glossary

- **Admin_Panel**: Antarmuka administrasi untuk pemilik tenant mengelola restoran
- **Landing_Page**: Halaman utama publik dengan skema warna putih-cokelat
- **Theme_System**: Sistem pengelolaan tema visual menggunakan CSS variables
- **Theme_Preset**: Konfigurasi warna yang telah ditentukan (default atau light-coffee)
- **Settings_Page**: Halaman pengaturan di Admin Panel untuk konfigurasi tenant
- **Customer_View**: Halaman yang dilihat oleh pelanggan (MenuCustomer.jsx)
- **Theme_Selector_Popup**: Modal dialog untuk memilih tema saat pertama kali login
- **Database_Preference**: Penyimpanan pilihan tema di database superkafe_main
- **CSS_Variables**: Variabel CSS dinamis untuk styling komponen
- **Navigation_System**: Sistem routing internal menggunakan useNavigate
- **First_Time_Flag**: Penanda bahwa user baru pertama kali login

## Requirements

### Requirement 1: Theme Preset Definition

**User Story:** Sebagai developer, saya ingin mendefinisikan preset tema di themeStyles.js, sehingga sistem memiliki konfigurasi warna yang konsisten dan dapat digunakan kembali.

#### Acceptance Criteria

1. THE Theme_System SHALL menyediakan preset tema default dengan konfigurasi warna yang sudah ada saat ini
2. THE Theme_System SHALL menyediakan preset tema light-coffee dengan spesifikasi berikut:
   - bgMain: '#FFFFFF'
   - bgSidebar: '#4E342E'
   - accentColor: '#A0522D'
   - textPrimary: '#2D2D2D'
3. THE Theme_System SHALL mengekspor kedua preset tema sebagai objek JavaScript yang dapat diimpor oleh komponen lain
4. FOR ALL theme presets, setiap preset SHALL memiliki properti bgMain, bgSidebar, accentColor, dan textPrimary

### Requirement 2: Theme Selection UI in Admin Settings

**User Story:** Sebagai pemilik tenant, saya ingin memilih mode tampilan (Light/Dark) di halaman Pengaturan Admin, sehingga saya dapat menyesuaikan tampilan Admin Panel sesuai preferensi saya.

#### Acceptance Criteria

1. THE Settings_Page SHALL menampilkan opsi 'Mode Tampilan' dengan pilihan tema yang tersedia
2. WHEN pemilik tenant memilih tema, THE Settings_Page SHALL menampilkan preview visual dari tema yang dipilih
3. WHEN pemilik tenant menyimpan pilihan tema, THE Settings_Page SHALL mengirim request ke backend untuk menyimpan preferensi
4. WHEN penyimpanan tema berhasil, THE Settings_Page SHALL menerapkan tema baru ke seluruh Admin_Panel secara real-time
5. IF penyimpanan tema gagal, THEN THE Settings_Page SHALL menampilkan pesan error dan mempertahankan tema sebelumnya

### Requirement 3: Theme Persistence in Database

**User Story:** Sebagai pemilik tenant, saya ingin pilihan tema saya tersimpan secara permanen, sehingga preferensi saya tetap ada setiap kali saya login.

#### Acceptance Criteria

1. THE Database_Preference SHALL menyimpan field selectedTheme di collection tenants dalam database superkafe_main
2. WHEN pemilik tenant menyimpan pilihan tema, THE Backend SHALL memperbarui field selectedTheme untuk tenant yang sesuai
3. WHEN pemilik tenant login, THE Backend SHALL mengirimkan nilai selectedTheme sebagai bagian dari data autentikasi
4. THE Backend SHALL memvalidasi bahwa nilai selectedTheme adalah salah satu dari preset tema yang valid
5. IF selectedTheme tidak valid atau kosong, THEN THE Backend SHALL menggunakan tema default

### Requirement 4: Internal Navigation for Customer Preview

**User Story:** Sebagai pemilik tenant, saya ingin berpindah ke tampilan customer secara internal, sehingga saya dapat melihat preview tanpa membuka tab baru.

#### Acceptance Criteria

1. THE Navigation_System SHALL menggunakan useNavigate untuk menu 'Lihat Tampilan Customer'
2. WHEN pemilik tenant mengklik 'Lihat Tampilan Customer', THE Navigation_System SHALL menavigasi ke halaman customer dalam aplikasi yang sama
3. THE Navigation_System SHALL mempertahankan konteks autentikasi saat berpindah ke Customer_View
4. THE Navigation_System SHALL menyediakan tombol kembali ke Admin_Panel dari Customer_View

### Requirement 5: Dynamic CSS Variables Implementation

**User Story:** Sebagai developer, saya ingin menggunakan CSS variables untuk styling dinamis, sehingga semua komponen admin otomatis berubah warna saat tema berganti.

#### Acceptance Criteria

1. THE Theme_System SHALL mendefinisikan CSS variables untuk setiap properti tema (--bg-main, --bg-sidebar, --accent-color, --text-primary)
2. WHEN tema berubah, THE Theme_System SHALL memperbarui nilai CSS variables di root element
3. THE Admin_Panel SHALL menggunakan CSS variables untuk semua styling yang terkait dengan tema
4. THE Customer_View SHALL tetap menggunakan warna default (ungu dark blue) dan tidak terpengaruh oleh perubahan tema admin
5. FOR ALL komponen admin dengan background putih, komponen SHALL memiliki shadow lembut untuk keterbacaan

### Requirement 6: Visual Contrast and Readability

**User Story:** Sebagai pemilik tenant, saya ingin elemen UI tetap terbaca jelas dengan tema light-coffee, sehingga saya dapat menggunakan Admin Panel dengan nyaman.

#### Acceptance Criteria

1. WHEN tema light-coffee aktif, THE Admin_Panel SHALL menerapkan shadow lembut pada kartu dan komponen dengan background putih
2. THE Theme_System SHALL memastikan kontras warna antara teks dan background memenuhi standar keterbacaan minimal (WCAG AA)
3. THE Admin_Panel SHALL menggunakan textPrimary '#2D2D2D' untuk teks utama pada background putih
4. THE Admin_Panel SHALL menggunakan accentColor '#A0522D' untuk tombol dan elemen interaktif utama

### Requirement 7: First-Time Theme Selection Popup

**User Story:** Sebagai pemilik tenant baru, saya ingin memilih tema saat pertama kali login, sehingga saya dapat langsung menyesuaikan tampilan sesuai preferensi saya.

#### Acceptance Criteria

1. WHEN pemilik tenant login untuk pertama kali setelah membuat akun, THE Theme_Selector_Popup SHALL muncul secara otomatis
2. THE Theme_Selector_Popup SHALL menampilkan preview visual dari setiap tema yang tersedia
3. WHEN pemilik tenant memilih tema di popup, THE Theme_Selector_Popup SHALL menyimpan pilihan ke database dan menerapkan tema
4. WHEN pemilik tenant menutup popup tanpa memilih, THE Theme_Selector_Popup SHALL menerapkan tema default
5. THE Theme_Selector_Popup SHALL muncul hanya sekali per tenant (saat pertama kali membuat akun)
6. THE Backend SHALL menyimpan First_Time_Flag untuk menandai bahwa popup sudah pernah ditampilkan

### Requirement 8: Theme Scope Isolation

**User Story:** Sebagai developer, saya ingin memastikan tema admin tidak mempengaruhi halaman customer, sehingga kedua area memiliki identitas visual yang independen.

#### Acceptance Criteria

1. THE Theme_System SHALL menerapkan tema hanya pada komponen di folder admin/
2. THE Customer_View SHALL menggunakan stylesheet terpisah yang tidak terpengaruh CSS variables tema admin
3. WHEN tema admin berubah, THE Customer_View SHALL tetap menampilkan warna default (ungu dark blue)
4. THE Theme_System SHALL mempersiapkan struktur untuk fitur pemilihan tema customer di masa depan tanpa mengimplementasikannya

### Requirement 9: Theme Synchronization Across Sessions

**User Story:** Sebagai pemilik tenant, saya ingin tema yang saya pilih konsisten di semua perangkat dan sesi, sehingga pengalaman saya seragam.

#### Acceptance Criteria

1. WHEN pemilik tenant login dari perangkat berbeda, THE Admin_Panel SHALL menerapkan tema yang tersimpan di database
2. WHEN pemilik tenant mengubah tema, THE Theme_System SHALL memperbarui tampilan di semua tab browser yang aktif untuk tenant tersebut
3. THE Theme_System SHALL mengambil preferensi tema dari server, bukan dari localStorage
4. IF koneksi ke server gagal saat mengambil tema, THEN THE Theme_System SHALL menggunakan tema default sebagai fallback

### Requirement 10: Backend API for Theme Management

**User Story:** Sebagai developer, saya ingin API backend untuk mengelola tema, sehingga frontend dapat menyimpan dan mengambil preferensi tema dengan aman.

#### Acceptance Criteria

1. THE Backend SHALL menyediakan endpoint PUT /api/tenants/:tenantId/theme untuk memperbarui tema
2. THE Backend SHALL menyediakan endpoint GET /api/tenants/:tenantId/theme untuk mengambil tema saat ini
3. WHEN request theme update diterima, THE Backend SHALL memvalidasi bahwa user memiliki hak akses ke tenant tersebut
4. WHEN request theme update diterima, THE Backend SHALL memvalidasi bahwa nilai tema adalah preset yang valid
5. THE Backend SHALL mengembalikan tema sebagai bagian dari response login/authentication
6. IF user tidak memiliki hak akses, THEN THE Backend SHALL mengembalikan error 403 Forbidden
