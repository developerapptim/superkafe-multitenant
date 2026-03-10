#!/bin/bash

# ==============================================================================
# Script to fix '413 Request Entity Too Large' error on Nginx for SuperKafe
# ==============================================================================

echo "Memeriksa konfigurasi Nginx..."

# Backup konfigurasi Nginx saat ini
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
echo "✅ Backup konfigurasi dibuat di /etc/nginx/nginx.conf.bak"

# Mengecek apakah client_max_body_size sudah ada
if grep -q "client_max_body_size" /etc/nginx/nginx.conf; then
    echo "⚠️ Aturan client_max_body_size sudah ada. Sedang diperbarui menjadi 100M..."
    # Sed rules untuk mengubah nilai client_max_body_size yang sudah ada
    sudo sed -i 's/client_max_body_size.*/client_max_body_size 100M;/g' /etc/nginx/nginx.conf
else
    echo "⚠️ Aturan client_max_body_size tidak ditemukan. Menambahkan aturan baru sebesar 100M..."
    # Menambahkan client_max_body_size ke dalam blok http {}
    sudo sed -i '/http {/a \    client_max_body_size 100M;' /etc/nginx/nginx.conf
fi

# Tes konfigurasi Nginx
echo "🛠️ Menjalankan pengujian konfigurasi Nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Konfigurasi Nginx valid. Sedang me-restart Nginx..."
    sudo systemctl restart nginx
    echo "🎉 Selesai! Nginx berhasil di-restart. Silakan coba upload banner lagi."
else
    echo "❌ Konfigurasi Nginx tidak valid! Memulihkan backup..."
    sudo cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf
    sudo systemctl restart nginx
    echo "🔄 Backup telah dipulihkan. Silakan periksa error di atas."
fi
