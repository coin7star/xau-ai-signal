# Step 10AN — M5 Engulfing Limit Scalp

Patch ini mengganti mode scalp lama dari M1 ke M5 Engulfing Limit Scalp.

## Sumber candle
- MQ5 tidak perlu diubah dulu.
- Candle M5 dibuat dari agregasi candle M1.
- Nanti bisa upgrade ke M5 native dari MQ5 jika sudah stabil.

## Rule BUY
- Bullish Engulfing M5.
- Engulfing muncul di area swing low M5.
- Close candle engulfing di atas EMA 9 dan EMA 20.
- Entry BUY LIMIT di open candle engulfing.
- SL di bawah swing low struktur M5 sebelumnya - 1.5 ATR.
- TP:SL = 1:1.

## Rule SELL
- Bearish Engulfing M5.
- Engulfing muncul di area swing high M5.
- Close candle engulfing di bawah EMA 9 dan EMA 20.
- Entry SELL LIMIT di open candle engulfing.
- SL di atas swing high struktur M5 sebelumnya + 1.5 ATR.
- TP:SL = 1:1.

## Pending limit
- Max 4 pending.
- Max 2 BUY LIMIT.
- Max 2 SELL LIMIT.
- Jika slot searah sudah penuh dan muncul setup baru, pending paling lama dibuat EXPIRED.

## Catatan
- Strategy A tidak diubah.
- SMC AI tidak diubah.
- Bybit tidak dipakai.
