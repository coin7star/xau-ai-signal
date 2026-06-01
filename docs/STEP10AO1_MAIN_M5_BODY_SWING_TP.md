# Step 10AO1 — Main M5 Body Swing TP

Patch kecil untuk Strategy A M5 EMA Pullback Limit.

## Perubahan

TP tidak lagi memakai ujung wick swing high / swing low.

- BUY LIMIT: TP memakai body atas dari candle swing high koreksi, yaitu area open/close swing high.
- SELL LIMIT: TP memakai body bawah dari candle swing low koreksi, yaitu area open/close swing low.
- SL tetap RR 1:1 dari jarak entry ke TP.

## Alasan

Ujung wick swing sering tidak tersentuh. Body swing lebih realistis untuk target take profit.

## Catatan

Logic lain tidak diubah. MQ5 tidak perlu update.
