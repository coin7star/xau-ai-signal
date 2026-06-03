# STEP10AT — Main M1 EMA Cross Direct Entry

Update ini mengganti strategi utama menjadi satu rule saja: M1 EMA Cross Direct Entry.

## Rule BUY
- EMA9 cross ke atas EMA20 di candle M1 yang sudah close.
- Candle close berada di atas EMA9 dan EMA20.
- Entry BUY langsung memakai harga close candle M1.
- SL di bawah swing low M1 terdekat - 0.1 ATR.
- TP Max RR 1:1 dari jarak Entry ke SL.
- TP1 berada di tengah jarak Entry ke TP Max.
- Setelah TP1 kena, SL dipindah ke BE.

## Rule SELL
- EMA9 cross ke bawah EMA20 di candle M1 yang sudah close.
- Candle close berada di bawah EMA9 dan EMA20.
- Entry SELL langsung memakai harga close candle M1.
- SL di atas swing high M1 terdekat + 0.1 ATR.
- TP Max RR 1:1 dari jarak Entry ke SL.
- TP1 berada di tengah jarak Entry ke TP Max.
- Setelah TP1 kena, SL dipindah ke BE.

## Catatan Implementasi
- Strategi utama tidak memakai M5.
- Chart tetap M1.
- SMC AI dan Scalp tetap dinonaktifkan/disembunyikan dari tab utama.
- History, Telegram alert, dan auto result tetap memakai sinyal utama.
- Action utama backend memakai BUY_OPEN / SELL_OPEN agar tidak membingungkan dengan limit order.
