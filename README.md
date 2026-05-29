# XAU Step 8I Order Filter Admin

Fitur baru:
- Filter Pending Orders di Admin Panel:
  - Pending
  - Approved
  - Rejected
  - All
- Pending Orders tetap 6 order per halaman.
- Pagination tetap jalan.
- Saat filter diganti, page reset ke Page 1.
- Statistik order sekarang menampilkan:
  - Pending
  - Approved
  - Rejected
  - Total

Tidak disentuh:
- Admin row Manage
- Chart/candle
- MQ5
- Telegram signal logic
- Payment approve/reject logic
- Optional email notify Step 8H

Cara test:
1. Login admin.
2. Buka Admin Panel.
3. Isi Admin Token.
4. Klik Refresh Orders.
5. Klik filter Pending / Approved / Rejected / All.
6. Jika order lebih dari 6, tombol Prev/Next tetap jalan per filter.

MQ5:
- Tidak perlu update.