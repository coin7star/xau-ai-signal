# XAU Step 8M Export Payment Orders CSV

Fitur baru:
- Admin bisa export payment orders ke CSV.
- Tombol Export CSV ada di section Pending Payment Orders.
- Export mengikuti filter aktif:
  - Pending
  - Approved
  - Rejected
  - All
- Data yang diexport adalah semua order dalam filter aktif, bukan hanya 6 baris halaman aktif.

Kolom CSV:
- Order ID
- Email
- UID
- Paket
- Harga
- Status
- Created At
- Premium Until
- Admin Note

Nama file:
xau-payment-orders-{filter}-{tanggal}.csv

Contoh:
xau-payment-orders-pending-2026-05-29.csv

Tidak disentuh:
- Admin row Manage user
- Chart/candle
- MQ5
- Approve/reject logic
- Telegram/email notify
- User Payment History

Cara test:
1. Login admin.
2. Buka Admin Panel.
3. Isi Admin Token.
4. Klik Refresh Orders.
5. Pilih filter Pending/Approved/Rejected/All.
6. Klik Export CSV.
7. File CSV harus terdownload.

MQ5:
- Tidak perlu update.