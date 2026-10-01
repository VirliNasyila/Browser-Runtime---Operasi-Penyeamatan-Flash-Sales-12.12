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
estimasi analitik kecuali baris S0 dan S1 yang berasal dari alat ukur serta pengukuran Network
tab; temuan T-04 dan T-05 dari tim lain (TK-1041, TK-1081) juga memakai angka terukur.

## 2. Lingkungan pengukuran
- Laptop: Virli Nasyila Putri — AMD Ryzen 5 5500U with Radeon Graphics
- Chrome: Virli Nasyila Putri — 154.0.8037.92 (Official Build) (64-bit) (cohort: 154.0.8037.92 Rollout)
- Jumlah produk: `npm start` → **3.000 produk** (default `JUMLAH_PRODUK`, bukan varian `start:ringan`)
- Throttling: CPU 4x slowdown, viewport 412×915, tanpa throttling jaringan (protokol TUGAS.md §7)
- **Penyimpangan dari protokol:** perekaman panel Performance **tidak dilakukan** — menurut dosen
  perekaman trace bersifat opsional. Karena itu:
  - baris **S1** memakai angka nyata dari alat ukur `?ukur=1` (tercatat di `PREDIKSI.md` P-01);
  - baris **S0** memakai angka nyata dari pengukuran Network tab (`PREDIKSI.md` P-06);
  - baris lain diestimasi dari mekanisme kode dan diberi tanda **(estimasi)**;
  - bukti trace untuk S4/S6 tidak tersedia.

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS | 0,423 saat mengetik (alat ukur, P-01); 0–0,997 saat reload (P-06) | 0,059 (P-01); 0,137 (P-06) | <= 0,1 | sebagian (0,059 ya; 0,137 belum) |
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama | 3000/3016 (P-06) | 8/24 (P-06) | sebanding dengan yang terlihat | **ya** |
| S1 | INP | **15.848 ms** (alat ukur) | **48 ms** (alat ukur) | <= 200 ms | **ya** |
| S1 | Long task terlama | **9.368 ms** (alat ukur) | **0 ms** (alat ukur) | <= 100 ms | **ya** |
| S2 | INP | ratusan hingga ribuan ms (estimasi analitik, serialisasi 9.000 riwayat) | <= 50 ms **(estimasi)** | <= 200 ms | tercapai **(estimasi)** |
| S3 | Jumlah pesanan dari 3 klik | 3 (tanpa penguncian in-flight) | tepat 1, dengan status "Memproses…" | 1 | **ya** |
| S4 | INP / progres tergambar bertahap? | orde detik / tidak (0%→100%) **(estimasi)** | ≤200 ms & progres bertahap **(estimasi)** | <= 200 ms | belum diukur |
| S5 | Frame > 50 ms per 10 dtk | puluhan frame lambat & long task >100 ms **(estimasi)** | <= 2 per 10 dtk **(estimasi)** | <= 2 | tercapai **(estimasi)** |
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

### T-04: Pencarian membekukan halaman di tiap huruf yang diketik

- **Tiket terkait:** TK-1041
- **Gejala bagi pengguna:** Mengetik di kolom pencarian terasa macet/hang; huruf-huruf
  seperti tertahan, hasil baru muncul setelah jeda lama.
- **Bukti:** Data widget `?ukur=1` sebelum/sesudah (lihat PREDIKSI.md P-01) — INP turun
  dari 15.848ms ke 48ms. [Catatan: flame chart Performance panel tidak berhasil
  direkam di perangkat ini untuk kasus ini — lihat bagian 2 "Penyimpangan dari protokol".]
- **Akar masalah dan mekanismenya:** Event `input` pada `#kolom-cari` memicu
  `terapkanSaringan()` secara sinkron di task yang sama, yang memanggil `renderProduk()`
  membangun ulang seluruh kisi kartu. Di dalamnya, `samakanTinggiJudul()` melakukan pola
  baca-tulis (`offsetHeight` lalu `style.height`) berulang di dalam loop, memaksa browser
  menjalankan tahap Layout berkali-kali secara sinkron ("layout thrashing") dalam satu
  task tanpa titik yield — input berikutnya menumpuk di antrean sampai task selesai.
- **Kualitas yang terdampak (ISO/IEC 25010):** Performance efficiency (time behaviour —
  task berdurasi puluhan detik; resource utilization — Layout dihitung berulang tanpa
  perlu). Interaction capability (operability — input tidak responsif selama task
  berjalan).
