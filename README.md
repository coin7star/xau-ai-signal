# XAU Manual Payment No Duplicate Polish

Masalah:
- Landing page menampilkan pricing 7 Day/30 Day dua kali:
  1. Pilih paket premium
  2. Aktivasi premium manual

Fix:
- Pricing utama tetap di section "Pilih paket premium".
- Section "Aktivasi premium manual" diubah menjadi:
  - Alur Aktivasi
  - Metode Pembayaran
- Card harga 7 Day/30 Day tidak diulang lagi.
- Section "Cara mulai pakai premium" yang duplikat juga dihapus agar landing lebih ringkas.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.