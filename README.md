# XAU Step 8F Pending Orders Pagination

Update:
- Pending Orders sekarang tampil 6 order per halaman.
- Kalau total order lebih dari 6, muncul tombol:
  - Prev
  - Next
  - Page X / Y
- Saat Refresh Orders, halaman balik ke Page 1.
- Tidak mengubah Admin row Manage.
- Tidak mengubah chart/candle.
- Tidak mengubah MQ5.

Cara kerja:
- ordersPerPage = 6
- safeOrders di-slice berdasarkan halaman aktif
- tombol Next otomatis aktif kalau total order lebih dari 6

Cara test:
1. Buat lebih dari 6 paymentOrders di Firebase.
2. Login admin.
3. Klik Refresh Orders.
4. Harus tampil 6 order pertama.
5. Klik Next untuk melihat order berikutnya.
6. Klik Prev untuk kembali.

MQ5:
- Tidak perlu update.