- **Perbaikan:** (1) Debounce 180ms pada `terapkanSaringan`. (2) Ganti `samakanTinggiJudul`
  dengan `-webkit-line-clamp` di CSS. (3) Pecah render jadi bertahap per 60 kartu lewat
  IntersectionObserver.
- **Trade-off:** Hasil pencarian terasa tertunda ~180ms (disengaja). Kartu di bagian bawah
  daftar besar baru muncul saat digulir, bukan seketika. Alternatif Web Worker tidak
  dipilih karena kompleksitas serialisasi lebih besar dari manfaatnya.
- **Hasil:** INP 15.848ms → 48ms. Long task terlama 9.368ms → 0ms. CLS 0,423 → 0,059.

### T-05: Ribuan gambar diminta sekaligus meski baru sebagian terlihat

- **Tiket terkait:** TK-1081
- **Gejala bagi pengguna:** Halaman terasa lambat/berat dimuat, gambar produk muncul
  bertahap lama, kemungkinan boros kuota data pada koneksi terbatas.
- **Bukti:** Network tab (filter Img) sebelum/sesudah — screenshot jumlah request dan
  waktu selesai (lihat PREDIKSI.md P-06).
- **Akar masalah dan mekanismenya:** `buatKartu()` mengisi `gambar.src` langsung tanpa
  `loading="lazy"`, dan `renderProduk()` memanggil `buatKartu()` untuk SELURUH hasil
  filter dalam satu loop sinkron — browser menembak request untuk semua gambar sekaligus
  tanpa peduli posisi viewport. Tanpa `width`/`height`, ruang gambar juga tidak
  tercadang sebelum gambar dimuat, berkontribusi ke CLS yang variatif.
- **Kualitas yang terdampak (ISO/IEC 25010):** Performance efficiency (resource
  utilization — bandwidth terbuang untuk gambar di luar layar; time behaviour — waktu
  selesai muat 24,70 detik). Interaction capability (user engagement — gambar lambat
  muncul menurunkan kenyamanan; inclusivity — berat untuk koneksi/perangkat terbatas).
- **Perbaikan:** Tambah `loading="lazy" decoding="async" width height` pada `<img>`,
  dan pecah `renderProduk()` jadi render bertahap per 60 kartu via IntersectionObserver.
- **Trade-off:** Total waktu memuat SEMUA gambar (bila di-scroll habis) kurang lebih
  sama, hanya tersebar mengikuti kecepatan scroll, bukan menumpuk di awal. Pagination
  dipertimbangkan tapi tidak dipilih karena mengubah cara pengguna menjangkau produk.
- **Hasil:** Request gambar 10 detik pertama 3000/3016 → 8/24. Waktu selesai 24,70 detik
  → 1,92 detik. CLS membaik ke 0,137 (masih di atas target 0,1).

### T-06: Scroll terhambat listener non-passive, layout thrashing, dan hashing analitik sinkron
- **Tiket terkait:** TK-1063
- **Gejala bagi pengguna:** Scroll daftar produk patah-patah dan tidak mulus saat digulir terus-menerus (Bu Ningsih).
- **Bukti:** tidak ada rekaman trace (opsional). Bukti mekanis kode:
  1. `public/js/gulir.js` memasang listener `touchmove` dan `wheel` dengan opsi `{ passive: false }` pada `#utama`.
  2. `periksaGulir()` membaca `document.documentElement.scrollHeight` tepat setelah mutasi kelas/atribut (`kepala.classList.toggle('melayang')`, `keAtas.hidden`), lalu menulis `bar.style.width` secara berulang di setiap scroll tick.
  3. `IntersectionObserver` memanggil `window.Lacak.kirim('impression', ...)` secara sinkron untuk tiap kartu yang muncul, memicu fungsi `f()` berulang yang menjalankan loop 2.000.000 iterasi di `vendor/lacak.min.js`.
- **Akar masalah dan mekanismenya:**
  - Listener non-passive memaksa thread kompositor memblokir scrolling untuk menunggu main thread mengeksekusi JavaScript.
  - Pembacaan `scrollHeight` setelah mutasi style memaksa browser melakukan perhitungan Layout sinkron (*layout thrashing*), dan animasi `width` memicu Layout+Paint di main thread pada tiap event scroll.
  - Hashing analitik 2 juta iterasi per kartu membebani CPU secara masif saat scrolling kontinu, menghasilkan rentetan long task (>100 ms) dan frame lambat (>50 ms).
