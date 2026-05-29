# XAU Step 8B Admin Pending Orders

Fitur baru:
- Admin bisa melihat order pending dari web.
- Section baru: Pending Payment Orders.
- Tidak mengubah row Manage user.
- Tidak menyentuh chart/candle.
- Tidak menyentuh MQ5.

Endpoint baru:
- GET /api/admin-orders
  Load paymentOrders dari Firebase.
- POST /api/admin-orders
  action approve / reject.

Approve:
- Update paymentOrders/{orderId}/status = approved.
- Set users/{uid}/role = premium.
- Set users/{uid}/premiumUntil sesuai paket:
  7D = +7 hari
  30D = +30 hari.
- Update lastPaymentStatus = approved.

Reject:
- Update paymentOrders/{orderId}/status = rejected.
- Update users/{uid}/lastPaymentStatus = rejected.

Cara test:
1. Login akun free.
2. Buat order pending dari paywall.
3. Login admin.
4. Buka Admin Panel.
5. Isi Admin Token.
6. Klik Refresh Orders.
7. Klik Approve.
8. Cek user jadi premium.

ENV dibutuhkan:
- ADMIN_ACTION_TOKEN
- FIREBASE_DATABASE_URL

Catatan:
- Section ini dibuat terpisah agar tidak mengganggu row Admin Panel yang sensitif.
- Kalau order belum muncul, klik Refresh Orders.