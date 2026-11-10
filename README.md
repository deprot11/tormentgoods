# Baju Custom — Pre-Order Baju Custom

Aplikasi web pre-order baju custom untuk perorangan dan komunitas. Isinya: katalog desain, form pesanan, cek status, bukti pesanan PDF, panel admin, verifikasi pembayaran, laporan penjualan web dan marketplace.

- **Tampilan:** HTML, CSS, dan JavaScript murni, di-hosting di GitHub Pages.
- **Server data:** Google Apps Script (`Kode.gs`, disimpan di proyek Apps Script, tidak di repository ini) dengan Google Sheets dan Drive.
- **Konfigurasi:** satu-satunya yang perlu diubah adalah `js/config.js` (`GAS_URL`).

Lihat `PANDUAN-INSTALASI.md` untuk langkah lengkap.

```
index.html
css/style.css
js/config.js   <- isi GAS_URL di sini
js/api.js      <- penghubung ke Apps Script (fetch)
js/app.js      <- seluruh logika aplikasi
```
