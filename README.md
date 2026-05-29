# XAU Step 8O Order Search Admin

Fitur baru:
- Search box di Pending Payment Orders.
- Admin bisa cari order berdasarkan:
  - Email
  - UID
  - Order ID
  - Paket
  - Harga
  - Status
  - Created At
  - Premium Until
  - Admin Note

Cara kerja:
- Search bekerja di dalam filter aktif.
- Kalau filter Pending aktif, search hanya mencari di order Pending.
- Kalau filter All aktif, search mencari semua order.
- Pagination tetap 6 baris.
- Saat search berubah, halaman reset ke Page 1.
- Export CSV mengikuti hasil filter + search.

Tidak disentuh:
- Admin row Manage user
- Chart/candle
- MQ5
- Approve/reject logic
- Telegram/email notify
- User Payment History
- Revenue Summary

Cara test:
1. Login admin.
2. Buka Admin Panel.
3. Isi Admin Token.
4. Klik Refresh Orders.
5. Pilih filter All.
6. Ketik email/UID/order ID di Search Order.
7. Hasil harus menyempit sesuai keyword.
8. Klik Clear untuk reset search.
9. Export CSV saat search aktif harus export hasil search saja.

MQ5:
- Tidak perlu update.