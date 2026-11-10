# Panduan Instalasi — Baju Custom (GitHub Pages + Apps Script)

Aplikasi sekarang terdiri dari dua bagian:

| Bagian | Isi | Tempatnya |
| --- | --- | --- |
| **Tampilan (frontend)** | `index.html`, folder `css/`, folder `js/` | Repository GitHub → tampil di Vercel (`https://baju-custom.vercel.app`) dan/atau GitHub Pages (`https://USERNAME.github.io/NAMA-REPO/`) |
| **Server data (backend)** | `Kode.gs` | Proyek Apps Script yang sudah ada. Data, foto, dan akun tetap di Google Drive/Sheets |

Tampilan memanggil Apps Script lewat internet (`fetch`). Halaman tidak lagi berada di dalam iframe Google, jadi tampilannya lebih cepat terbuka, tidak ada bilah peringatan Google, dan link bisa dibagikan apa adanya.

---

## Bagian A — Perbarui Apps Script (backend)

Pakai **proyek Apps Script yang sudah ada**, jangan membuat proyek baru. Dengan begitu semua pesanan, pelanggan, akun, dan kata sandi tetap aman, dan `setupAplikasi()` **tidak perlu** dijalankan ulang.

1. Buka proyek Apps Script, lalu buka file `Kode.gs`. Tekan Ctrl+A lalu Delete, kemudian tempel seluruh isi **Kode.gs** yang baru.
2. Hapus file `Index.html`, `Stylesheet.html`, dan `JavaScript.html` (klik ⋮ di samping nama file → Hapus). File-file ini sudah tidak dipakai.
3. Simpan (Ctrl+S).
4. Klik **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan**. Pastikan:
   - **Jalankan sebagai:** Saya
   - **Yang memiliki akses:** Siapa saja
5. Salin **URL Aplikasi web** (berakhiran `/exec`). URL ini tidak berubah dari sebelumnya.
6. Uji: buka URL `/exec` itu di browser. Kalau muncul teks seperti `{"success":true,"app":"Baju Custom","api":"ok","setup":true,...}`, backend sudah siap.

> **Instalasi baru (belum pernah setup)?** Buat proyek baru, tempel `Kode.gs`, atur zona waktu ke **(GMT+07:00) Jakarta** di ⚙️ Setelan Proyek, lalu jalankan `setupAplikasi` sekali. Catat username `pemilik` dan kata sandi awal dari Log eksekusi. Setelah itu lanjutkan dari langkah 4 di atas (pilih **Deployment baru → Aplikasi web**).

## Bagian B — Isi alamat server di `js/config.js`

1. Ekstrak ZIP `baju-custom-web.zip`. Hasilnya folder **`baju-custom-web`** berisi `index.html`, `README.md`, panduan ini, folder `css/`, dan folder `js/`.
2. Buka `baju-custom-web\js\config.js` dengan Notepad, lalu ganti `TEMPEL_URL_EXEC_DI_SINI` dengan URL `/exec` dari Bagian A:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
   Tanda kutip satu (`'`) di awal dan akhir harus tetap ada.
3. Simpan.

## Bagian C — Upload ke GitHub Pages (lewat terminal)

**Folder yang di-upload adalah `baju-custom-web` itu sendiri.** Di dalam folder ini `index.html` langsung terlihat paling atas. Jangan menjalankan perintah dari folder di atasnya, dan jangan pakai menu "Upload files" di web GitHub, karena struktur folder `css/` dan `js/` bisa rusak.

1. **Pasang Git** (sekali saja): unduh dari https://git-scm.com/download/win, lalu install dengan pengaturan bawaan. Cek dengan perintah `git --version`.
2. **Buat akun GitHub** di https://github.com. Username akan menjadi bagian alamat situs (`username.github.io`).
3. **Atur identitas Git** (sekali saja):
   ```bash
   git config --global user.name "Nama Anda"
   git config --global user.email "email-akun-github@contoh.com"
   ```
4. **Buat repository baru:** di GitHub klik **+ → New repository**. Beri nama, misalnya `baju-custom`, lalu pilih **Public**. **Jangan** centang README, .gitignore, atau license.
5. **Buka terminal di folder `baju-custom-web`:** buka folder itu di File Explorer, klik address bar, ketik `powershell`, lalu Enter.
6. **Pastikan foldernya benar:** jalankan `dir`. Harus terlihat `index.html`, `css`, dan `js`. Kalau yang terlihat justru folder `baju-custom-web`, masuk dulu dengan `cd baju-custom-web`.
7. **Kirim ke GitHub.** Jalankan satu per satu:
   ```bash
   git init
   git add .
   git commit -m "Upload pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME/baju-custom.git
   git push -u origin main
   ```
   - `git add .` diakhiri **titik**.
   - Saat diminta **Password**, yang diisi adalah **Personal Access Token**, bukan kata sandi akun GitHub. Cara membuatnya: buka https://github.com/settings/tokens → **Generate new token (classic)** → centang **repo** → **Generate**, lalu salin token `ghp_...`.
   - Saat token ditempel (klik kanan di PowerShell), layar tetap kosong. Itu normal. Tekan Enter.
   - Push berhasil kalau muncul `Writing objects: 100%` dan `* [new branch] main -> main`.
