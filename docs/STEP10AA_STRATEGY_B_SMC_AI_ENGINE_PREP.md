# Step 10AA — Strategy B SMC AI Engine Prep

Menambahkan Strategy B bernama **SMC AI** sebagai strategi eksperimen/live-backtest untuk XAUUSD.

## Prinsip penting
- Strategy A tidak diubah.
- Strategy B berjalan paralel.
- Strategy B belum menggantikan sinyal utama.
- Telegram Strategy B belum live broadcast ke user.

## Logic Strategy B
Flow utama:

```txt
Fresh OB M15 → Liquidity Sweep M1 → CHOCH M1 → EMA 9/20 M1
```

BUY membutuhkan Bullish OB M15, Sweep Low M1, CHOCH Bullish, dan EMA bullish.
SELL membutuhkan Bearish OB M15, Sweep High M1, CHOCH Bearish, dan EMA bearish.

RSI dan MFI tetap dihitung sebagai confidence booster, bukan syarat wajib.

## SL / TP
BUY:
```txt
SL = Sweep Low - 1.5 × ATR M1
TP = Entry + 2 × Risk
```

SELL:
```txt
SL = Sweep High + 1.5 × ATR M1
TP = Entry - 2 × Risk
```

## Dashboard
Tab baru: **SMC AI**.

Menampilkan status, confidence, Entry, SL, TP, checklist SMC flow, dan catatan live-backtest.
