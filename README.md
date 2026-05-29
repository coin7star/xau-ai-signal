# XAU Step 8A Payment Order Pending

Fitur baru:
- User free bisa pilih paket 7D / 30D di paywall.
- User klik Konfirmasi Pembayaran.
- Sistem membuat order pending di Firebase RTDB:
  /paymentOrders/{orderId}

Data order:
- orderId
- uid
- email
- packageCode
- packageLabel
- price
- status: pending
- source: paywall
- createdAt
- updatedAt

User profile juga diupdate:
- lastPaymentOrderId
- lastPaymentPackage
- lastPaymentPrice
- lastPaymentStatus
- lastPaymentCreatedAt

Belum ditambah:
- Admin Pending Orders section
- Approve order otomatis
- Upload bukti pembayaran

Alasan:
- Step 8A dibuat kecil dan aman.
- Tidak menyentuh Admin Panel.
- Tidak menyentuh chart/candle.
- Tidak menyentuh Telegram/MQ5.

Cara test:
1. Login akun free.
2. Pilih paket 7 Day / 30 Day.
3. Klik Konfirmasi Pembayaran.
4. Cek Firebase RTDB:
   paymentOrders/{orderId}
5. Cek users/{uid}/lastPaymentStatus = pending

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.