# XAU UI-1 Premium Dashboard Tabs + Payments Tab

Update:
- Tambah navbar/tab premium:
  - Live Signal
  - Payments
  - Analytics
  - History
  - Telegram
  - Account
- Payment History dipindahkan ke tab Payments.
- Tab lain diberi placeholder dulu agar tidak langsung rombak semua.
- Tujuan: dashboard utama tidak terlalu numpuk di tengah.

Catatan:
- Ini tahap awal UI split.
- Fokus utama: Payment History tidak lagi muncul langsung di dashboard utama.
- Tahap berikutnya:
  UI-2: pindahkan Performance Analytics ke tab Analytics.
  UI-3: pindahkan Call History ke tab History.
  UI-4: pindahkan Telegram Connect ke tab Telegram.
  UI-5: dashboard Live Signal hanya berisi chart/candle, scalping M1, main call, confirmation snapshot.

Tidak disentuh:
- Admin row Manage
- Payment approve/reject
- Telegram logic
- MQ5
- Chart/candle logic

Cara test:
1. Deploy.
2. Login premium.
3. Pastikan tab muncul.
4. Klik Payments.
5. Payment History harus tampil di tab Payments.
6. Klik Live Signal.
7. Dashboard signal tetap tampil.

MQ5:
- Tidak perlu update.