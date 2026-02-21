# 🚀 Local Storage - Quick Reference Guide

## ⚡ Quick Start

### Upload Image dari Frontend

```javascript
// Example: Upload menu image
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const response = await fetch('http://your-domain.com/api/upload/images/menu', {
  method: 'POST',
  headers: {
    'x-api-key': 'your-api-key'
  },
  body: formData
});

const result = await response.json();
console.log(result.imageUrl); // /uploads/images/menu/menu-123456789-abc.jpg
```

### Display Image di Frontend

```javascript
// Gunakan imageUrl dari response
<img src={`http://your-domain.com${result.imageUrl}`} alt="Menu" />

// Atau jika base URL sudah dikonfigurasi
<img src={result.imageUrl} alt="Menu" />
```

---

## 📡 API Endpoints

### 1. Upload Menu Image
```
POST /api/upload/images/menu
Headers: x-api-key
Body: multipart/form-data (field: image)
```

### 2. Upload Profile Image
```
POST /api/upload/images/profile
Headers: x-api-key
Body: multipart/form-data (field: image)
```

### 3. Upload General Image
```
POST /api/upload/images/general
Headers: x-api-key
Body: multipart/form-data (field: image)
```

### 4. Delete Image
```
DELETE /api/upload/images/:category/:filename
Headers: x-api-key
```

---

## 📁 Image URLs

### Format
```
/uploads/images/{category}/{filename}
```

### Examples
```
/uploads/images/menu/menu-1234567890-abc123.jpg
/uploads/images/banners/banner-1234567890-xyz789.jpg
/uploads/images/profiles/profile-1234567890-def456.jpg
/uploads/payments/payment-1234567890-jkl012.png
```

---

## 🐳 Docker Commands

### Start Services
```bash
docker-compose up -d
```

### Restart Backend
```bash
docker-compose restart backend
```

### View Logs
```bash
docker-compose logs -f backend
```

### Check Uploads Folder
```bash
ls -lah backend/public/uploads/images/
```

---

## 🔧 Troubleshooting

### Images not showing?
1. Check static serving: `app.use('/uploads', express.static(...))`
2. Check file exists: `ls backend/public/uploads/images/menu/`
3. Check permissions: `chmod -R 755 backend/public/uploads/`

### Upload fails?
1. Check file size (max 10MB)
2. Check file type (only images)
3. Check API key header
4. Check folder permissions

### Images lost after restart?
1. Check Docker volume mapping in docker-compose.yml
2. Verify: `docker inspect superkafe-backend | grep Mounts`

---

## 📊 File Limits

| Type | Max Size | Allowed Formats |
|------|----------|-----------------|
| Menu | 10MB | JPEG, PNG, GIF, WebP |
| Profile | 5MB | JPEG, PNG, WebP |
| Banner | 10MB | JPEG, PNG, GIF, WebP |
| Payment | 10MB | All images |
| General | 10MB | All images |

---

## 🔐 Security

- ✅ File type validation
- ✅ File size limits
- ✅ Unique filenames (prevent overwrite)
- ✅ API key authentication
- ✅ Path traversal protection

---

## 💾 Backup

```bash
# Backup uploads
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz backend/public/uploads/

# Restore
tar -xzf uploads-backup-20240221.tar.gz
```

---

## 📞 Support

**Documentation:**
- Full Guide: `LOCAL_STORAGE_IMPLEMENTATION.md`
- Migration Plan: `LOCAL_STORAGE_MIGRATION_PLAN.md`

**Status:** ✅ Production Ready
