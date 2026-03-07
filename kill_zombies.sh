#!/bin/bash
# Script: kill_zombies.sh
# Tujuan: Menghentikan sisa-sisa load tester (npx/autocannon) baik di Host maupun dalam Docker

echo "🔍 Mencari proses nakal yang bersembunyi di Host dan Docker..."

# 1. Identifikasi proses pemakan CPU tertinggi
echo "📊 Top 5 proses pemakan CPU saat ini:"
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head -n 6

# 2. Bunuh proses npx / autocannon yang disamarkan sebagai eksekusi node statis di Host (Ubuntu)
# Bukti dari tangkapan layar: proses memakan CPU berada di /root/.npm/_npx/ dan /root/.nvm/
echo "🚨 Menghentikan proses npx dari direktori sementara (_npx / .nvm)..."
for pid in $(ps aux | grep -E '\.npm/_npx/|\.nvm/' | grep -v grep | awk '{print $2}'); do
    echo "Membunuh PID: $pid"
    kill -9 $pid
done

# 3. Membersihkan Load Tester yang terjebak di dalam Docker Container
# Karena Superkafe menggunakan Docker Compose, skrip yang terespons di background container butuh direstart
echo "🐳 Merestart Container Backend via Docker Compose untuk flush memori mutlak..."
# Asumsi path docker-compose (sesuaikan jika berbeda)
if [ -f "docker-compose.yml" ]; then
    docker compose restart backend
else
    # Fallback global restart docker restart
    container_id=$(docker ps -q -f name=backend)
    if [ ! -z "$container_id" ]; then
        docker restart $container_id
    else
        echo "⚠️ Container backend tidak ditemukan dengan nama 'backend'. Melewati restart otomatis Docker."
    fi
fi

# 4. Restart Host PM2 jika ada
if command -v pm2 &> /dev/null; then
    echo "🔄 Merestart Host PM2..."
    pm2 reload all --update-env || true
fi

echo "✅ Selesai. Eksekusi npx host berhasil dibersihkan dan container backend disegarkan."
echo "Silakan periksa kembali penggunaan CPU dengan 'htop'."