- **Kualitas yang terdampak (ISO/IEC 25010):** *performance efficiency → time behaviour* (frame drop >50 ms dan lag) serta *resource utilization* (CPU terbuang oleh kalkulasi layout berulang dan loop hashing sinkron); *interaction capability → operability* (kemampuan manipulasi scroll terganggu) dan *user engagement* (pengguna terdistraksi dan tidak nyaman).
- **Perbaikan:**
  1. Pasang CSS `overscroll-behavior-y: contain` pada `body` untuk menangani overscroll/pull-to-refresh secara native; hapus listener `touchmove`/`wheel` non-passive; pasang listener `scroll` dan `resize` dengan `{ passive: true }`.
  2. Throttle `periksaGulir` dengan `requestAnimationFrame` agar berjalan sinkron dengan refresh rate layar (maksimal 1× per frame).
  3. Hilangkan layout thrashing: simpan `tinggiScrollMaks` dalam cache dan perbarui hanya saat ada batch produk baru di `segarkanGulir` atau saat `resize`.
  4. Pindahkan progress bar ke properti komposit `transform: scaleX(...)` dan gunakan guard boolean agar tidak merusak class/DOM di setiap scroll.
  5. Kumpulkan impresi kartu ke antrean batch dan kirim via `requestIdleCallback` (`{ produk: batch }`), memangkas komputasi 2 juta iterasi dari puluhan kali menjadi 1 kali per batch saat browser idle.
- **Trade-off:** Pencatatan impresi analitik tertunda beberapa ratus milidetik hingga browser idle, namun seluruh data produk tetap terkirim secara lengkap dan benar sesuai Aturan 1.
- **Hasil:** belum diukur (lihat §2); estimasi di `PREDIKSI.md` P-05.

### T-07: Serialisasi 9.000 riwayat memblokir feedback tombol keranjang
- **Tiket terkait:** TK-1044
- **Gejala bagi pengguna:** Menekan tombol "+ Keranjang" tidak ada reaksi apa-apa, pengguna mengira tombol rusak lalu menekan berulang kali hingga isi keranjang melonjak (Pak Anton).
- **Bukti:** tidak ada rekaman trace (opsional). Bukti mekanis kode di `public/js/keranjang.js`: `bacaRiwayat()` membaca 9.000 objek riwayat dari `localStorage`, lalu memanggil `window.Lacak.kirim('add_to_cart', { produk, keranjang, riwayat, ... })` secara sinkron sebelum mengubah teks tombol. Di `vendor/lacak.min.js`, fungsi `k()` memanggil `JSON.stringify` pada string >1 MB, fungsi `f()` menjalankan 2.000.000 iterasi `Math.imul`, dan `t(s)` menjalankan 12 putaran iterasi string >1 MB.
- **Akar masalah dan mekanismenya:** Pekerjaan sinkron masif (serialisasi JSON >1 MB, 2 juta iterasi hashing, 12 putaran checksum, dan disk I/O `localStorage.setItem`) dijalankan di dalam event handler klik sebelum ada perubahan DOM. Karena tidak ada titik yield ke browser, *rendering opportunity* tertahan dan layar tampak membeku (INP orde detik). Ketiadaan umpan balik seketika (*optimistic UI*) memicu galat pengguna (*user error*) berupa penekanan tombol berulang.
- **Kualitas yang terdampak (ISO/IEC 25010):** *performance efficiency → time behaviour* (INP tinggi dan antrean interaksi macet); *interaction capability → operability* dan *user error protection* (pengguna terdorong melakukan aksi berulang yang tidak diinginkan).
- **Perbaikan:**
  1. *Optimistic UI*: langsung perbarui teks tombol (`'Ditambahkan ✓'`), tambahkan class `'sudah'`, tampilkan toast, dan perbarui lencana keranjang di awal fungsi (<2 ms).
  2. Pangkas payload analitik `add_to_cart`: kirim ringkasan 5 aktivitas terakhir (`riwayat.slice(-5)`) dan total riwayat, bukan menduplikasi seluruh 9.000 entri.
  3. Tunda pembaruan riwayat ke `localStorage` dan pemanggilan `Lacak.kirim` ke macrotask via `setTimeout(..., 0)` agar interaksi klik selesai seketika dan browser langsung menggambar perubahan tombol.
- **Trade-off:** Pencatatan riwayat di `localStorage` dan pengiriman analitik berjalan terpaut beberapa milidetik setelah klik (asinkron), namun UI merespons secara instan.
- **Hasil:** belum diukur (lihat §2); estimasi analitik di `PREDIKSI.md` P-07.

