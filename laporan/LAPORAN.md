# Laporan audit performa dan interaksi TokoKilat

Anggota:  
1. Faiz Akhsya 241524039
2. Idotoho Reimon Simanjuntak 241524047
3. Virli Nasyila Putri 241524062
Tanggal: 25/09/2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)

Tiga keluhan utama dari tiga tiket yang kami tangani (TK-1057, TK-1070, TK-1078) berasal dari satu
kesalahan pola yang sama: ** JavaScript dijalankan seolah-olah browser sempat menggambar di sela-
selanya **. Perhitungan voucher hanya menguras antrean microtask sehingga progres melompat dari 0%
ke 100% dan layar membeku; dua timer 10 ms memaksa Layout + Paint 200 kali per detik walau pengguna
diam, membuat HP panas; dan banner promo yang disisipkan 1,8 detik setelah data datang menggeser
seluruh halaman sehingga sasaran klik bergeser ke iklan. Perbaikannya: memberi jeda berbentuk task
sejati, memindahkan semua animasi ke compositor, dan memesan ruang sejak paint pertama. Tiga
perbaikan ini dikerjakan di commit terpisah dengan hipotesis yang di-commit lebih dulu
(`laporan/PREDIKSI.md`). Karena perekaman trace opsional menurut dosen, angka di bawah adalah
estimasi analitik kecuali baris S1 yang berasal dari alat ukur.

## 2. Lingkungan pengukuran

- Spesifikasi laptop: `[ISI: mis. Ryzen 5 xxxx / 16 GB / Windows 11]`
- Chrome: `[ISI: versi, mis. 140 stable]`
- Jumlah produk: `npm start` → **3.000 produk** (default `JUMLAH_PRODUK`)
- Throttling: CPU 4x slowdown, viewport 412×915, tanpa throttling jaringan (protokol TUGAS.md §7)
- **Penyimpangan dari protokol:** perekaman panel Performance **tidak dilakukan** — menurut dosen
  perekaman trace bersifat opsional. Karena itu:
  - baris **S1** memakai angka nyata dari alat ukur `?ukur=1` (tercatat di `PREDIKSI.md` P-01);
  - baris lain diestimasi dari mekanisme kode dan diberi tanda **(estimasi)**;
  - bukti trace untuk S0/S4/S6 tidak tersedia.

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS | 0,423 (alat ukur, via P-01) **(estimasi sisa: ≤0,1)** | ≤0,1 **(estimasi)** | <= 0,1 | belum diukur |
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama | ribuan (semua `<img>` langsung `src`) | — (TK-1081, tim lain) | sebanding dengan yang terlihat | di luar tiket ini |
| S1 | INP | **15.848 ms** (alat ukur) | **48 ms** (alat ukur) | <= 200 ms | **ya** |
| S1 | Long task terlama | **9.368 ms** (alat ukur) | **0 ms** (alat ukur) | <= 100 ms | **ya** |
| S2 | INP | — (tiket TK-1044, tim lain) | — | <= 200 ms | — |
| S3 | Jumlah pesanan dari 3 klik | 3 (tiket TK-1052, tim lain) | — | 1 | — |
| S4 | INP / progres tergambar bertahap? | orde detik / tidak (0%→100%) **(estimasi)** | ≤200 ms & progres bertahap **(estimasi)** | <= 200 ms | belum diukur |
| S5 | Frame > 50 ms per 10 dtk | — (tiket TK-1063, tim lain) | — | <= 2 | — |
| S6 | Frame > 50 ms per 10 dtk | ~200 paksaan Layout+Paint per dtk **(estimasi)** | 1 tugas/dtk, sisanya compositor **(estimasi)** | <= 2 | belum diukur |

## 4. Temuan

### T-01: Antrean microtask menghabiskan seluruh perhitungan voucher tanpa pernah menggambar
- **Tiket terkait:** TK-1057
- **Gejala bagi pengguna:** layar membeku saat memasukkan voucher; progres "0%" lalu langsung
  selesai; scroll tidak bisa digerakkan (Mas Dimas mengira aplikasinya crash).