8. **Aktifkan Pages:** di repository GitHub, buka **Settings → Pages**. Isi **Source: Deploy from a branch** dan **Branch: main / (root)**, lalu **Save**. Tunggu 1–2 menit, lalu muat ulang halaman. Akan muncul *"Your site is live at https://USERNAME.github.io/baju-custom/"*. Centang **Enforce HTTPS**.

## Bagian C2 — Hosting di Vercel (dari repository GitHub yang sama)

Vercel mengambil file langsung dari repository GitHub hasil Bagian C, langkah 1–7. Langkah 8 (GitHub Pages) boleh dilewati kalau hanya memakai Vercel.

1. Buka https://vercel.com, lalu pilih **Sign Up → Continue with GitHub**. Pilih paket **Hobby** (gratis).
2. Klik **Add New… → Project**. Pada daftar repository, klik **Import** di samping `baju-custom`. Kalau repository tidak muncul, klik **Adjust GitHub App Permissions** lalu izinkan repository itu.
3. Di halaman **Configure Project**, isi:
   - **Framework Preset:** Other
   - **Root Directory:** `./`
   - **Build Command** dan **Output Directory:** biarkan kosong
4. Klik **Deploy**. Sekitar 30 detik kemudian muncul alamat seperti `https://baju-custom.vercel.app`.
5. Setiap kali Anda menjalankan `git push` (Bagian E), Vercel otomatis memperbarui situs dalam beberapa detik.
6. Nama alamat bisa diganti di **Settings → Domains**, misalnya `bajucustom-toko.vercel.app`, atau pakai domain sendiri.

Semua alamat di Bagian D berlaku sama untuk Vercel. Contohnya: `https://baju-custom.vercel.app/#pesan`.

## Bagian D — Setelah online

1. Buka alamat GitHub Pages. Katalog harus tampil.
2. Masuk sebagai **pemilik** (ikon orang di kanan atas, atau tambahkan `#login` di akhir alamat). Setelah pemilik masuk sekali, **link `/exec` lama otomatis mengarahkan pelanggan ke alamat baru**. Link lama yang sudah terlanjur dibagikan tetap bisa dipakai.
3. Bagikan alamat baru ke pelanggan:
   - `https://USERNAME.github.io/baju-custom/` membuka katalog.
   - `https://USERNAME.github.io/baju-custom/#pesan` langsung membuka form pesanan.
   - `https://USERNAME.github.io/baju-custom/#status` langsung membuka halaman cek status.
4. Sesi login lama di perangkat tidak terbawa, karena alamatnya berbeda. Semua admin cukup login ulang sekali.

## Bagian E — Memperbarui aplikasi nanti

- **Tampilan berubah** (file `index.html`, `css/`, `js/`): ganti file di folder `baju-custom-web`, lalu dari folder itu jalankan perintah di bawah. GitHub Pages dan Vercel ikut terbarui otomatis:
  ```bash
  git add .
  git commit -m "Perbarui tampilan"
  git push
  ```
  GitHub Pages diperbarui dalam 1–2 menit. Kalau masih tampil versi lama, tekan **Ctrl+Shift+R**.
- **Kode.gs berubah:** tempel di editor Apps Script, lalu buka **Kelola deployment → Edit → Versi baru → Terapkan**. Jangan pakai "Deployment baru", karena URL `/exec` akan berubah dan `js/config.js` harus diubah lagi.

## Bagian F — Mengatasi masalah

| Yang terlihat | Penyebab | Cara memperbaiki |
| --- | --- | --- |
| "Alamat server belum diatur…" | `GAS_URL` di `js/config.js` belum diisi atau salah format | Isi URL `/exec` (Bagian B), lalu `git add .`, `git commit -m "isi config"`, `git push` |
| "Server mengirim jawaban yang tidak dikenali…" | Deployment Apps Script tidak diset **Siapa saja**, atau URL `/exec` milik deployment lain | Periksa Kelola deployment → Yang memiliki akses: **Siapa saja**. Pastikan URL di `config.js` sama persis |
| "Aplikasi belum di-setup…" | `setupAplikasi()` belum pernah dijalankan di proyek ini | Jalankan `setupAplikasi` sekali dari editor |
| Halaman GitHub 404 | `index.html` tidak berada di root repository | Buka repository di browser. Kalau `index.html` tidak terlihat langsung, folder yang di-push salah. Ulangi Bagian C dari folder `baju-custom-web` dengan `git push -u origin main --force` |
| Tampilan polos tanpa warna | Folder `css/` atau `js/` tidak ikut ter-upload | Pastikan repository berisi folder `css` dan `js`. Upload ulang lewat terminal |
| Perubahan Kode.gs tidak berpengaruh | Deployment masih versi lama | Kelola deployment → Edit → **Versi baru** |
| `Password authentication is not supported` | GitHub menolak kata sandi akun | Pakai Personal Access Token (Bagian C langkah 7) |

