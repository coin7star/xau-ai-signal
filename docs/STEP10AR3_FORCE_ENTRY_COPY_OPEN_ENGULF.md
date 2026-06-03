# Step 10AR3 - Force Entry Copy Open Engulf

Patch copy tambahan agar panel Entry tidak lagi menampilkan teks lama.

Rule final yang ditampilkan:
- Entry limit dibuat setelah candle engulfing M5 close valid di area EMA 9/20.
- Entry BUY/SELL LIMIT berada di OPEN candle engulfing.
- Jika struktur baru muncul sebelum limit tersentuh, plan lama otomatis EXPIRED.
- Logic strategi tidak diubah, hanya memperkuat copy frontend/backend agar tidak muncul teks lama.