- **Bukti:** tidak ada rekaman trace (opsional). Bukti mekanis: `public/js/harga-promo.js` —
  `hitungHargaPromo` berlabel `async` tetapi tidak berisi `await` apa pun, sehingga promise-nya
  selalu selesai lewat microtask. Loop `await hitungHargaPromo(...)` di dalam `terapkanVoucher`
  karena itu berjalan sebagai satu rangkaian microtask tanpa jeda. Lihat juga angka estimasi di
  `PREDIKSI.md` P-02.
- **Akar masalah dan mekanismenya:** browser hanya melakukan tahap rendering **setelah** antrean
  microtask kosong. Selama loop berjalan, Style dihitung ulang berkali-kali tetapi tidak pernah
  sampai ke Layout/Paint, dan event `input`/`scroll` tetap berada di antrean task. Akibatnya progres
  tidak pernah tergambar (0% → 100% dalam satu frame) dan input pengguna tertahan — persis gejala
  yang dieluhkan. Menambah `async` tidak menolak; hanya **yield berbentuk task** (`setTimeout`) yang
  membuka rendering opportunity.
- **Kualitas yang terdampak (ISO/IEC 25010):** *performance efficiency → time behaviour* (satu
  interaksi memakan waktu orde detik); *interaction capability → operability* (pengguna tidak bisa
  menggulir/mengedit di sela proses) dan *user error protection* (pengguna mengira crash lalu
  menutup/mengulang aksi).
- **Perbaikan:** (a) hapus loop `for (i < 40) simulasiCicilan(hargaAkhir + i)` yang hasilnya tidak
  pernah dipakai (41× kerja percuma, fungsi murni sehingga output identik); (b) potong kerja tiap
  ±10 ms lalu `await new Promise(r => setTimeout(r, 0))`; (c) tulis progres hanya saat persen
  berubah; (d) kunci tombol + token pembatalan; (e) patch `<span class="harga-voucher">` in-place
  alih-alih render ulang 3.000 kartu. Commit `09a5ab4`.
- **Trade-off:** komputasi total jadi lebih lama sedikit karena tiap potongan disertai satu tugas
  timer (biaya ~0,1 ms × ratusan), tetapi justru itu yang membuat UI tetap hidup; alternatif Web
  Worker ditolak karena pekerjaan berat sesungguhnya ada di DOM, bukan di aritmetika.
- **Hasil:** belum diukur (lihat §2); estimasi di `PREDIKSI.md` P-02.

### T-02: Timer 10 ms memaksa Layout + Paint terus-menerus saat pengguna diam
- **Tiket terkait:** TK-1070
- **Gejala bagi pengguna:** HP panas dan baterai turun setelah 5 menit hanya melihat-lihat
  (Pak Yusuf).
- **Bukti:** tidak ada rekaman trace (opsional). Bukti kode: `public/js/promo.js` — dua
  `setInterval(..., 10)`; yang pertama membaca `wadah.offsetWidth` lalu menulis `garis.style.width`
  dan 4× `textContent`, yang kedua membaca `teks.offsetWidth` lalu menulis `teks.style.left`.
- **Akar masalah dan mekanismenya:** pembacaan layout diikuti penulisan gaya dalam siklus yang sama
  memaksa browser menjalankan tahap **Style + Layout + Paint** setiap kali (layout thrashing), dan
  karena dipicu timer — bukan input — selalu mendapat rendering opportunity penuh setiap frame.
  100 tick/dtk × 2 timer = ~200 siklus per detik tanpa henti. Ditambah `@keyframes denyut` yang
  menganimasikan `top` + `box-shadow` (properti main-thread) pada ratusan badge ⚡, yang berarti
  repaint setiap frame selama animasi berjalan.
- **Kualitas yang terdampak (ISO/IEC 25010):** *performance efficiency → resource utilization*
  (CPU/baterai terbakar tanpa pekerjaan berguna) dan *capacity* (thermal throttling membuat
  perangkat makin lambat); *interaction capability → user engagement* (pengguna berhenti memakai
  halaman karena perangkat terasa panas).