### T-08: Ketiadaan penguncian proses jaringan memicu pesanan ganda
- **Tiket terkait:** TK-1052
- **Gejala bagi pengguna:** Menekan tombol "Beli sekarang" sekali tidak ada tanda memproses, pengguna menekan lagi hingga tagihan membengkak menjadi tiga pesanan (Mbak Sari).
- **Bukti:** tidak ada rekaman trace (opsional). Bukti mekanis kode: `beliSekarang` di `public/js/keranjang.js` tidak menonaktifkan tombol dan tidak memberi status loading selama menunggu `fetch('/api/pesanan')` (yang di server memiliki latensi simulasi 350 ms). Setiap klik cepat meluncurkan request `POST` baru secara konkuren, dan server membuat pesanan baru untuk setiap request.
- **Akar masalah dan mekanismenya:** Operasi transaksional asinkron dijalankan tanpa mekanisme proteksi konkurensi (*in-flight guard / idempotency locking*). Ditambah ketiadaan umpan balik visual bahwa permintaan sedang dikirim ke server, pengguna mengira klik belum terdaftar dan menekannya kembali sebelum request pertama selesai.
- **Kualitas yang terdampak (ISO/IEC 25010):** *interaction capability → user error protection* (sistem gagal melindungi pengguna dari aksi ganda yang merugikan secara finansial); *performance efficiency → capacity* (beban server meningkat akibat request redundan).
- **Perbaikan:**
  1. Pasang *in-flight guard* berbasis `Set` (`sedangMemprosesBeli`) dan kunci tombol (`disabled = true`).
  2. Ubah teks tombol secara seketika menjadi `'Memproses…'` saat diklik untuk memberi kepastian visual kepada pengguna.
  3. Pangkas payload analitik `begin_checkout` dan tunda pemanggilannya ke macrotask.
  4. Setelah respons `201 Created` tiba, tampilkan toast sukses, ubah tombol menjadi `'Dipesan ✓'`, dan buka kembali kunci setelah jeda aman 1,5 detik.
- **Trade-off:** Tombol dinonaktifkan selama pemrosesan dan jeda 1,5 detik berikutnya; pengguna tidak bisa memesan produk yang sama secara berturut-turut dalam rentang tersebut (kebijakan perlindungan yang disengaja).
- **Hasil:** belum diukur (lihat §2); estimasi analitik di `PREDIKSI.md` P-08.

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

- Pengukuran S4/S6 belum dilakukan (perekaman opsional) — angka pada tabel §3 selain S0 dan S1
  adalah estimasi analitik. Bila dosen kembali mensyaratkan trace, dua skenario itu yang harus
  direkam lebih dulu, dengan `npm run start:ringan` bila laptop tidak kuat pada 4× slowdown.
- Tiket yang bukan bagian kami: TK-1041 dan TK-1081 dikerjakan tim lain dan sudah tercatat sebagai
  T-04 dan T-05. Seluruh tiket tim (TK-1057, TK-1070, TK-1078, TK-1063, TK-1044, TK-1052) telah
  selesai diperbaiki dan dianalisis dalam laporan ini.
- Resiko: `katalog.js`, `toko.css`, dan `PREDIKSI.md` disentuh lebih dari satu orang — rebase pendek
  sebelum commit tim agar tidak ada yang tertimpa.

## 7. Pernyataan penggunaan AI dan pembagian kerja
- Alat AI yang dipakai: **opencode (agent coding, model mimo-v2.6-flash)** untuk analisis akar
  masalah dari kode, penulisan hipotesis di `PREDIKSI.md`, implementasi tiga perbaikan, dan penyusunan
  laporan. Nama AI, prompt, serta analisis kelemahan usulannya dicatat di `laporan/AUDIT-AI.md`
  (A-01 milik tim, A-02 dan A-03 milik tiket ini). Angka pengukuran **tidak** dihasilkan AI — S0 dan
  S1 dari alat ukur, sisanya estimasi berlabel sesuai §2.
- Pertanyaan yang diajukan ke AI:
  - Virli Nasyila Putri: "Berikan gambaran untuk mengerjakan tugas web ini, dan juga berikan
    saran/usulan hal-hal yang baik dilakukan dan buruk dilakukan"
- Pembagian kerja anggota:
  1. Faiz Akhsya 241524039 — TK-1057 (P-02), TK-1070 (P-03), TK-1078 (P-04)
  2. Idotoho Reimon Simanjuntak 241524047 — TK-1063 (P-05, T-06), TK-1044 (P-07, T-07), TK-1052 (P-08, T-08)
  3. Virli Nasyila Putri 241524062 — TK-1041 (P-01, T-04), TK-1081 (P-06, T-05)
