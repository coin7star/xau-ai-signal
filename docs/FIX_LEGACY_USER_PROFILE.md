# Fix — Legacy User Profile Compatibility

The new Signal Desk UI now reads the existing Firebase Realtime Database user profile through `/api/user-profile` after verifying the signed-in Firebase ID token.

It keeps the old `/users/{uid}` record untouched, including:
- `role`
- `status`
- `premiumUntil`
- `telegramConnected`
- `telegramChatId`
- `telegramUsername`
- all existing payment fields

This prevents the new frontend from silently falling back to `role: free` when client-side RTDB read rules/configuration are different from the old dashboard.

No Firebase database migration is required.
