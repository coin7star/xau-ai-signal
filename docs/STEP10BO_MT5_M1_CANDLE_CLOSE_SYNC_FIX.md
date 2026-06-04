# Step 10BO — MT5 M1 Candle Close Sync Fix

Update ini memperbaiki cara web membaca candle M1 dari MT5 supaya sinyal tidak dihitung dari candle yang masih berjalan.

## Perubahan utama

- Signal engine sekarang memakai **closed candle M1**.
- Jika EA mengirim `lastClosedCandle`, `closedCandle`, `m1ClosedCandle`, atau `lastClosedM1`, sistem akan memprioritaskan data itu.
- Jika EA masih mengirim array `candles`, sistem akan menyaring candle running berdasarkan waktu candle M1.
- Candle dengan timestamp yang belum lewat 60 detik dari open time tidak dipakai untuk sinyal.
- Sinyal baru ditahan kalau candle M1 close sudah terlalu lama, supaya Telegram tidak mengirim sinyal telat dari candle lama.
- Dashboard menampilkan status **Candle Close M1**.
- TP/SL/BE tetap membaca latest price dari MT5/VPS, bukan refresh chart.

## Rekomendasi EA MT5

- Kirim `bid`, `ask`, `lastPrice` tiap 1–2 detik.
- Kirim closed candle M1 saat bar baru muncul, menggunakan shift `1`:
  - `iOpen(Symbol(), PERIOD_M1, 1)`
  - `iHigh(Symbol(), PERIOD_M1, 1)`
  - `iLow(Symbol(), PERIOD_M1, 1)`
  - `iClose(Symbol(), PERIOD_M1, 1)`
  - `iTime(Symbol(), PERIOD_M1, 1)`
- Jangan hitung sinyal dari shift `0` karena itu candle berjalan.

## Status sync

- `SYNCED`: candle close baru masuk cepat.
- `VALID`: candle masih aman dibaca.
- `STALE_CANDLE`: candle close telat, sinyal baru ditahan.
- `WAITING_CANDLE`: menunggu candle close dari MT5.

## Strategi tidak berubah

- M1 EMA Cross Direct Entry
- RR 1:1.25
- SL nearest swing + 0.2 ATR
- TP1 → BE
- TP Max → Menang
