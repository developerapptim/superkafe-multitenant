# 📦 Migrasi Penyimpanan Gambar ke Local Storage

## 🎯 Tujuan
Migrasi dari Cloudinary ke penyimpanan lokal (local disk) di VPS dengan persistensi data menggunakan Docker volumes.

---

## 📊 Analisis Struktur Saat Ini

### Files yang Menggunakan Cloudinary
1. ✅ `backend/utils/cloudinary.js` - Konfigurasi Cloudinary
2. ✅ `backend/controllers/OrderController.js` - Upload payment proof
3. ✅ `backend/controllers/MarketingController.js` - Upload banner
4. ✅ `backend/controllers/MenuController.js` - Optimasi URL Cloudinary
5. ✅ `backend/middleware/uploadMiddleware.js` - Memory storage untuk Cloudinary
6. ✅ `backend/scripts/migrateImages.js` - Script migrasi ke Cloudinary

### Struktur Upload yang Sudah Ada
```
backend/public/uploads/
├── audio/          ✅ Sudah lokal (disk storage)
├── imports/        ✅ Sudah lokal (disk storage)
├── payments/       ❌ Masih Cloudinary (memory storage)
├── restore/        ✅ Sudah lokal (disk storage)
└── sounds/         ✅ Sudah lokal
```

### Static Serving
✅ Sudah dikonfigurasi di `server.js`:
```javascript
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
```

---

## 🔧 Plan Implementasi

### Phase 1: Update Upload Middleware
- [x] Ubah payment storage dari memory ke disk
- [x] Ubah banner storage dari memory ke disk
- [x] Tambah image storage untuk menu items
- [x] Buat folder structure yang lengkap

### Phase 2: Update Controllers
- [x] OrderController: Ganti Cloudinary upload dengan local save
- [x] MarketingController: Ganti Cloudinary upload dengan local save
- [x] MenuController: Hapus optimasi Cloudinary
- [x] Buat ImageController baru untuk general image upload

### Phase 3: Docker Persistence
- [x] Update docker-compose.yml dengan volume mapping
- [x] Ensure uploads folder persists across container restarts

### Phase 4: Cleanup
- [x] Hapus/comment cloudinary.js
- [x] Update .env.example (hapus Cloudinary vars)
- [x] Update dokumentasi

---

## 📁 Struktur Folder Baru

```
backend/public/uploads/
├── images/
│   ├── menu/           # Menu item images
│   ├── banners/        # Marketing banners
│   ├── profiles/       # User profile images
│   └── general/        # General purpose images
├── payments/           # Payment proof images
├── audio/              # Audio files (sudah ada)
├── imports/            # Excel imports (sudah ada)
└── restore/            # Backup files (sudah ada)
```

---

## 🔐 Security Considerations

1. **File Size Limits**: Max 10MB per file
2. **File Type Validation**: Only images (jpg, jpeg, png, gif, webp)
3. **Filename Sanitization**: Generate unique filenames
4. **Path Traversal Protection**: Validate paths
5. **Rate Limiting**: Prevent abuse (future enhancement)

---

## 🐳 Docker Volume Strategy

### Development
```yaml
volumes:
  - ./backend/public/uploads:/app/public/uploads
```

### Production
```yaml
volumes:
  - /var/superkafe/uploads:/app/public/uploads
```

---

## 🚀 Migration Steps

1. ✅ Update uploadMiddleware.js
2. ✅ Create ImageController.js
3. ✅ Update OrderController.js
4. ✅ Update MarketingController.js
5. ✅ Update MenuController.js
6. ✅ Create uploadRoutes.js (enhanced)
7. ✅ Update docker-compose.yml
8. ✅ Test upload functionality
9. ✅ Document changes

---

## 📝 Breaking Changes

### API Changes
**None!** Semua endpoint tetap sama, hanya implementasi internal yang berubah.

### URL Format Changes
**Before (Cloudinary):**
```
https://res.cloudinary.com/xxx/image/upload/v123/folder/image.jpg
```

**After (Local):**
```
http://your-domain.com/uploads/images/menu/image-123456789.jpg
```

### Frontend Impact
Frontend perlu update base URL untuk images jika hardcoded. Jika menggunakan relative URLs, tidak ada perubahan.

---

## ✅ Testing Checklist

- [ ] Upload menu image
- [ ] Upload banner image
- [ ] Upload payment proof
- [ ] View uploaded images via URL
- [ ] Restart Docker container
- [ ] Verify images still accessible
- [ ] Test file size limits
- [ ] Test file type validation
- [ ] Test concurrent uploads

---

## 🔄 Rollback Plan

Jika terjadi masalah:

1. Revert docker-compose.yml
2. Revert controller changes
3. Revert middleware changes
4. Re-enable Cloudinary configuration

Backup files:
- `backend/controllers/OrderController.js.backup`
- `backend/controllers/MarketingController.js.backup`
- `backend/middleware/uploadMiddleware.js.backup`

---

## 📊 Benefits

### Cost Savings
- ❌ No more Cloudinary subscription fees
- ✅ Use VPS storage (already paid)

### Performance
- ✅ Faster uploads (no external API calls)
- ✅ Lower latency for image serving
- ✅ No rate limits

### Control
- ✅ Full control over storage
- ✅ Easy backup and migration
- ✅ No vendor lock-in

### Simplicity
- ✅ Simpler architecture
- ✅ Easier debugging
- ✅ Less dependencies

---

## ⚠️ Considerations

### Disk Space
- Monitor disk usage regularly
- Implement cleanup for old files (future)
- Consider image compression (future)

### Backup
- Include uploads folder in backup strategy
- Regular backups to external storage

### CDN (Future Enhancement)
- Consider adding CDN layer for better performance
- Nginx caching for static files
- Image optimization service

---

**Status:** Ready for Implementation
**Estimated Time:** 2 hours
**Risk Level:** Low (backward compatible)