- **Perbaikan:** hitung mundur jadi satu tugas per detik, terselaraskan ke batas detik jam dinding,
  hanya menulis angka yang berubah; garis memakai `transform: scaleX` (properti komposit, tanpa
  `offsetWidth`); teks berjalan dipindah ke `@keyframes` + `translateX` (dua salinan identik,
  geser −50% lebar sendiri → mulus dan nol JS); denyut badge memakai `transform`/`opacity`.
  Sel sentimanit dihapus dari `index.html`. Commit `59d5d0a`.
- **Trade-off:** resolusi hitung mundur turun dari 10 ms ke 1 detik — jam:menit:detik tetap benar
  (fitur utuh), tetapi angka perseratus detik hilang; inilah harga agar target S6 "aktivitas main
  thread saat diam mendekati nol" dapat dicapai. `requestAnimationFrame` dipertimbangkan tetapi
  ditolak karena tetap membangunkan main thread setiap frame.
- **Hasil:** belum diukur (lihat §2); estimasi di `PREDIKSI.md` P-03.

### T-03: Konten yang menyusul menggeser halaman sampai sasaran klik bergeser
- **Tiket terkait:** TK-1078
- **Gejala bagi pengguna:** saat hendak menekan barang paling atas, halaman loncat turun sendiri
  dan yang terkena justru iklan promo (Kak Rara); diduga disengaja.
- **Bukti:** tidak ada rekaman trace (opsional). CLS sebelum perbaikan **0,423** (alat ukur,
  tercatat di P-01). Tiga sumber pergeseran diidentifikasi dari kode.
- **Akar masalah dan mekanismenya:**
  1. `promo.js` melakukan `$('#utama').prepend(banner)` **setelah** fetch `/api/promo` (ditunda
     server 1.800 ms) → ±148 px disisipkan di atas kisi; pergeseran >500 ms setelah input terakhir
     selalu dihitung CLS.
  2. `<img>` tidak punya atribut `width`/`height` dan CSS memakai `height:auto` → ruang baru terpesan
     setelah SVG datang (latensi CDN 60–300 ms per gambar) → kartu "tumbuh".
  3. `.kartu` beranimasi dari `margin-top: 16px` ke `0` → properti **layout** berubah; tiap kartu
     yang masuk layar menggeser baris di bawahnya. Scroll tidak meniadakan kontribusi CLS (hanya
     klik/keypress/tap yang meniadakan), jadi pergeseran ini tetap terhitung; `gulir.js` bahkan
     menambalnya dengan menulis `minHeight` saat scroll.
- **Kualitas yang terdampak (ISO/IEC 25010):** *performance efficiency → time behaviour* (CLS
  tinggi memaksa layout ulang saat load) dan *interaction capability → user error protection*
  (sasaran bergeser → klik mengenai elemen yang tidak diinginkan; pengguna menyalahkan aplikasi
  atas kesalahan yang sebenarnya sistemik) serta *operability*.
- **Perbaikan:** slot banner ada di `index.html` sejak paint pertama dan `promo.js` hanya
  `replaceChildren` (tidak ada penyisipan elemen baru); tinggi banner dikunci di CSS agar slot
  kosong dan banner terisi identik; `<img>` diberi `width="480" height="480"` + `aspect-ratio: 1`;
  animasi kartu pindah ke `opacity` + `transform` (fitur "efek kartu muncul" tetap ada) dan tulisan
  `minHeight` saat scroll dihapus; `samakanTinggiJudul()` dihapus, tinggi judul diseragamkan CSS
  (`-webkit-line-clamp` + `min-height`). Commit `8e6b40f`.
- **Trade-off:** tinggi banner kini tetap (200 px di layar sempit, 140 px ≥760 px) sehingga bila
  suatu saat teks promo jauh lebih panjang, isi dipotong (`overflow: hidden`) — ruang dipesan lebih
  dulu memang harus dibayar dengan kemungkinan pemotongan. Judul >3 baris kini berakhir elipsis,
  dan semua kartu berukuran 3 baris tinggi judul (sebelumnya tinggi maksimum dari 24 sampel).
- **Hasil:** belum diukur (lihat §2); estimasi di `PREDIKSI.md` P-04.

## 5. Dugaan yang ternyata keliru

