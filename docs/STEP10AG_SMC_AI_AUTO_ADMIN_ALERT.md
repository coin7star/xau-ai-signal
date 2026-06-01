# Step 10AG — SMC AI Auto Admin Alert saat CALL Asli

Step ini membuat Strategy B / SMC AI mengirim alert otomatis ke Telegram admin/global saat SMC AI benar-benar menghasilkan CALL BUY atau CALL SELL.

## Prinsip

- Strategy A tidak diubah.
- SMC AI tetap live-backtest only.
- Alert hanya dikirim ke TELEGRAM_CHAT_ID global/admin.
- Belum dikirim ke user premium.
- Anti duplicate mengikuti penyimpanan history Strategy B.

## ENV

Opsional:

```env
STRATEGY_B_AUTO_ADMIN_ALERT_ENABLED=true
```

Untuk mematikan sementara:

```env
STRATEGY_B_AUTO_ADMIN_ALERT_ENABLED=false
```

Wajib untuk Telegram:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
PUBLIC_DASHBOARD_URL=https://www.xauaisignal.online
```

## Flow

SMC AI CALL valid → simpan ke /xauusd/strategyB/history → kirim Telegram admin/global → tandai `strategyBAlertSent`.
