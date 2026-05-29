# XAU Step 8N Monthly Revenue Summary

Fitur baru:
- Payment Summary di Admin Pending Orders.
- Menghitung estimasi omzet dari order approved.

Data yang tampil:
- Revenue bulan ini
- Revenue 7 hari terakhir
- Total omzet approved
- Total approved order
- Total pending order
- Total rejected order
- Paket 7D terjual
- Paket 30D terjual

Perhitungan:
- Hanya order status approved yang masuk omzet.
- Paket Rp10K dihitung 10.000.
- Paket Rp30K dihitung 30.000.
- Revenue bulan ini memakai approvedAt jika ada, fallback ke createdAt.
- Revenue 7 hari terakhir memakai approvedAt jika ada, fallback ke createdAt.

Tidak disentuh:
- Admin row Manage user
- Chart/candle
- MQ5
- Approve/reject logic
- Telegram/email notify
- User Payment History
- Export CSV

Cara test:
1. Login admin.
2. Buka Admin Panel.
3. Isi Admin Token.
4. Klik Refresh Orders.
5. Payment Summary harus menampilkan angka omzet/order.
6. Approve order baru, Refresh Orders, angka summary berubah.

MQ5:
- Tidak perlu update.