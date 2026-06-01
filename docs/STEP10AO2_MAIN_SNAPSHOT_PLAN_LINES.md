# Step 10AO2 - Main Snapshot + Plan Lines

Perubahan utama:
- Snapshot Market sekarang fokus ke Strategy A baru (M5 EMA Pullback Limit).
- Row snapshot diganti menjadi: EMA 9/20, Koreksi EMA 9, Entry Limit, TP/SL, Probability, dan Slot Pending.
- Chart M5 menampilkan garis Entry / TP / SL untuk plan utama saat status READY atau LIMIT.
- Candle chart label diperjelas menjadi M5.
- Pending main signal sekarang maksimal 2 BUY dan 2 SELL aktif.
- Jika muncul struktur limit M5 baru sebelum pending lama tersentuh, pending lama otomatis di-expire.
- M5 Scalp kini membaca candle M5 native dari MT5/VPS jika tersedia.
