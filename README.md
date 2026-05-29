# XAU Paywall Package Selection Full Fix

Update:
- Paywall FREE user sekarang punya pilihan paket:
  - 7 Day = Rp10K
  - 30 Day = Rp30K
- User pilih paket sebelum klik Hubungi Admin.
- Tombol Hubungi Admin membawa pesan berisi:
  - Paket dipilih
  - Harga
  - Email user
  - UID user
- Instruksi paywall lebih nyambung dengan landing page.
- Teks endpoint internal /api/admin-user dihapus dari tampilan user.

Catatan:
- Link ADMIN_CONTACT_URL sekarang ditambah ?text=...
- Untuk Telegram bot link normal bisa saja text parameter tidak selalu otomatis masuk tergantung client.
- Kalau mau lebih cocok untuk WhatsApp nanti ganti ADMIN_CONTACT_URL ke format wa.me.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.