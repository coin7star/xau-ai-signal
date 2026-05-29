# XAU Forgot Password Visible Stable Fix

Update:
- Tombol Lupa password? sekarang muncul tepat di bawah tombol Login.
- Fitur reset password dipasang di firebaseClient.js sebagai resetPasswordEmail().
- AuthScreen dibuat ulang stabil dari baseline aman.
- Reset mode:
  - title berubah jadi Reset Password
  - hanya input email
  - password field disembunyikan
  - Google login disembunyikan
  - tombol kembali ke login muncul
- Firebase mengirim link reset password ke email user.

Cara test:
1. Buka Login.
2. Klik Lupa password?
3. Isi email.
4. Klik Kirim Link Reset Password.
5. Cek inbox/spam.
6. Reset password lalu login ulang.

Firebase:
- Authentication > Email/Password harus enabled.
- Template reset password bisa diedit dari:
  Authentication > Templates > Password reset.

Cloudflare:
- package-lock.json tetap dihapus.
- .npmrc tetap ada.

MQ5:
- Tidak perlu update.