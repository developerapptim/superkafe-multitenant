# Nginx SPA Routing Fix

## Problem
Ketika user melakukan refresh pada halaman tertentu (seperti `/auth/login` atau `/{tenantSlug}/admin/dashboard`), Nginx mengembalikan error 404. Ini terjadi karena Nginx mencoba mencari file fisik yang sesuai dengan path tersebut, padahal aplikasi React menggunakan client-side routing.

## Root Cause
Dockerfile frontend menggunakan Nginx default configuration yang tidak memiliki `try_files` directive untuk menangani SPA (Single Page Application) routing. Tanpa konfigurasi ini, semua route selain root (`/`) akan menghasilkan 404 saat di-refresh.

## Solution Implemented

### 1. Created Custom Nginx Configuration (`frontend/nginx.conf`)

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Directive `try_files` ini bekerja dengan urutan:
1. **`$uri`** - Coba cari file dengan path yang diminta (untuk static assets)
2. **`$uri/`** - Coba cari sebagai directory
3. **`/index.html`** - Jika tidak ditemukan, fallback ke index.html (React Router akan handle routing)

### 2. Additional Features in nginx.conf

**Gzip Compression:**
```nginx
gzip on;
gzip_types text/plain text/css application/javascript application/json;
```
- Mengurangi ukuran transfer data
- Mempercepat loading aplikasi

**Static Asset Caching:**
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```
- Cache static files selama 1 tahun
- Mengurangi bandwidth dan mempercepat loading

**Security Headers:**
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```
- Melindungi dari clickjacking
- Mencegah MIME type sniffing
- Proteksi XSS

**API & Socket.io Proxy:**
```nginx
location /api/ {
    proxy_pass http://backend:5001/api/;
    # ... proxy headers
}

location /socket.io/ {
    proxy_pass http://backend:5001/socket.io/;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
- Proxy requests ke backend
- Support WebSocket untuk Socket.io

### 3. Updated Dockerfile

```dockerfile
# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

## Testing

### Test Scenarios:
1. **Direct Navigation** - Navigate to `/{tenantSlug}/admin/dashboard` directly ✅
2. **Browser Refresh** - Refresh pada halaman dashboard ✅
3. **Deep Link** - Akses URL seperti `/auth/login` langsung dari browser ✅
4. **Auto-Redirect** - Fitur auto-redirect tetap berfungsi normal ✅

### How to Test:
```bash
# Build and run frontend container
cd frontend
docker build -t superkafe-frontend .
docker run -p 3000:80 superkafe-frontend

# Test routes
curl http://localhost:3000/
curl http://localhost:3000/auth/login
curl http://localhost:3000/negoes/admin/dashboard
```

Semua route seharusnya mengembalikan `index.html` dengan status 200.

## Compatibility with Auto-Redirect Feature

Konfigurasi ini **tidak mengganggu** fitur Auto-Redirect karena:

1. **Client-Side Routing Preserved** - React Router tetap menangani routing di client
2. **localStorage Available** - Data `tenant_slug` dan `token` tetap tersedia
3. **No Server-Side Redirect** - Nginx hanya serve `index.html`, tidak melakukan redirect
4. **React App Controls Flow** - Logika redirect tetap di `authHelper.js` dan `ProtectedRoute.jsx`

### Auto-Redirect Flow:
```
User refreshes page
    ↓
Nginx serves index.html (via try_files)
    ↓
React app loads
    ↓
authHelper.js checks localStorage
    ↓
Redirects to appropriate route based on auth state
```

## Files Modified
- ✅ `frontend/nginx.conf` - Created custom Nginx configuration
- ✅ `frontend/Dockerfile` - Updated to use custom nginx.conf

## Deployment Notes

### Docker Compose
If using docker-compose, ensure frontend service is configured:
```yaml
frontend:
  build: ./frontend
  ports:
    - "3000:80"
  depends_on:
    - backend
```

### Environment Variables
Update API URL in frontend if needed:
```env
VITE_API_URL=http://backend:5001
```

### Production Checklist
- [ ] Test all routes with browser refresh
- [ ] Verify static assets are cached properly
- [ ] Check API proxy is working
- [ ] Confirm Socket.io connection works
- [ ] Test auto-redirect after login
- [ ] Verify security headers are present

## Troubleshooting

### Issue: Still getting 404
**Solution:** Rebuild Docker image to include new nginx.conf
```bash
docker build --no-cache -t superkafe-frontend ./frontend
```

### Issue: API calls failing
**Solution:** Check backend URL in nginx.conf proxy_pass directive

### Issue: Socket.io not connecting
**Solution:** Verify WebSocket upgrade headers in nginx.conf

## References
- [Nginx try_files documentation](http://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)
- [React Router deployment guide](https://reactrouter.com/en/main/start/concepts#server-rendering)
- [Nginx SPA configuration best practices](https://www.nginx.com/blog/deploying-nginx-nginx-plus-docker/)
