# STEP 10BL - Market Source Reconnect Fix

Fix setelah Step 10BK: signal API sempat error karena `close` dipakai sebelum dibuat saat menghitung nearest swing structure. Dampaknya dashboard bisa ikut blank/reconnecting karena `loadData` memakai Promise.all.

## Fix
- `functions/api/signal.js`: pindahkan deklarasi `open/high/low/close` sebelum pemanggilan `getM1DirectEntrySwingStructure`.
- `src/App.jsx`: fetch `/api/signal` dan `/api/ai-analysis` dibuat aman. Kalau signal API error, data market dari `/api/market` tetap tampil dan dashboard tidak kehilangan sumber data.

Strategi tidak berubah: M1 EMA Cross Direct Entry, RR 1:1.25, SL nearest swing + 0.2 ATR, TP1 -> BE.
