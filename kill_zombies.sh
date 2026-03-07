#!/bin/bash
# Script: kill_zombies.sh
# Tujuan: Menghentikan sisa-sisa stress test (K6 / Autocannon) penyebab CPU 100%

echo "🔍 Mencari proses Autocannon dan K6 yang bersembunyi di background..."

# 1. Identifikasi proses pemakan CPU tertinggi via top
echo "📊 Top 5 proses pemakan CPU saat ini:"
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%cpu | head -n 6

# 2. Bunuh autocannon
if pgrep "autocannon" > /dev/null; then
    echo "🚨 Autocannon terdeteksi! Menghentikan..."
    pkill -f autocannon
    echo "✅ Autocannon dihentikan."
else
    echo "ℹ️ Tidak menemukan proses autocannon."
fi

# 3. Bunuh K6
if pgrep "k6" > /dev/null; then
    echo "🚨 k6 terdeteksi! Menghentikan..."
    pkill -f k6
    echo "✅ k6 dihentikan."
else
    echo "ℹ️ Tidak menemukan proses k6."
fi

# 4. (Opsional) Restart service NodeJS jika memory bocor parah
# PENTING: Jalankan reload PM2
echo "🔄 Merestart backend PM2 untuk membalikkan Memory Node.js..."
pm2 reload all --update-env

echo "✅ Selesai. Silakan cek penggunaan CPU Anda sekarang (jalankan perintah 'htop')."
