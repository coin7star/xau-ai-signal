# Step 10AR2 - Fix Entry Limit Copy

Patch copywriting agar panel Entry Limit sesuai rule final:

- Limit tidak dipasang di EMA 9 langsung.
- Sistem menunggu candle engulfing M5 close valid di area EMA 9/20.
- Entry BUY/SELL LIMIT dipasang di open candle engulfing tersebut.
- SL tetap memakai low/high engulfing ± 0.5 ATR.
- TP1/BE dan TP Max tetap mengikuti rule sebelumnya.

Logic sinyal tidak diubah, patch ini fokus merapikan teks dashboard dan reason agar tidak membingungkan user.
