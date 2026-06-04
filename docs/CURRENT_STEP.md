# Step 10BS — Aggressive Entry + EMA Pullback Limit

## Update
Strategi utama tetap M1 EMA Cross Direct Entry, tetapi sekarang signal plan punya dua opsi entry untuk user manual:

1. **Entry agresif**: mengikuti EMA cross valid setelah candle M1 close.
2. **Limit pullback EMA**: opsi entry kedua di area pullback EMA9/EMA20 dengan buffer kecil supaya user tidak perlu mengejar harga jika sinyal sudah bergerak cepat.

## Rule tetap sama
- Timeframe utama: M1 closed candle dari MT5.
- BUY: EMA9 cross ke atas EMA20 dan candle close di atas kedua EMA.
- SELL: EMA9 cross ke bawah EMA20 dan candle close di bawah kedua EMA.
- SL: smart swing anchor ± 0.2 ATR.
- TP Max: RR 1:1.25 dari plan utama.
- TP1: 50% menuju TP Max, lalu BE aktif.

## Chart
Chart M1 sekarang menampilkan garis:
- Entry agresif / OPEN
- Limit pullback EMA
- SL
- TP1 / BE
- TP Max

## Telegram
Notif CALL sekarang menampilkan:
- Entry agresif
- Limit pullback
- Zona limit
- SL awal
- TP1
- TP Max
- BE

## Catatan
Limit pullback adalah opsi untuk manual user agar tidak mengejar harga saat M1 bergerak cepat. History dan result tracker tetap memakai plan utama sinyal.
