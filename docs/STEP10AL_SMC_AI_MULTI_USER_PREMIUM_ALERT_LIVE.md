# Step 10AL — SMC AI Multi-user Premium Alert Live

Step ini mengaktifkan jalur live SMC AI ke premium user, tetapi tetap dikontrol oleh admin master switch.

## Flow

SMC AI CALL asli → history Strategy B → admin alert → jika master switch `SMC AI Premium User Alert Live` ON → kirim ke user premium/admin yang Telegram connected dan personal alert ON.

## Guard

Alert hanya dikirim jika:

- `strategyBPremiumUserAlert` ON di Strategy Control Center
- user role premium masih aktif atau admin
- Telegram user connected
- user tidak mematikan alert personal
- `Main Signal Alert` user tidak OFF
- chat ID tidak duplikat

## Anti duplicate

Delivery disimpan di `/xauusd/strategyB/premiumAlerts/{alertKey}` supaya signal sama tidak spam ke user yang sama.

## Catatan

Strategy A tidak diubah. M1 Scalp tidak diubah. SMC AI tetap Strategy B dan masih bisa dimatikan dari Admin.
