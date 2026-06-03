# Step 10AQ8 - Strict EMA Direction Lock

Perubahan:
- Strategy utama hanya mencari BUY saat EMA9 berada di atas EMA20.
- Strategy utama hanya mencari SELL saat EMA9 berada di bawah EMA20.
- Setup lawan arah EMA dikunci WAIT dan tidak dikirim.
- Setiap arah trend maksimal 2 posisi/plan aktif.
- Jika struktur/BOS baru muncul dan pending lama belum tersentuh, pending lama otomatis EXPIRED.
- Posisi yang sudah tersentuh entry / RUNNING tidak dihapus otomatis.
- Jika sudah ada 2 posisi/plan aktif pada arah yang sama, sinyal baru ditahan sampai ada yang WIN/LOSS/BE/EXPIRED.
