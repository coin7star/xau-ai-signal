# XAU Step 8J User Payment History

Fitur baru:
- User melihat riwayat pembayaran di dashboard.
- Card baru: Payment History.
- Menampilkan maksimal 6 order terbaru user.
- Menampilkan:
  - Paket
  - Order ID
  - Harga
  - Tanggal order
  - Status pending/approved/rejected
  - Aktif sampai untuk order approved
- Ada tombol Refresh.
- Ada counter:
  - Sukses
  - Total

Teknis:
- Tambah getUserPaymentOrders(uid) di firebaseClient.js.
- Membaca paymentOrders lalu filter order sesuai uid user.
- Data dirender aman pakai safePaymentText dan safePaymentDate.
- Tidak menyentuh Admin row Manage.
- Tidak menyentuh chart/candle.
- Tidak menyentuh MQ5.

Catatan:
- Kalau user belum pernah membuat order, card tampil empty state.
- Kalau user punya order approved, card menampilkan status sukses dan premiumUntil.

Cara test:
1. Login user yang pernah membuat order.
2. Masuk dashboard.
3. Lihat card Payment History.
4. Klik Refresh.
5. Order approved harus tampil sebagai APPROVED.

MQ5:
- Tidak perlu update.