# Step 10BG - Result Queue Scroll All

Update UI Auto Result supaya semua sinyal utama yang masih berjalan tetap ditampilkan, tetapi daftar memakai scroll agar halaman tidak terlalu panjang.

## Perubahan

- Panel Auto Result tidak lagi membatasi tampilan ke 12 sinyal aktif.
- Semua sinyal utama berstatus Berjalan ditampilkan di daftar pantauan.
- Kalau jumlah sinyal aktif lebih dari 6, daftar otomatis masuk mode scroll.
- Header daftar dibuat sticky saat scroll.
- Tambah info kecil bahwa semua sinyal tetap ditampilkan dan bisa discroll.

## Catatan

Logic strategi, Telegram, TP1 BE, dan result tracker tidak berubah. Ini hanya perapihan tampilan agar History dan Auto Result tetap terasa sinkron tanpa membuat halaman terlalu panjang.
