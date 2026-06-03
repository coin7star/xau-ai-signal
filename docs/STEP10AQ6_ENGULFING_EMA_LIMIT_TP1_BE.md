# Step 10AQ6 - Engulfing EMA Limit + TP1 BE

Perubahan utama:
- Entry limit utama wajib menunggu candle engulfing M5 di area EMA 9/20.
- BUY valid: struktur M5 bullish, EMA 9/20 searah naik, bullish engulfing M5 muncul/menyentuh area EMA.
- SELL valid: struktur M5 bearish, EMA 9/20 searah turun, bearish engulfing M5 muncul/menyentuh area EMA.
- Entry tetap di EMA9.
- SL BUY: low candle engulfing M5 yang menyentuh EMA - 0.5 ATR.
- SL SELL: high candle engulfing M5 yang menyentuh EMA + 0.5 ATR.
- TP1 = RR 1:1 dari jarak Entry ke SL.
- Saat TP1 tersentuh, auto result tracker memindahkan SL ke BE dan menandai tp1Hit.
- TP2 = target max di body swing utama.
- Chart menampilkan TP1 sebagai `TP1 · BE`.
