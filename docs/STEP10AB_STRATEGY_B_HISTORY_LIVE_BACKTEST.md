# Step 10AB - Strategy B SMC AI History & Live Backtest

Step ini menambahkan live-backtest history untuk Strategy B `SMC AI`.

## Prinsip utama
- Strategy A tidak diubah.
- Strategy B berjalan paralel sebagai eksperimen.
- History Strategy B disimpan terpisah dari CALL history utama dan SCALP history.

## Path data
```txt
/xauusd/strategyB/history
```

## Data yang disimpan
- strategyName: SMC AI
- signal: BUY / SELL
- action: CALL_BUY / CALL_SELL
- entry, sl, tp, rr
- confidence
- checklist OB / Sweep / CHOCH / EMA
- RSI, MFI, ATR, EMA snapshot
- status: OPEN

## Anti duplicate
Signal SMC AI yang sama akan diskip jika direction sama, entry dekat, dan muncul dalam window sekitar 15 menit.

## Dashboard
Tab `SMC AI` sekarang menampilkan:
- SMC AI live-backtest history
- Total, Running, Win, Loss, Expired, WR
- Average RR, Average TP, Average SL, Profit Factor sederhana

## Catatan
Step ini belum mengaktifkan Telegram alert Strategy B dan belum menggabungkan Strategy B ke auto result utama. Itu akan dibuat di step terpisah.
