# Step 10AQ3 - Blank Screen Safe Mode

Hotfix untuk mencegah dashboard blank saat koneksi MT5/VPS reconnecting atau candle M5 kosong.

Perubahan:
- Tambah Error Boundary agar runtime error tidak membuat halaman blank.
- Chart sync dibuat lebih aman dengan try/catch.
- EMA / Entry / TP / SL lines tidak crash saat data kosong atau chart sedang re-init.
- Jika terjadi error, dashboard menampilkan Safe Mode dengan tombol Muat Ulang.
- Garis entry limit tetap digambar ulang saat signal/mainM5 berubah.
