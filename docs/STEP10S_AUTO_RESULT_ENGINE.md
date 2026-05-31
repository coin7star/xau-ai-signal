# Step 10S — Auto Result Engine

Step ini mengaktifkan engine auto result untuk signal RUNNING.

## Fitur
- Endpoint baru `/api/result-tracker`.
- Admin bisa menjalankan pengecekan dari tab History.
- BUY dianggap WIN jika live price menyentuh TP, LOSS jika menyentuh SL.
- SELL dianggap WIN jika live price menyentuh TP, LOSS jika menyentuh SL.
- Signal yang terlalu lama tanpa TP/SL akan menjadi EXPIRED.
- Main CALL default expired 24 jam.
- SCALP M1 default expired 4 jam.

## ENV Opsional
```env
RESULT_TRACKER_MAIN_EXPIRE_HOURS=24
RESULT_TRACKER_SCALP_EXPIRE_HOURS=4
RESULT_TRACKER_MAX_ITEMS=20
```

## Cara pakai
Dashboard → History → Result Tracker → Cek Auto Result.

Catatan: step ini belum mengirim alert result otomatis ke Telegram. Itu disiapkan untuk step berikutnya.
