# XAU Manual Payment Step 6 Full Fix

Step 6 awal:
- Manual Payment Mode.
- Belum payment gateway otomatis.
- Landing page sekarang punya section Manual Payment.
- Paywall punya instruksi aktivasi premium.
- Paket:
  - 7 Day = Rp10K
  - 30 Day = Rp30K
- User kirim bukti pembayaran ke admin.
- Admin aktifkan premium dari Admin Panel.

Constants di src/App.jsx:
- ADMIN_CONTACT_URL
- PAYMENT_QRIS_URL
- PAYMENT_DANA
- PAYMENT_OVO
- PAYMENT_BANK
- PACKAGE_7D_PRICE
- PACKAGE_30D_PRICE

Yang perlu kamu edit nanti:
- PAYMENT_DANA = nomor DANA kamu
- PAYMENT_OVO = nomor OVO kamu
- PAYMENT_BANK = info bank kamu
- ADMIN_CONTACT_URL = link admin/telegram/whatsapp kamu

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.