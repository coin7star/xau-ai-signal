# Step 10Z1 - Telegram Alert Auto-ON Info

Patch kecil untuk memperjelas flow Telegram alert.

## Behavior
- Setelah user berhasil connect Telegram, alert otomatis aktif.
- `telegramAlertEnabled = true`
- `telegramAlertMainSignal = true`
- `telegramAlertResult = true`

## Dashboard Info
Panel Telegram sekarang menjelaskan bahwa toggle OFF berarti user tidak akan menerima notifikasi terkait.

## Catatan
Patch ini tidak mengaktifkan broadcast multi-user live. Ini hanya memastikan default preference dan copywriting lebih jelas sebelum Step 11.
