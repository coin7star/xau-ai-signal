# XAU Multi-user Telegram Alert Step 3 Full Fix

Step 3:
- MAIN CALL valid sekarang dikirim ke banyak Telegram user premium/admin.
- Sistem tetap mengirim ke chat utama lama dari ENV TELEGRAM_CHAT_ID.
- Sistem juga mengirim ke semua user yang:
  - role = premium dan premiumUntil masih aktif
  - atau role = admin
  - status active
  - telegramConnected = true
  - telegramChatId ada

Flow:
1. User premium connect Telegram di Step 2.
2. users/{uid}/telegramConnected = true.
3. MAIN CALL BUY/SELL valid muncul.
4. /api/signal memanggil maybeSendTelegramAlert.
5. Alert dikirim ke:
   - TELEGRAM_CHAT_ID default jika ada
   - semua premium/admin connected users
6. Duplicate alert dicegah pakai alertKey:
   pair + signal + callStage + candleTime.

Delivery log:
- Disimpan di:
  xauusd/telegram/deliveryLogs/{alertKey}/{chatId}
- Last alert:
  xauusd/telegram/lastAlert

Return JSON /api/signal sekarang berisi:
telegram: {
  ok,
  mode: "multi-user-premium-alert",
  totalRecipients,
  successCount,
  failedCount,
  recipients
}

ENV wajib:
- TELEGRAM_BOT_TOKEN
- FIREBASE_DATABASE_URL

ENV opsional:
- TELEGRAM_CHAT_ID
  Tetap dipakai untuk chat/channel utama lama.

Catatan:
- User expired otomatis tidak dapat alert.
- User free tidak dapat alert.
- User belum connect Telegram tidak dapat alert.
- MQ5 tidak perlu update.