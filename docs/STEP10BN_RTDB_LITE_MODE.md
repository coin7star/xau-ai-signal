# STEP 10BN — RTDB Lite Mode

Tujuan: mengurangi download Firebase RTDB tanpa mengubah strategi utama.

## Update

- Dashboard live refresh dari 3 detik menjadi 5 detik.
- Chart M1 refresh dari 30 detik menjadi 60 detik.
- History tetap 60 detik/manual.
- Cron health refresh menjadi 60 detik.
- Request chart dikurangi dari 90 candle menjadi 60 candle.
- Data candle yang disimpan di `/xauusd/latest` dibatasi dari 500 candle menjadi 180 candle.
- M15 tetap tidak dipakai untuk strategi utama dan tidak diminta dari chart.
- Ditambah info UI: `Mode Hemat RTDB aktif`.

## Catatan penting

Auto result TP/SL/BE tetap aman karena result tracker membaca harga live/latest price dari MT5/VPS, bukan bergantung ke refresh chart.

Strategi tidak berubah:

- M1 EMA Cross Direct Entry
- Nearest swing SL + 0.2 ATR
- TP Max RR 1:1.25
- TP1 → BE

## Rekomendasi operasional

- MT5/VPS latest price tetap update 1–3 detik.
- Dashboard cukup refresh 5 detik.
- Chart dan history cukup 60 detik.
- Cron auto result tetap 30–60 detik.
