# New Web — Manual Signal Desk

This redesign keeps the existing Firebase Auth, Firebase Realtime Database user records, payment/order APIs, Telegram connection, and existing backend functions.

## New flow

1. Admin logs in with the existing admin account.
2. Admin opens Admin Control > Publish Signal.
3. Enter BUY/SELL, timeframe, Entry, SL, TP, confidence and manual analysis.
4. Publish writes the signal to `/manualSignals/latest` and `/manualSignals/history/{id}`.
5. Active premium users with `telegramConnected=true` and a valid `premiumUntil` receive an immediate Telegram alert.
6. The website polls the public signal feed every 15 seconds and shows the latest call + history.
7. Users can enable browser notifications while the page is open.
8. AI Assistant remains as a contextual help panel.

## Existing data that is intentionally preserved

- `/users`
- `/paymentOrders`
- `/adminOrderNotes`
- Firebase Authentication
- Telegram connection fields on `/users`
- existing admin APIs
- existing MT5 / market / Bybit cron files
- existing Firebase auth action endpoints

No migration of the existing user database is required.
