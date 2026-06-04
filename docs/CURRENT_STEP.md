# Step 10BR — Result Tracker Candle Range TP1 Fix

Fix auto result agar TP1 / TP Max / SL / BE tidak kelewat ketika harga sempat menyentuh level lewat wick candle M1, lalu live price sudah balik saat cron berikutnya berjalan.

## Update
- Result tracker tidak hanya mengecek `lastPrice`.
- Cron juga membaca high/low candle M1 sejak sinyal aktif.
- BUY: TP1/TP Max dicek dari high, SL/BE dicek dari low.
- SELL: TP1/TP Max dicek dari low, SL/BE dicek dari high.
- Jika TP1 tersentuh, SL otomatis pindah ke BE dan Telegram TP1 tetap dikirim 1x.

## Strategi tetap
- M1 EMA Cross Direct Entry.
- SL Smart Swing ± 0.2 ATR.
- TP Max RR 1:1.25.
- TP1 aktifkan BE.
