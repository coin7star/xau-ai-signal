# XAU Strategy OB M15 + EMA Ready Cross Full Fix

Strategi baru:
- Order Block pakai timeframe M15 dari EA.
- Signal utama pakai EMA 9/20 timeframe M1.
- Kalau EMA 9 mendekati EMA 20 dan gap mengecil: READY BUY / READY SELL.
- BUY / SELL baru keluar saat EMA 9 benar-benar cross EMA 20.
- AI Analysis sudah baca status READY/CALL.
- MT5 EA v2 kirim candles M1 dan candlesM15.

Penting:
- Setelah upload web, update juga EA MQ5 terbaru di MetaEditor.
- Compile EA.
- Pasang EA di chart XAUUSD+.
- Pastikan TOKEN sama dengan MT5_INGEST_TOKEN.
