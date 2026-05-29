# XAU Market Monitoring Runtime Normalize Fix

Masalah:
- Badge awal tampil "Telegram standby".
- Setelah data Firebase kebaca, status berubah jadi "not-call-signal".
- Ini terjadi karena data mentah dari Firebase memang belum ada CALL aktif.

Fix:
- Normalisasi runtime untuk status UI:
  not-call-signal -> Market Monitoring
  telegram standby -> Market Monitoring
  call/call-signal -> CALL Active
- Normalisasi dilakukan saat data masuk dan saat render display.
- Logic signal tidak diubah.
- Admin Panel tidak disentuh.
- Chart/candle tidak disentuh.
- MQ5 tidak perlu update.

Catatan:
- Kalau belum ada CALL aktif, badge yang benar adalah Market Monitoring.
- Kalau ada CALL aktif, badge menjadi CALL Active.