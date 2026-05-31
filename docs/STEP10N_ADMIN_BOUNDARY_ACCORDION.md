# Step 10N — Admin Boundary Accordion

Hotfix untuk tab Admin yang blank.

Perubahan:
- Tab Admin dibungkus Error Boundary agar error panel tidak menjatuhkan seluruh dashboard.
- Panel Admin dibuat lazy accordion: isi panel baru dimuat setelah diklik.
- Jika salah satu panel gagal render, dashboard menampilkan safe mode card, bukan layar blank.
