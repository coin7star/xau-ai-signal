# Step 10AE2 — Move Strategy Lab to History Panel

Patch ini memindahkan panel **Compare Strategy A vs Strategy B** dari tab **SMC AI** ke tab **History**.

Tujuan:
- Tab SMC AI fokus untuk live setup Strategy B.
- Tab History menjadi pusat history, analytics, backtest, dan compare.
- M1 Scalp tetap dipisahkan dari Strategy A.
- Strategy A tetap Main Signal Only.
- Strategy B tetap SMC AI Live Backtest.

Tidak ada perubahan pada logic signal, Telegram, cron, MQ5, atau Firebase rules.
