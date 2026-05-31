# Step 10N Hotfix — Admin Blank Fix

Hotfix ini memperbaiki tab Admin yang blank setelah accordion awal.

Penyebab paling mungkin: semua panel admin langsung dirender sekaligus saat tab Admin dibuka. Pada beberapa kondisi, salah satu panel bisa membuat React crash dan halaman jadi kosong.

Fix:
- Admin dibuat sebagai launcher/jendela.
- Detail panel baru dirender setelah diklik.
- Tombol Tutup Panel ditambahkan.
- Layout tetap ringkas di PC dan HP.
