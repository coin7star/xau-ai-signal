# XAU Chart After Login Init Fix

Masalah:
- Setelah fitur login/paywall, chart kadang hitam kosong.
- Penyebab: init chart jalan saat halaman masih Loading/Login.
- Saat dashboard premium muncul, elemen chart baru ada, tapi init chart tidak jalan ulang.

Fix:
- Chart M1/M15 init ulang setelah authUser premium/admin siap.
- Setelah init, data candle dan EMA langsung dipasang ulang.
- Tambah tombol Reload Chart manual di header chart.
- Tambah empty state kalau candle benar-benar kosong.

File berubah:
- src/App.jsx
- src/style.css
- package.json

Cara test:
1. Upload replace semua ke GitHub.
2. Commit.
3. Deploy.
4. Login akun premium/admin.
5. Chart harus muncul otomatis.
6. Kalau Mini App cache, tutup Mini App lalu buka ulang.
7. Kalau masih blank, klik Reload Chart.

MQ5:
- Tidak perlu update, tapi MT5 harus nyala agar data terbaru masuk.