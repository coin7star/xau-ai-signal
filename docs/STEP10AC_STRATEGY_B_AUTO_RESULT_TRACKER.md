# Step 10AC — Strategy B Auto Result Tracker

Step ini menambahkan Auto Result Tracker untuk Strategy B `SMC AI`.

## Tujuan

History SMC AI yang tersimpan di `/xauusd/strategyB/history` sekarang ikut dipantau oleh Auto Result Engine. Jika harga live MT5/VPS menyentuh TP, SL, atau melewati batas expiry, status signal SMC AI akan otomatis berubah.

## Result Logic

BUY:
- Harga >= TP → WIN
- Harga <= SL → LOSS

SELL:
- Harga <= TP → WIN
- Harga >= SL → LOSS

Expired:
- Default 24 jam, bisa diubah lewat ENV `RESULT_TRACKER_STRATEGY_B_EXPIRE_HOURS`.

## Data Source

Result tetap dihitung dari live feed utama MT5/VPS di `/xauusd/latest`. Bybit test feed tidak dipakai.

## Keamanan Strategy A

Strategy A tidak diubah. CALL History utama dan SCALP History tetap berjalan seperti sebelumnya. Strategy B tetap berada dalam mode live-backtest only.

## Telegram

Step ini belum mengirim Telegram result alert untuk Strategy B. Jika signal SMC AI ditutup otomatis, payload diberi catatan `STRATEGY_B_LIVE_BACKTEST_ONLY`.

## ENV Opsional

```env
RESULT_TRACKER_STRATEGY_B_EXPIRE_HOURS=24
```
