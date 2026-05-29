# XAU Forgot Password Full Fix

Update:
- Tambah fitur Lupa Password di halaman Login.
- User klik Lupa password?
- User isi email.
- Firebase Auth kirim link reset password ke email user.
- Setelah berhasil, user balik ke login.
- Password field dan Google login disembunyikan saat reset mode.
- Error message untuk reset/login dirapikan.

File berubah:
- src/App.jsx
- src/style.css
- package.json
- .npmrc

Firebase:
- Menggunakan sendPasswordResetEmail dari Firebase Auth.
- Pastikan Authentication Email/Password sudah enabled.
- Email template reset password bisa diedit dari Firebase Console > Authentication > Templates.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.