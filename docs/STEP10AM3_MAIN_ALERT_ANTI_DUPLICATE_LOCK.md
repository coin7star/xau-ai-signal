# Step 10AM3 — Main Alert Anti Duplicate Lock

Patch ini memperketat anti-duplicate untuk Telegram Main Signal.

## Masalah

Saat `/api/signal` terpanggil beberapa kali cepat dari dashboard/refresh, alert Main Signal bisa terkirim lebih dari sekali.

## Fix

- Menambahkan duplicate lock berbasis pair, direction, entry, SL, dan TP.
- Lock disimpan di Firebase `/xauusd/telegram/alertLocks`.
- Default window anti-spam 15 menit.
- ENV opsional: `TELEGRAM_ALERT_DEDUP_WINDOW_SEC`.

## Catatan

Patch ini tidak mengubah logic signal, Strategy A, M1 Scalp, SMC AI, cron, atau auto result.
