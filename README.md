# XAU Email Verification Export Fix

Masalah build:
- App.jsx import refreshCurrentUser dan sendVerificationEmail.
- firebaseClient.js belum export kedua function itu.
- Cloudflare build gagal dengan MISSING_EXPORT.

Fix:
- src/firebaseClient.js diganti clean full file.
- Export yang tersedia:
  - listenAuth
  - loginWithEmail
  - registerWithEmail
  - loginWithGoogle
  - logout
  - sendVerificationEmail
  - refreshCurrentUser
  - ensureUserProfile
  - getUserProfile
  - isPremiumProfile
  - hasFirebaseClientConfig

Fitur tetap:
- Email verification anti-spam.
- Login/register.
- Premium paywall.
- Admin panel.
- Logout.
- Premium expiry display.

MQ5:
- Tidak perlu update.

Cara pakai:
1. Upload replace semua file ke GitHub.
2. Commit changes.
3. Tunggu Cloudflare deploy.
4. Test register email baru.