---

## Fitur & keamanan

### Bukti pesanan (PDF)

- **Dari panel admin:** buka detail pesanan, lalu klik **Bukti pesanan (PDF)**. Ada tiga pilihan:
  - **Kirim via WhatsApp** membuka chat pelanggan dengan pesan berisi kode, total, status bayar, dan link PDF.
  - **Unduh PDF** untuk dilampirkan sendiri di chat.
  - **Buka** untuk melihat PDF di Drive.
- **Oleh pelanggan sendiri:** tombol **Unduh bukti pesanan (PDF)** ada di halaman "Pesanan berhasil dikirim" dan di halaman **Cek Status**. Pelanggan cukup memasukkan kode dan 4 digit akhir No HP.
- **Isi PDF:** nama toko, kode dan tanggal pesanan, data pemesan, rincian desain/lengan/ukuran/qty/harga, total, dan status bayar. Jika belum lunas, PDF juga memuat info rekening. Alamat dan jam pengambilan ikut dicantumkan.
- **Data selalu terbaru:** PDF dibuat ulang setiap tombol diklik, lalu disimpan di folder `Bukti_Pesanan` (versi lama otomatis dibuang).
- **Link PDF:** file dibagikan sebagai "siapa saja yang punya link" agar bisa dibuka pelanggan. Jika akun Workspace membatasi berbagi, link tidak terbuka untuk pelanggan. Dalam kasus itu, pakai **Unduh PDF** lalu lampirkan di chat.

### Penjualan marketplace & laporan

- **Menu Marketplace** (ikon toko di sidebar, khusus pemilik) dipakai untuk mencatat pesanan dari Shopee, Tokopedia, TikTok Shop, Lazada, dan marketplace lain.
- **Mencatat penjualan:** klik **Catat penjualan**, lalu isi:
  - marketplace, tanggal, dan desain;
  - jumlah pcs dan nilai penjualan;
  - potongan (biaya admin, ongkir, voucher). Pendapatan bersih dihitung otomatis.
- **Satu pesanan atau rekap harian:** setiap pesanan bisa dicatat satu per satu, atau cukup satu catatan rekap per hari per marketplace.
- **Retur atau batal:** ubah status catatan menjadi **Retur**. Catatan itu tidak dihitung dalam omzet.
- **Daftar marketplace:** ubah di **Pengaturan → Toko & pembayaran → Daftar marketplace**.
- **Beranda** menampilkan omzet, pesanan, dan pcs gabungan web dan marketplace, ditambah kartu **Penjualan per kanal**.
- **Unduh laporan** (di menu Marketplace) menghasilkan file CSV per bulan berisi semua transaksi web dan marketplace, plus rekap per kanal. File ini bisa dibuka di Excel atau Google Sheets.
- **Sheet `Marketplace`** dibuat otomatis saat pertama kali dipakai. `setupAplikasi()` tidak perlu dijalankan ulang.

### Fungsi darurat (dijalankan dari editor Apps Script)

| Fungsi | Kapan dipakai |
| --- | --- |
| `resetSandiPemilik()` | Sandi akun `pemilik` lupa atau terkunci. Sandi baru muncul di log. |
| `rotasiSecretSesi()` | Semua orang perlu keluar, misalnya jika curiga ada kebocoran. |
| `buatPengingatHarian()` | Menguji pengingat tanpa menunggu pukul 06.00. |

### Keamanan

- Kata sandi tidak pernah disimpan dalam bentuk asli. Yang disimpan hanya hash dan salt di **Script Properties**, bukan di sheet.
- Token login berlaku 12 jam. Akun yang dinonaktifkan langsung kehilangan akses.
- Login salah 5 kali berturut-turut membuat akun terkunci selama 15 menit.
- Bukti bayar tetap **privat** di Drive. Admin melihatnya lewat aplikasi, bukan lewat tautan publik.
- Repository GitHub bersifat publik, tetapi tidak berisi rahasia apa pun. Isinya hanya tampilan dan alamat API. Semua data dan kata sandi tetap di Google.
- Hanya fungsi yang terdaftar di `daftarApi_()` yang bisa dipanggil dari luar. Fungsi seperti `setupAplikasi` tidak bisa dipanggil lewat internet.
- Foto desain dibagikan "siapa saja yang punya link" agar tampil di katalog. Pada akun Google Workspace yang membatasi berbagi publik, foto bisa tidak tampil. Jika itu terjadi, minta admin Workspace mengizinkan berbagi file.
- Jangan bagikan spreadsheet database, dan jangan menambah editor proyek Apps Script sembarangan. Editor proyek bisa melihat Script Properties.
