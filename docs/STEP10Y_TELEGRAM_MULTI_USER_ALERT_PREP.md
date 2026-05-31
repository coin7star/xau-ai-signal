# Step 10Y — Telegram Multi-user Alert Prep

Step ini menyiapkan fondasi Telegram multi-user sebelum broadcast alert premium diaktifkan.

## Isi update
- Telegram connected user otomatis punya preferensi alert.
- User connected bisa toggle Main Signal Alert dan Result Alert dari panel Telegram.
- Admin panel menampilkan jumlah user Telegram dengan alert aktif.
- Data disimpan di `/users/{uid}`: `telegramAlertEnabled`, `telegramAlertMainSignal`, `telegramAlertResult`, `telegramAlertUpdatedAt`.

## Catatan
Step ini belum mengirim alert massal ke semua premium user. Broadcast multi-user penuh disiapkan untuk Step 11 agar aman dari spam dan duplicate alert.
