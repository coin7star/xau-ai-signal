# XAU Rollback UI-1 Tabs Blank to Step 8J

Recovery:
- Rollback dari UI-1 Premium Dashboard Tabs yang bikin blank setelah loading.
- Balik ke Step 8J User Payment History yang sebelumnya work.

Fitur yang tetap ada:
- Step 8A Payment Order Pending
- Step 8B Admin Pending Orders
- Step 8D Telegram Admin Order Notify
- Step 8E Anti-Spam Payment Order
- Step 8F Pending Orders Pagination
- Step 8G User Telegram Order Status
- Step 8H Optional Email Notify
- Step 8I Order Filter Admin
- Step 8J User Payment History
- Chart/candle normal
- Admin Panel normal

Yang ditahan:
- Premium dashboard tabs/navbar
- Move Payment History to Payments tab
- UI split dashboard

Catatan:
- UI tabs menyentuh area dashboard utama dan menyebabkan runtime blank.
- Kalau mau lanjut tab, harus rombak manual lebih hati-hati atau bikin tab CSS-only di section terpisah.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.