# XAU Login Premium Paywall Step 1 Full Fix

Step 1 premium foundation:
- Login user via Firebase Auth:
  - Email/password
  - Google login
- Auto-create user profile di Firebase RTDB:
  /users/{uid}
- Role user:
  - free
  - premium
  - admin
- Premium access:
  - premiumUntil harus masih aktif
  - admin selalu aktif
- Paywall:
  - Free user login tetap bisa masuk, tapi dashboard dikunci
  - Premium/admin bisa akses dashboard
- Admin endpoint manual:
  - GET /api/admin-user
  - POST /api/admin-user

ENV Cloudflare Pages wajib:
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...

ENV Cloudflare Function:
FIREBASE_DATABASE_URL=...
ADMIN_ACTION_TOKEN=...

Cara aktifkan premium manual via Firebase:
users/{uid}/role = premium
users/{uid}/premiumUntil = 2026-06-30T23:59:59.000Z

Atau via endpoint:
POST /api/admin-user
body:
{
  "token": "ADMIN_ACTION_TOKEN_KAMU",
  "uid": "USER_UID",
  "role": "premium",
  "premiumDays": 30
}

Firebase Console:
1. Authentication -> Sign-in method -> aktifkan Email/Password
2. Optional: aktifkan Google provider
3. Realtime Database rules sementara untuk test:
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
Nanti rules bisa kita ketatkan setelah Step 2/3.

MQ5 tidak perlu update.