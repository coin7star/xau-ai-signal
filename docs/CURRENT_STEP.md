# Step 10CA — Limit RR Safety Fix

Update ini memperbaiki plan Limit Pullback agar TP RR 1:1 tidak terlalu pendek karena limit terlalu dekat dengan SL.

## Perubahan
- BUY Limit tetap dibuat mudah tersentuh, tapi tidak boleh terlalu dekat dengan SL.
- SELL Limit tetap dibuat mudah tersentuh, tapi tidak boleh terlalu dekat dengan SL.
- Ditambah `minLimitRisk` sebagai jarak minimal dari limit ke SL.
- TP Limit tetap RR 1:1 dari jarak limit ke SL.
- TP1 Limit tetap 50% menuju TP Max, lalu BE.

## Catatan
Strategi utama, entry agresif, cron result, Telegram, dan analytics reset tidak diubah.