- **Rudi #4 — "voucher sudah async jadi aman": KELIRU.** Justru penyebab utama TK-1057. `async`
  tanpa operasi I/O hanya menyelesaikan promise di microtask; microtask dikuras habis sebelum
  browser menggambar (mekanisme T-01). Yang menolak adalah `setTimeout`, bukan kata `async`.
- **Rudi #1 — "biang kerok utamanya loop O(n²) di `kategori.js`": KELIRU sebagai biang kerok utama.**
  Kodenya memang O(n²) dan memanggil `querySelectorAll` di dalam loop, tetapi `n = 8` kategori dan
  fungsi ini hanya dipanggil **sekali saat halaman dimuat** (≈64 iterasi, di bawah ambang long task
  50 ms). Ia tidak terkait dengan satu pun dari 8 tiket keluhan.
- **Rudi #3 — "ganti `urutkanGelembung` dengan quicksort": KELIRU relevansinya.** `urutkanGelembung`
  hanya dipakai untuk **12 merek** di kaki halaman (`kategori.js:10`); pengurutan produk justru
  sudah memakai `Array.prototype.sort` bawaan (`pencarian.js:37`). Menggantinya tidak akan
  terlihat di metrik mana pun.
- **Rudi #5 — "SDK analitik berat": SEBAGIAN KELIRU.** `vendor/lacak.min.js` hanya menyusun string
  dan mendorongnya ke antrean (ringan). Yang berat adalah **payload yang kita kirim** —
  `keranjang.js` melampirkan seluruh riwayat 9.000 entri pada tiap event, sehingga `JSON.stringify`
  raksasa dieksekusi sinkron di dalam handler klik. (Pemilik tiket TK-1044/TK-1052.)
- **Rudi #2 — "API produk lambat, minta server tambah": BENAR tapi di luar ruang lingkup dan bukan
  penyebab keluhan.** `/api/produk` memang ditunda 180 ms server (sekali saat load), sedangkan
  keluhan terjadi saat interaksi.

## 6. Yang belum beres dan rekomendasi

- Pengukuran S0/S4/S6 belum dilakukan (perekaman opsional) — angka pada tabel §3 selain S1 adalah
  estimasi analitik. Bila dosen kembali mensyaratkan trace, tiga skenario itu yang harus direkam
  lebih dulu, dengan `npm run start:ringan` bila laptop tidak kuat pada 4× slowdown.
- Tiket yang bukan bagian kami (TK-1041 selain debounce, TK-1044, TK-1052, TK-1063, TK-1081) masih
  dikerjakan tim lain; S2, S3, S5 dan baris gambar S0 sengaja dikosongkan.
- Rekomendasi untuk tim lain: `keranjang.js` mengirim riwayat 9.000 entri pada tiap event analytics
  (rekomendasi: kirim ringkasan, bukan seluruh array); `gulir.js` masih memakai listener `touchmove`/
  `wheel` non-passive yang memanggil `periksaGulir()` (pemilik TK-1063); semua gambar masih dimuat
  sekaligus tanpa `loading="lazy"` (pemilik TK-1081).
- Resiko: `katalog.js`, `toko.css`, dan `PREDIKSI.md` disentuh lebih dari satu orang — rebase pendek
  sebelum commit tim agar tidak ada yang tertimpa.

## 7. Pernyataan penggunaan AI dan pembagian kerja

- Alat AI yang dipakai: **opencode (agent coding, model mimo-v2.6-flash)** untuk analisis akar
  masalah dari kode, penulisan hipotesis di `PREDIKSI.md`, implementasi tiga perbaikan, dan penyusunan
  laporan. Nama AI, prompt, serta analisis kelemahan usulannya dicatat di `laporan/AUDIT-AI.md`
  (A-01 milik tim, A-02 dan A-03 milik tiket ini). Angka pengukuran **tidak** dihasilkan AI — S1 dari
  alat ukur, sisanya estimasi berlabel sesuai §2.
- Pembagian kerja anggota:
  1. Faiz Akhsya 241524039 — `[ISI]`
  2. Idotoho Reimon Simanjuntak 241524047 — `[ISI]`
  3. Virli Nasyila Putri 241524062 — `[ISI]`
