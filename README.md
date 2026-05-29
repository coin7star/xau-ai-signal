# XAU Custom Branded Email Auth OAuth Fix

Masalah sebelumnya:
- Email masih bawaan Firebase.
- Penyebab: endpoint custom belum punya Google OAuth service account,
  jadi tidak bisa memakai returnOobLink=true dan fallback ke Firebase default.

Fix:
- /api/auth-email sekarang pakai Firebase service account OAuth.
- Generate OOB link via:
  POST https://identitytoolkit.googleapis.com/v1/projects/{PROJECT_ID}/accounts:sendOobCode
- returnOobLink=true agar link dikembalikan ke backend.
- Email dikirim branded via Resend.
- Fallback Firebase default dimatikan supaya error ENV terlihat jelas.

ENV Cloudflare yang wajib:
- RESEND_API_KEY
- EMAIL_FROM
  Contoh: XAU AI Signal <onboarding@resend.dev>
- APP_URL
  https://xau-ai-signal.pages.dev
- FIREBASE_PROJECT_ID
  sultan-trading-data
- FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL
  dari Firebase service account JSON: client_email
- FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY
  dari Firebase service account JSON: private_key
  Bisa paste dengan \n atau newline asli.

Cara ambil service account:
Firebase Console
→ Project settings
→ Service accounts
→ Firebase Admin SDK
→ Generate new private key

Isi dari JSON:
- client_email → FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL
- private_key → FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY
- project_id → FIREBASE_PROJECT_ID

Permission:
Service account butuh permission:
- firebaseauth.users.sendEmail

Biasanya Firebase Admin SDK service account sudah cukup.

Test:
1. Deploy.
2. Tambah ENV di Cloudflare.
3. Redeploy.
4. Klik Lupa password.
5. Kalau sukses, email pengirim harus Resend/EMAIL_FROM.
6. Link harus:
   https://xau-ai-signal.pages.dev/auth-action?mode=resetPassword&oobCode=...

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.