# Step 10AQ7 - Engulfing Open Limit + TP Max 1:1

Update strategi utama M5:
- Entry BUY/SELL LIMIT memakai open candle engulfing M5 yang menyentuh area EMA 9/20.
- Preview limit line juga memakai open candle engulfing jika engulfing valid di area EMA.
- SL BUY = low candle bullish engulfing - 0.5 ATR M5.
- SL SELL = high candle bearish engulfing + 0.5 ATR M5.
- TP Max = RR 1:1 dari jarak Entry ke SL.
- TP1/BE = setengah jarak menuju TP Max.
- Field `tp` tetap berisi TP Max agar auto result utama tetap kompatibel.
