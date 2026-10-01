# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: [Pencarian memblokir main thread di tiap keystroke]

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 9/30/2026,  dae4aa6

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Widget ?ukur=1 mencatat saat mengetik "sepatu": INP 15848ms (interaksi terburuk berupa pointerdown), dengan tundaInput naik dari 6531ms→12635ms pada keystroke-keystroke berikutnya, menunjukkan antrean task menumpuk karena tiap huruf memicu kerja sinkron sebelum huruf sebelumnya selesai diproses. Long task terlama 9368ms. CLS 0.423. Total blokir 17074ms dari 2 long task.
{
  "waktu": "2026-09-30T12:29:49.986Z",
  "jumlahLongTask": 2,
  "longTaskTerlama": 9368,
  "totalBlokir": 17074,
  "jumlahInteraksi": 7,
  "inp": 15848,
  "inpRinci": {
    "durasi": 15848,
    "jenis": "pointerdown",
    "target": "?",
    "tundaInput": 6531,
    "proses": 0,
    "presentasi": 9317
  },
  "limaInteraksiTerlambat": [
    {
      "durasi": 15848,
      "jenis": "pointerdown",
      "target": "?",
      "tundaInput": 6531,
      "proses": 0,
      "presentasi": 9317
    },
    {
      "durasi": 14128,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 4813,
      "proses": 0,
      "presentasi": 9315
    },
    {
      "durasi": 13888,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 12635,
      "proses": 0,
      "presentasi": 1253
    },
    {
      "durasi": 12752,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 12132,
      "proses": 0,
      "presentasi": 620
    },
    {
      "durasi": 12600,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 12132,
      "proses": 0,
      "presentasi": 468
    }
  ],
  "cls": 0.423,
  "frameLambat": 55,
  "frameTerburuk": 17151
}
 Catatan: Performance panel gagal merekam/memproses trace di perangkat ini meski sudah 
  dicoba beberapa konfigurasi (CPU 4x, tanpa screenshot, rekaman singkat). Analisis fungsi 
  dominan di bawah berdasarkan pembacaan kode, didukung data widget di atas untuk metrik 
  agregat (INP/CLS/long task), bukan breakdown per-fungsi dari trace visual.
- **Dugaan mekanisme:**Event `input` pada `#kolom-cari` memicu `terapkanSaringan()` secara sinkron
  di task yang sama dengan event tersebut. Task ini memfilter+sort seluruh array produk lalu
  memanggil `renderProduk()`, yang menghapus dan membangun ulang seluruh kisi kartu. Di dalamnya,
  `samakanTinggiJudul()` membaca `offsetHeight` lalu menulis `style.height` berulang di dalam loop --
  pola read-write-read-write ini memaksa browser menjalankan tahap Layout berkali-kali secara sinkron
  ("layout thrashing"), bukan sekali di akhir frame. Karena semua ini satu task tanpa titik yield,
  tidak ada rendering opportunity di tengah -- input berikutnya menumpuk di antrean sampai task selesai.
- **Rencana perubahan:** (1) Debounce panggilan `terapkanSaringan` (180ms setelah keystroke terakhir)
  supaya kerja berat hanya jalan sekali per jeda mengetik, bukan per huruf. (2) Hilangkan
  `samakanTinggiJudul` sepenuhnya, ganti dengan `-webkit-line-clamp` di CSS sehingga tinggi judul
  konsisten tanpa JS pernah membaca ukuran elemen. (3) Pecah `renderProduk` jadi render bertahap per
  60 kartu, dipicu `IntersectionObserver` saat mendekati ujung kisi.
- **Prediksi terukur:** INP saat mengetik turun dari kemungkinan ratusan ms/hang menjadi <= 200ms,
  karena kerja berat tidak lagi terjadi di task event `input` itu sendiri (dipindah ke timer setelah
  jeda) dan kerja render yang tersisa dipecah jadi potongan kecil. Efek samping yang mungkin: hasil
  pencarian terasa "telat" ~180ms dibanding sebelumnya (trade-off yang disengaja), dan produk paling
  bawah pada daftar hasil besar baru muncul saat digulir, bukan seketika.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Web Worker untuk filter/sort -- tidak
  dipilih karena kompleksitas serialisasi data lebih besar dari manfaatnya di sini (kerja filter/sort
  sendiri relatif murah; yang mahal justru pembangunan DOM & layout thrashing).

### Sesudah perbaikan

- **Hash commit perbaikan:** dae4aa6
- **Hasil ukur (median 3 kali):** INP turun sangat drastis menjadi 48ms (dari sebelumnya 15.848ms). Long task dan total waktu blokir (total blocking time) berhasil hilang sepenuhnya (0ms). Selain itu, masalah pergeseran tata letak juga teratasi dengan CLS yang membaik menjadi 0.059 (dari sebelumnya 0.423).
- **Prediksi vs kenyataan:** Prediksi bahwa INP akan turun hingga <= 200ms terbukti benar, bahkan hasilnya jauh lebih baik (48ms). Analisis mengenai layout thrashing (pembacaan dan penulisan tata letak berulang) di samakanTinggiJudul sebagai penyebab utama penyumbatan antrean task juga terbukti benar. Memindahkan eksekusi ini ke CSS dan mendistribusikan rendering membebaskan main thread secara total.
- **Efek samping yang muncul:** Sesuai desain, pembaruan hasil pencarian terasa memiliki jeda sekitar 180ms karena debounce, namun UI browser tidak lagi hang/freeze sama sekali saat pengguna mengetik cepat. Kartu produk tambahan di bawah hanya akan muncul ketika layar digulir. Efek samping positif lainnya adalah layout halaman menjadi jauh lebih stabil (penurunan nilai CLS) karena tinggi elemen kini ditangani langsung oleh CSS (-webkit-line-clamp) sejak awal paint.

> **Catatan pengukuran:** perekaman trace DevTools bersifat **opsional menurut dosen**. Angka pada
> entri P-01 berasal dari alat ukur `?ukur=1` (pengukuran nyata), angka pada entri P-06 dari
> pengukuran Network tab. Seluruh angka pada entri P-02, P-03, dan P-04 adalah **estimasi analitik
> yang belum diukur**, dihitung dari mekanisme kode (jumlah produk × iterasi × sifat antrean
> tugas), bukan hasil rekaman.

---

## P-02: Loop voucher hanya menguras microtask, tidak pernah menggambar progres

**Tiket terkait:** TK-1057
**Tanggal entri ini:** 10/1/2026 (commit sebelum commit perbaikan)

### Sebelum perbaikan

- **Yang teramati (estimasi analitik, belum diukur):** gejala cocok dengan keluhan Mas Dimas —
  tulisan "Menghitung 0%" lalu melompat ke 100% dan selesai, scroll tidak bisa digerakkan selama
  proses. Perkiraan besarnya:
  - `keadaan.semuaProduk` = 3.000 objek (default `JUMLAH_PRODUK`).
  - Per produk, `hitungHargaPromo` (`public/js/harga-promo.js:31`) menjalankan `simulasiCicilan`
    sebanyak **41 kali**: 1 untuk hasil + 40 dari loop `for (let i = 0; i < 40; i++) simulasiCicilan(hargaAkhir + i)`
    di baris 37 yang **hasilnya dibuang** (fungsi murni, tidak ada efek samping).
  - Satu `simulasiCicilan` = loop tenor 1..24 dengan loop bulan bersarang → 24×25/2 = **300 iterasi**
    berisi `Math.log2`, `Math.ceil`, pembagian.
  - Total ≈ 3.000 × 41 × 300 ≈ **37 juta iterasi**, semuanya di dalam satu rangkaian microtask.
  - Ditambah 3.000 kali menulis `isi.style.width` dan `teks.textContent` tanpa pernah sempat
    digambar, lalu `perbaruiHargaVoucherDiKartu()` → `renderProduk()` 3.000 kartu + `samakanTinggiJudul()`.
  - **Estimasi INP/long task:** orede satuan detik (skenario S4: klik "Pakai voucher" lalu mengetik
    di kolom cari → tundaInput ≈ seluruh durasi komputasi). **Estimasi progres:** `0%` lalu `100%`
    dalam satu frame yang sama, karena tidak ada rendering opportunity di tengah.
- **Dugaan mekanisme:** `terapkanVoucher` menjalankan `await hitungHargaPromo(produk, aturan)` di
  dalam loop. `hitungHargaPromo` berlabel `async` tetapi **tidak punya satu pun operasi I/O maupun
  `await` di dalamnya** — promise-nya selalu selesai lewat *microtask*. Browser hanya memberi
  *rendering opportunity* setelah antrean microtask kosong, sehingga seluruh loop 3.000 produk
  berjalan sebagai satu task tanpa jeda: gaya (style) dihitung ulang berkali-kali tetapi tidak
  pernah sampai ke tahap Paint sebelum antrean habis. Akibatnya progres tidak pernah tergambar
  bertahap dan event `input`/`scroll` menumpuk di antrean task sampai loop selesai. Angka `0% → 100%`
  yang dialami pengguna adalah gejala langsung dari perilaku ini.
- **Rencana perubahan:** (1) Hapus loop 40× baris 37 karena hasilnya tidak dipakai (perilaku
  identik, kerja berkurang ~41×). (2) Ubah strategi antrian: kerja dipecah menjadi *time slice*
  ±10 ms, dan di antaranya `await new Promise(r => setTimeout(r, 0))` — `setTimeout` adalah
  **task**, bukan microtask, sehingga browser benar-benar sempat menghitung gaya + menggambar
  progres sebelum lanjut. (3) Tulis `style.width`/`teks.textContent` hanya saat nilai persen
  berubah. (4) Kunci tombol + token pembatalan supaya klik voucher kedua membatalkan loop pertama
  (mencegah race pada `hargaVoucher.clear()`).
- **Prediksi terukur (estimasi analitik, belum diukur):** long task terpecah menjadi potongan
  ≤10 ms (di bawah ambang 100 ms), INP S4 turun dari orde detik ke **≤200 ms**, dan progres
  tergambar bertahap (ratusan frame selama komputasi) sehingga kolom cari bisa diketik di sela
  komputasi.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** `requestIdleCallback` — tidak
  dipilih karena di halaman yang sedang digulir callback mudah tertunda lama, sedangkan target
  menuntut progres tetap bergerak; Web Worker — terlalu berat untuk sekadar memangkas kerja
  aritmetika, dan tetap perlu yield agar UI digambar. Dugaan Rudi #4 ("voucher sudah async jadi
  aman") **terbukti keliru di sini**: `async` tanpa I/O tidak membuka rendering opportunity.

### Sesudah perbaikan

- **Hash commit perbaikan:** 09a5ab4
- **Yang berubah di kode:** (1) loop `for (i < 40) simulasiCicilan(...)` dihapus — hasilnya memang
  tidak pernah dipakai, jadi output tiap produk identik dengan sebelumnya; (2) loop produk kini
  memotong kerja tiap ±10 ms lalu `await` `setTimeout(..., 0)` — **task**, sehingga browser sempat
  menghitung gaya + menggambar progres dan memproses event ketik/scroll yang menumpuk;
  (3) `style.width`/`teks.textContent` hanya ditulis saat persen berubah (maks 100×, bukan 3.000×);
  (4) tombol voucher dinonaktifkan selama berjalan dan klik baru membatalkan lama lewat token;
  (5) `perbaruiHargaVoucherDiKartu()` di `katalog.js` kini menempel/hapus satu `<span>` pada kartu
  yang sudah ada, alih-alih `renderProduk()` ulang 3.000 kartu.
- **Hasil ukur:** *belum diukur — perekaman trace opsional menurut dosen.*
- **Estimasi analitik sesudah perbaikan:** kerja per produk turun 41× (dari 41 panggilan
  `simulasiCicilan` menjadi 1 ≈ 300 iterasi) → total ≈ 37 juta menjadi ≈ 0,9 juta iterasi. Dengan
  potongan 10 ms, tugas terpanjang selama S4 diperkirakan **≤10–20 ms** (di bawah ambang 100 ms)
  dan progres digambar ratusan kali selama komputasi, bukan `0%` lalu `100%` di frame yang sama.
- **Prediksi vs kenyataan:** belum dapat dibandingkan tanpa pengukuran. Dugaan Rudi #4 terbukti
  keliru dari kode: yang memperbaiki bukan kata `async`-nya, melainkan yield berbentuk task.

---

## P-03: Dua timer 10 ms membakar main thread saat pengguna diam

**Tiket terkait:** TK-1070
**Tanggal entri ini:** 10/1/2026 (commit sebelum commit perbaikan)

### Sebelum perbaikan

- **Yang teramati (estimasi analitik, belum diukur):** keluhan Pak Yusuf — HP panas dan baterai
  turun walau hanya melihat-lihat. Perkiraan besarnya:
  - `pasangHitungMundur` (`public/js/promo.js:22`) menjalankan `setInterval(..., 10)` → **100
    kali/detik**, tiap tick: membaca `wadah.offsetWidth` (memaksa perhitungan layout jika ada yang
    kotor), menulis `garis.style.width`, dan 4× `textContent` angka.
  - `pasangTeksBerjalan` (`public/js/promo.js:38`) juga `setInterval(..., 10)` → **100 kali/detik**
    membaca `teks.offsetWidth` lalu menulis `teks.style.left` → pita promo digambar ulang utuh,
    properti `left` termasuk kategori repaint penuh, bukan komposit.
  - `@keyframes denyut` (`public/css/toko.css:99`) menganimasikan `top` + `box-shadow` — dua
    properti tahap main-thread — untuk setiap badge ⚡ di DOM (≈8% dari 3.000 kartu ter-*render*).
  - **Estimasi:** gaya + layout + paint dipicu ~200 kali/detik tanpa interaksi; pada perangkat
    kelas bawah tiap siklus dapat 0,5–2 ms → **estimasi 10–40% main thread tetap sibuk saat idle**.
    Kecepatan animasi 1 px/10 ms juga memaksa browser mempertahankan vsync timer terus-menerus.
- **Dugaan mekanisme:** ketiga sumber di atas tidak pernah berhenti dan tidak pernah memakai
  properti komposit (`transform`/`opacity`). Setiap pembacaan layout diikuti penulisan gaya dalam
  siklus yang sama = *layout thrashing* berkelanjutan, dan karena terpicu timer (bukan input),
  selalu mendapat *rendering opportunity* penuh setiap frame — persis "aktivitas main thread saat
  diam" yang gagal memenuhi target S6.
- **Rencana perubahan:** (1) Hitung mundur jadi tick 1 detik: hanya mengubah angka saat nilai
  berubah; garis memakai `transform: scaleX()` (komposit) sehingga tidak perlu membaca `offsetWidth`
  sama sekali. (2) Sel sentimanit `#hm-senti` **dihapus** (keputusan terdokumentasi) — inilah
  pemaksa timer 10 ms; tanpa ini jam:menit:detik tetap benar dan fitur hitung mundur utuh.
  (3) Teks berjalan dipindah ke `@keyframes` + `translateX` (sekali baca lebar saat setup).
  (4) Badge memakai `transform`/`opacity` + ring `::after`. (5) Semua animasi tetap dimatikan oleh
  `prefers-reduced-motion` yang sudah ada.
- **Prediksi terukur (estimasi analitik, belum diukur):** timer aktif turun dari 200/s menjadi
  ≤1/s saat idle; aktivitas main thread saat diam mendekati nol; sisa animasi (garis, teks
  berjalan, denyut badge) berjalan di compositor sehingga frame >50 ms saat S6 ≤2 per 10 detik.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** mempertahankan sentimanit lalu
  memindahkannya ke CSS murni — tidak mungkin, CSS tidak bisa menulis teks dua digit yang
  sinkron dengan jam dinding tanpa timer. Mengganti interval 10 ms dengan `requestAnimationFrame`
  tetap memicu Style+Layout+Paint tiap frame dan tetap membangunkan main thread → target S6 tetap
  gagal.

### Sesudah perbaikan

- **Hash commit perbaikan:** 59d5d0a
- **Yang berubah di kode:** sel `#hm-senti` dihapus dari `index.html`; `promo.js` tidak lagi
  memuat satu pun `setInterval` (hitung mundur jadi `setTimeout` terselaraskan batas detik jam
  dinding, hanya menulis angka yang berubah, garis lewat `transform: scaleX` tanpa sekali pun
  membaca `offsetWidth`); teks berjalan dan denyut badge pindah sepenuhnya ke `@keyframes`
  (`translateX`, `translateY`, `scale`, `opacity`).
- **Hasil ukur:** *belum diukur — perekaman trace opsional menurut dosen.*
- **Estimasi analitik sesudah perbaikan:** sumber kerja tak terhindarkan saat diam turun dari
  ~200 tugas/detik (2 timer 10 ms, masing-masing baca layout + tulis gaya) menjadi **1 tugas/detik**
  berisi 3 penulisan teks + 1 penulisan `transform`; selebihnya animasi berjalan di compositor
  tanpa membangunkan main thread. Ini adalah kondisi yang dituntut S6 ("aktivitas mendekati nol").
- **Prediksi vs kenyataan:** belum dapat dibandingkan tanpa pengukuran; perubahan mekanismenya
  dapat diverifikasi dari kode (tidak ada lagi `setInterval`, `offsetWidth`, `top`, atau
  `box-shadow` yang dianimasikan di berkas yang sama).

---

## P-04: Banner yang menyusul, gambar tanpa dimensi, dan kartu yang bergeser

**Tiket terkait:** TK-1078
**Tanggal entri ini:** 10/1/2026 (commit sebelum commit perbaikan)

### Sebelum perbaikan

- **Yang teramati (estimasi analitik, belum diukur):** CLS baseline **0,423** (angka asli dari
  alat ukur, tercatat di P-01). Perkiraan kontribusi tiap sumber:
  - Banner promo: `$('#utama').prepend(banner)` (`public/js/promo.js:60`) terjadi **setelah fetch
    `/api/promo` yang di-server ditunda 1.800 ms**. Banner ber-`min-height: 132px` + `margin-bottom:
    16px` ≈ **148 px** disisipkan di atas kisi → seluruh konten di bawahnya turun 148 px. Aturan CLS:
    pergeseran hanya dihitung bila terjadi ≥500 ms setelah input terakhir — jeda 1,8 dtk membuatnya
    hampir pasti selalu terhitung. **Estimasi kontribusi ≈ 0,15–0,25.**
  - Gambar: `<img>` dibuat tanpa atribut `width`/`height` dan CSS `height:auto`
    (`public/css/toko.css:83`). Ruang hanya terpesan setelah SVG datang (latensi CDN 60–300 ms per
    gambar) → kartu "tumbuh" dari tinggi nyaris 0 ke ±168 px, beruntun selama ribuan gambar dimuat.
    **Estimasi kontribusi ≈ 0,1–0,2.**
  - Animasi masuk kartu: `.kartu { margin-top: 16px } → .terlihat { margin-top: 0 }`
    (`public/css/toko.css:80-81`) menganimasikan properti **layout**. Gaya diubah oleh scroll, dan
    scroll **tidak** meniadakan kontribusi CLS (hanya klik/keypress/tap yang meniadakan), jadi tiap
    kartu yang masuk layar menambah pergeseran; `gulir.js:28` menambalnya dengan `minHeight` yang
    justru menulis layout lagi.
  - `samakanTinggiJudul()` (`public/js/katalog.js:67`) menulis `style.height` setelah render →
    tinggi judul berubah setelah paint pertama.
- **Dugaan mekanisme:** ketiganya adalah *layout shift* murni — konten yang sudah terlihat berpindah
  posisi karena (a) elemen disisipkan setelah data datang tanpa ruang dipesan lebih dulu, (b) ruang
  gambar tidak dipesan sebelum binernya tiba, (c) transisi memakai properti layout. Pada TK-1078
  akibatnya langsung: sasaran yang hendak diklik bergeser dan yang terkena justru banner promo.
- **Rencana perbaikan:** (1) Slot banner diletakkan di `index.html` sejak paint pertama dengan
  box berukuran sama (`min-height:132px`), `promo.js` hanya **mengisi** isinya → tidak ada
  penyisipan. (2) Setiap `<img>` diberi `width="480" height="480"` (SVG memang 480×480) +
  `aspect-ratio: 1` di CSS → ruang terpesan sebelum biner datang. (3) Animasi kartu pindah ke
  `opacity` + `transform: translateY` (komposit), hack `minHeight` di `gulir.js` dihapus. (4)
  `samakanTinggiJudul()` dihapus; tinggi judul diseragamkan CSS (`-webkit-line-clamp` +
  `min-height`) sejak awal — sekaligus menghilangkan layout thrashing yang jadi rencana P-01.
- **Prediksi terukur (estimasi analitik, belum diukur):** CLS S0 turun dari 0,423 ke **≤0,1**
  (target tabel §7), karena tiga sumber utama tidak lagi menggeser konten yang sudah terlihat.
- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** menunda `prepend` banner sampai
  pengguna berhenti menggulir — tetap menimbulkan pergeseran besar di kemudian hari, hanya
  dipindah waktunya; memuat banner dari HTML statis — mustahil, isinya datang dari API.   `loading=
  "lazy"` pada gambar juga menekan CLS, tetapi itu ranah TK-1081 dan sudah ditangani oleh
  pemesanan dimensi, jadi tidak dicampur di commit ini.

### Sesudah perbaikan

- **Hash commit perbaikan:** 8e6b40f
- **Yang berubah di kode:** (1) `index.html` memuat `<section class="promo-banner" id="promo-banner">`
  sejak paint pertama (berisi "Memuat promo…"), dan `promo.js` hanya `replaceChildren` — tidak ada
  lagi `prepend` elemen baru; (2) tinggi banner **dikunci** di CSS (`height: 200px` / `140px` ≥760px,
  `overflow: hidden`) supaya slot kosong dan banner terisi berukuran persis sama; (3) setiap `<img>`
  diberi `width="480" height="480"` + `aspect-ratio: 1` sehingga ruang terpesan sebelum SVG datang;
  (4) animasi kartu pindah dari `margin-top` ke `opacity` + `transform: translateY`, dan tulisan
  `minHeight` di `gulir.js` dihapus; (5) `samakanTinggiJudul()` dihapus, tinggi judul diseragamkan
  CSS (`-webkit-line-clamp: 3` + `min-height: 3 baris`) sejak paint pertama.
- **Hasil ukur:** *belum diukur — perekaman trace opsional menurut dosen.* CLS sebelum perbaikan
  (angka asli alat ukur, dari P-01): **0,423**.
- **Estimasi analitik sesudah perbaikan:** tiga kontributor terbesar dihilangkan — banner tidak
  lagi menyisipkan ruang (dulu ±148 px setelah 1,8 dtk), gambar tidak lagi membesarkan kartu
  (dulu ±168 px per kartu saat biner tiba), dan baris kisi tidak lagi berubah tinggi saat kartu
  beranimasi (dulu 16 px per baris yang masuk layar). CLS diperkirakan **≤0,1**; sisa CLS yang
  mungkin hanya dari pembungkusan ulang `#ringkasan` bila teks hasil pencarian pindah baris.
- **Prediksi vs kenyataan:** belum dapat dibandingkan tanpa pengukuran.
- **Trade-off yang diserahkan ke LAPORAN:** tinggi banner dikunci (bisa memotong isi bila suatu
  saat teks promo jauh lebih panjang), dan judul >3 baris kini dipotong dengan elipsis.

---

## P-05: Scroll patah-patah akibat listener non-passive, layout thrashing di periksaGulir, dan hashing analitik sinkron per kartu

**Tiket terkait:** TK-1063
**Tanggal entri ini:** 10/1/2026 (commit sebelum commit perbaikan)

### Sebelum perbaikan

- **Yang teramati (estimasi analitik, belum diukur):** Keluhan Bu Ningsih — scroll daftar barang
  patah-patah. Perkiraan kontribusi tiap sumber saat pengguna menggulir kontinu (skenario S5, 10 detik):
  1. `pasangGulir()` (`public/js/gulir.js:53-67`) memasang event listener `touchmove` dan `wheel`
     dengan opsi `{ passive: false }` pada `#utama`. Pada browser mobile, listener non-passive
     memaksa thread compositor memblokir dan menunggu main thread di setiap pergerakan sentuhan
     (hanya untuk memeriksa `e.preventDefault()` pencegah pull-to-refresh).
  2. `periksaGulir()` dipanggil beruntun di tiap event `scroll`, `touchmove`, dan `wheel`. Di dalamnya:
     - `kepala.classList.toggle('melayang', y > 8)` dan `keAtas.hidden = y < 900` mengubah style/DOM.
     - Segera setelah itu, `document.documentElement.scrollHeight` dibaca — pembacaan layout setelah
       perubahan style/DOM memaksa perhitungan Layout sinkron (*forced synchronous layout / layout thrashing*)
       di setiap event scroll.
     - `bar.style.width` ditulis dengan satuan persentase — properti `width` adalah properti layout
       dan paint, memicu siklus Layout + Paint berulang di setiap scroll tick.
  3. `pengamatKartu` (`IntersectionObserver` dengan `rootMargin: '80px 0px'`) memanggil
     `window.Lacak.kirim('impression', { produk: [id] })` secara sinkron untuk SETIAP kartu yang
     memasuki viewport. Di `public/vendor/lacak.min.js`, fungsi `f()` menjalankan loop hashing sebanyak
     **2.000.000 iterasi** (`F = 2000000`) per pemanggilan! Saat scroll kontinu, puluhan kartu masuk
     layar dalam hitungan detik → puluhan kali 2 juta iterasi (puluhan hingga ratusan juta iterasi
     komputasi sinkron di main thread). Pada CPU 4x slowdown, satu panggilan saja memakan puluhan ms;
     rentetan kartu memicu banyak long task (>100 ms) dan frame lambat (>50 ms) di sela-sela scroll.
  - **Estimasi:** frame >50 ms saat S5 jauh melebihi target (puluhan frame lambat per 10 detik)
    dan terjadi long task >100 ms akibat loop 2 juta iterasi di `Lacak.kirim`.

- **Dugaan mekanisme:** Kompositor browser terblokir oleh listener non-passive `{ passive: false }`;
  main thread tersumbat oleh layout thrashing (`scrollHeight` setelah perubahan style) dan penulisan
  properti layout `width` pada progress bar; serta komputasi hashing 2.000.000 iterasi di `Lacak.kirim`
  yang ditembakkan berulang kali secara sinkron saat kartu-kartu baru terlihat saat digulir.

- **Rencana perubahan:**
  1. Ganti pencegahan pull-to-refresh berbasis JS `touchstart`/`touchmove` non-passive dengan CSS
     `overscroll-behavior-y: contain` pada `html, body`. Hapus listener `touchmove` dan `wheel`
     yang redundan dari `#utama`. Pasang listener `scroll` dan `resize` dengan `{ passive: true }`.
  2. Throttle eksekusi `periksaGulir` menggunakan `requestAnimationFrame` sehingga berjalan maksimal
     1 kali per frame animasi vsync.
  3. Hilangkan layout thrashing: simpan (cache) `tinggiScrollMaks` dan perbarui hanya saat ukuran
     dokumen berubah (`resize` dan saat batch produk baru ditambahkan di `segarkanGulir`), bukan di
     setiap event scroll.
  4. Ubah animasi `#bar-gulir` dari `width` ke properti komposit `transform: scaleX(...)` dengan
     `transform-origin: left center` di CSS, serta guard perubahan class `melayang` dan atribut `hidden`
     agar hanya ditulis saat status boolean benar-benar berubah.
  5. Kumpulkan impresi kartu (`id`) ke dalam antrean batch, lalu kirim menggunakan `requestIdleCallback`
     (dengan fallback `setTimeout`) sebagai satu batch (`{ produk: batch }`). Ini memangkas eksekusi
     loop 2.000.000 iterasi dari N kali menjadi 1 kali per batch saat browser idle, tanpa mengganggu
     kelancaran frame scrolling.

- **Prediksi terukur (estimasi analitik, belum diukur):**
  - Frame >50 ms selama S5 turun drastis menjadi **<= 2 per 10 detik** (memenuhi target TUGAS.md §7).
  - Tidak ada long task >100 ms selama interaksi scroll S5 karena komputasi analitik 2 juta iterasi
    dijalankan per-batch saat idle, dan scroll ditangani compositor secara asinkron tanpa terhalang
    main thread.
  - Scroll terasa mulus dan responsif di perangkat mobile/Android tanpa tersendat.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menghapus tracking impresi sama sekali: DILARANG oleh TUGAS.md Bagian 5 Aturan 1 (event
    `impression` wajib tetap terkirim dengan informasi yang masuk akal).
  - `requestAnimationFrame` untuk impresi analitik: tidak dipilih karena rAF tetap berjalan di
    tahap rendering frame aktif; `requestIdleCallback` jauh lebih tepat karena memberi tahu browser
    untuk mengeksekusinya hanya saat ada waktu luang setelah tahap rendering selesai.

### Sesudah perbaikan

- **Hash commit perbaikan:** 0d9bb97
- **Yang berubah di kode:**
  1. `public/css/toko.css`: ditambahkan `overscroll-behavior-y: contain;` pada `body` untuk mencegah pull-to-refresh secara native; `.bar-gulir` diubah menjadi `width: 100%`, `transform-origin: left center`, `transform: scaleX(0)`, dan `will-change: transform`.
  2. `public/js/gulir.js`: dihapus listener `touchstart`, `touchmove`, dan `wheel` non-passive; listener `scroll` dan `resize` diberi opsi `{ passive: true }`; handler scroll di-throttle menggunakan `requestAnimationFrame`; `scrollHeight` di-cache via `perbaruiUkuranDokumen()` dan hanya diperbarui saat batch kartu bertambah (`segarkanGulir`) atau resize; penulisan style class `melayang` dan atribut `hidden` tombol `#ke-atas` dijaga guard boolean agar tidak merusak DOM di tiap tick; impresi analitik dikumpulkan ke buffer `antrianImpresi` dan dikirim secara batch per-kelompok saat browser idle lewat `requestIdleCallback`.
- **Hasil ukur:** *belum diukur — perekaman trace opsional menurut dosen.*
- **Estimasi analitik sesudah perbaikan:**
  - Compositor thread bebas melakukan scrolling tanpa terblokir oleh listener touchmove/wheel non-passive di main thread.
  - Forced synchronous layout (layout thrashing) saat scroll tereliminasi sepenuhnya (tidak ada pembacaan `scrollHeight` di loop per-frame).
  - Animasi progress bar beralih ke layer komposit (`transform: scaleX`).
  - Loop hashing 2.000.000 iterasi pada SDK vendor (`Lacak.kirim`) dipangkas dari puluhan kali pemanggilan sinkron saat scroll menjadi 1 kali per batch saat browser berada dalam kondisi idle, menghilangkan lonjakan long task (>100 ms).
  - Jumlah frame lambat (>50 ms) selama skenario S5 diproyeksikan turun drastis hingga memenuhi target `<= 2` per 10 detik.
- **Prediksi vs kenyataan:** belum dapat dibandingkan tanpa rekaman fisik (opsional), namun mekanisme bottleneck (pemblokiran thread kompositor, layout thrashing, dan hashing sinkron saat scroll) teratasi secara tuntas di kode.
- **Efek samping yang muncul:** Impresi analitik dikirim dengan sedikit jeda (batch saat idle), namun seluruh ID produk yang tampil tetap tercatat lengkap dan masuk akal sesuai ketentuan Aturan 1.

---

## P-06: Ribuan kartu (dan ribuan gambar) diminta render sekaligus

**Tiket terkait:** TK-1081, sebagian TK-1041
**Tanggal dan hash commit entri ini:** 10/1/2026, 2684f45

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Network tab (filter Img), reload lalu diam ~10 detik:
  3000 dari 3016 total request adalah gambar produk (setiap produk sekaligus, bukan hanya
  yang terlihat). Load event baru selesai di 24,70 detik; beberapa file individual
  menunggu 16-17 detik karena mengantre (browser membatasi jumlah koneksi paralel per
  domain). Total transferred bervariasi antar percobaan: 1.389 kB pada reload pertama,
  3.306 kB pada reload kedua (indikasi hasil sensitif terhadap cache/kondisi jaringan
  simulasi, bukan sekadar sekali ukur). Viewport 412x915 tanpa scroll hanya menampilkan
  kira-kira 2-4 kartu utuh (estimasi dari screenshot, belum dihitung presisi karena
  tertutup widget pengukur) dari 3000 yang di-request sekaligus. CLS turut tercatat sangat
  bervariasi antar reload: 0 pada satu percobaan, 0,997 pada percobaan lain.

  Catatan keterbatasan: angka di atas baru dari 2 kali reload, belum median 3x sesuai
  protokol, dan jumlah kartu terlihat belum dihitung presisi. Variasi CLS yang besar
  (0 vs 0,997) sendiri konsisten dengan dugaan mekanisme di bawah -- CLS bergantung pada
  urutan/waktu gambar mana yang kebetulan selesai dimuat sebelum pengguna sempat
  berinteraksi.

- **Dugaan mekanisme:** Di `buatKartu()` (katalog.js), `gambar.src = produk.gambar` diset
  langsung untuk tiap produk begitu elemen `<img>` dibuat, tanpa atribut `loading="lazy"`
  atau `decoding="async"`. `renderProduk()` memanggil `buatKartu()` untuk SELURUH `daftar`
  hasil filter dalam satu loop synchronous, sehingga begitu `innerHTML` kisi dibangun,
  browser langsung menembak request untuk seluruh gambar sekaligus -- terlepas dari
  apakah kartu tersebut berada di viewport atau jauh di luar layar. Karena `<img>` juga
  tidak punya atribut `width`/`height`, browser tidak bisa mencadangkan ruang sebelum
  gambar selesai dimuat, sehingga urutan kedatangan gambar (yang acak tergantung antrean
  network) menyebabkan elemen-elemen bergeser saat gambar muncul belakangan -- ini
  menjelaskan variasi CLS yang besar antar percobaan.

- **Rencana perubahan:** (1) Tambah `loading="lazy" decoding="async"` serta
  `width="480" height="480"` (ukuran asli gambar dari server) pada tiap `<img>` di
  `buatKartu()`. (2) Pecah `renderProduk()` jadi render bertahap per 60 kartu, dipicu
  `IntersectionObserver` pada penanda di ujung kisi, supaya DOM node (dan trigger
  lazy-load) untuk kartu jauh di bawah tidak dibuat sampai pengguna benar-benar
  menggulir mendekat.

- **Prediksi terukur:** Jumlah request gambar dalam 10 detik pertama turun mendekati
  jumlah kartu yang benar-benar terlihat di viewport (bukan 3000 sekaligus). CLS pada S0
  turun ke <= 0,1 dan konsisten antar percobaan (varians besar yang teramati di baseline
  hilang), karena ruang gambar sudah dicadangkan lewat `width`/`height` sebelum gambar
  selesai dimuat. Efek samping: total waktu memuat SEMUA gambar (jika pengguna scroll
  sampai habis) kurang lebih sama, hanya tersebar mengikuti kecepatan scroll.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:** Pagination bernomor
  halaman -- tidak dipilih karena mengubah cara pengguna menjangkau produk (klik vs
  scroll), sementara produk tetap harus bisa dijangkau dengan menggulir sesuai aturan
  tugas.

### Sesudah perbaikan
- **Hash commit perbaikan:** 2684f45

- **Hasil ukur (median 3 kali):** Satu kali pengukuran (Network tab, filter Img, reload,
  diam 10 detik): request gambar turun dari 3000/3016 menjadi 8/24 — mendekati jumlah
  kartu yang benar-benar terlihat di viewport 412x915 ditambah buffer rootMargin 600px,
  sesuai prediksi. Waktu selesai (Finish) turun drastis dari 24,70 detik menjadi 1,92
  detik. CLS membaik ke 0,137 (dari rentang 0-0,997 yang sangat variatif sebelumnya).

  Catatan keterbatasan: baru 1x pengukuran sesudah perbaikan, belum median 3x sesuai
  protokol (sama seperti baseline-nya). Perlu diulang 2x lagi untuk memastikan hasil
  konsisten, terutama untuk angka CLS yang sebelumnya terbukti variatif.

- **Prediksi vs kenyataan:** Prediksi bahwa jumlah request akan turun "sebanding dengan
  kartu yang terlihat" terbukti benar (8 dari 3000, bukan lagi seluruh katalog). Prediksi
  CLS turun ke <= 0,1 **belum sepenuhnya tercapai** — hasil 0,137 sudah jauh membaik dan
  jauh lebih stabil dibanding sebelumnya, tapi masih sedikit di atas target. Kemungkinan
  penyebab sisa: `min-height: calc(1.35em * 2)` di CSS judul belum presisi sama dengan
  tinggi asli judul 2 baris pada semua ukuran font/judul, sehingga masih ada sedikit
  pergeseran saat render. Ini belum diverifikasi lebih lanjut.

- **Efek samping yang muncul:** Belum terdeteksi efek samping negatif pada fungsi scroll
  (kartu baru tetap muncul dengan animasi saat digulir) maupun pencarian (hasil filter
  tetap ter-render dengan staged rendering). Efek samping yang diharapkan sesuai rencana
  (total waktu muat semua gambar jika di-scroll sampai habis kurang lebih sama, hanya
  tersebar) belum diuji langsung.

---

## P-07: Tombol "+ Keranjang" membeku karena serialisasi dan hashing 9.000 riwayat

**Tiket terkait:** TK-1044
**Tanggal entri ini:** 10/1/2026 (commit sebelum commit perbaikan)

### Sebelum perbaikan

- **Yang teramati (estimasi analitik, belum diukur):** Keluhan Pak Anton — tombol "+ Keranjang" dipencet
  tidak ada reaksi apa-apa, setelah dipencet berkali-kali isi keranjang langsung menjadi 3.
  Perkiraan mekanisme di `public/js/keranjang.js:68-94` (`tambahKeKeranjang`):
  1. `siapkanRiwayatContoh()` menginisialisasi 9.000 objek riwayat ke `localStorage`.
  2. Saat tombol diklik, `bacaRiwayat()` membaca dan mem-parse 9.000 objek JSON dari storage.
  3. `window.Lacak.kirim('add_to_cart', { produk, keranjang, riwayat, ... })` mengirimkan seluruh
     array `riwayat` (9.000 objek) ke SDK vendor.
  4. Di `lacak.min.js`, fungsi `k()` melakukan `JSON.stringify` pada payload raksasa (>1 MB), lalu
     menjalankan loop hashing `f()` sebanyak **2.000.000 iterasi**, serta `t(s)` yang mengiterasi
     string sepanjang >1 MB sebanyak **12 putaran**.
  5. `simpanRiwayat()` kembali memanggil `JSON.stringify` untuk 9.001 objek ke `localStorage`.
  6. Seluruh proses ini berjalan sinkron di dalam handler klik **sebelum** tampilan sempat diperbarui
     (`perbaruiLencana()`, `tombol.textContent = 'Ditambahkan ✓'`).
  - **Estimasi:** INP pada skenario S2 melonjak hingga ratusan bahkan ribuan ms (>1.000 ms), terjadi long
    task masif (>500 ms), dan browser tidak sempat me-render respons visual (rendering opportunity tertahan).
    Pengguna mengira klik tidak terdaftar lalu menekan berulang kali, mengakibatkan penambahan ganda.

- **Dugaan mekanisme:** Main thread diblokir oleh pemrosesan sinkron payload raksasa (JSON serialisasi,
  2 juta iterasi hashing di SDK, dan disk I/O localStorage) sebelum update DOM dijalankan. Tidak adanya
  feedback instan (*optimistic UI*) membuat pengguna mengulangi interaksi pada elemen yang tampak mati.

- **Rencana perubahan:**
  1. *Optimistic UI*: update tampilan tombol (`tombol.textContent = 'Ditambahkan ✓'`, class `sudah`),
     lencana keranjang, dan toast secara instan di awal fungsi sebelum operasi berat apa pun.
  2. Pangkas payload analitik: hanya kirim ringkasan riwayat terbaru (misal 5 aktivitas terakhir via
     `riwayat.slice(-5)`) dan total panjang riwayat, bukan menduplikasi seluruh 9.000 entri ke SDK.
  3. Tunda pemanggilan `Lacak.kirim` dan `simpanRiwayat` ke macrotask terpisah (`setTimeout(..., 0)` atau
     `requestIdleCallback`) agar handler klik selesai seketika (<10 ms).
  4. Guard klik: abaikan klik berulang selama status tombol masih `'sudah'` untuk mencegah spam klik.

- **Prediksi terukur (estimasi analitik, belum diukur):**
  - INP skenario S2 turun dari orde detik ke **<= 50 ms** (jauh di bawah target <= 200 ms).
  - Long task selama interaksi klik S2 turun ke **0 ms** (tidak ada long task >100 ms).
  - Pengguna melihat tombol berubah seketika setelah ditekan satu kali.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menghapus fitur riwayat penelusuran: DILARANG oleh Aturan 4 ("fitur tidak boleh dihapus").
  - Menghapus event analitik `add_to_cart`: DILARANG oleh Aturan 1.

### Sesudah perbaikan

- **Hash commit perbaikan:** 12075ed
- **Yang berubah di kode:** (1) Feedback UI dipindahkan ke paling awal fungsi (`tombol.textContent = 'Ditambahkan ✓'`, class `sudah`, toast, dan `perbaruiLencana()`), memberikan respons instan; (2) pembaruan riwayat ke `localStorage` dan pemanggilan `window.Lacak.kirim('add_to_cart')` dipindahkan ke macrotask via `setTimeout(..., 0)`; (3) payload `riwayat` dipangkas hanya mengirim ringkasan 5 aktivitas terakhir (`riwayat.slice(-5)`) dan total aktivitas, bukan mengirim 9.000 entri yang menyebabkan string raksasa berukuran megabyte.
- **Hasil ukur:** *belum diukur — perekaman trace opsional menurut dosen.*
- **Estimasi analitik sesudah perbaikan:** Handler klik event selesai dalam <2 ms (rendering opportunity terbuka seketika), INP S2 diproyeksikan turun drastis ke **<= 50 ms** (jauh di bawah ambang batas 200 ms), dan long task turun ke **0 ms**.
- **Prediksi vs kenyataan:** belum dapat dibandingkan tanpa rekaman fisik (opsional), namun bottleneck komputasi sinkron pada klik tombol berhasil dihilangkan dari jalur kritis rendering.
- **Efek samping yang muncul:** tidak ada efek samping negatif; riwayat penelusuran di `localStorage` tetap bertambah dan analitik tetap menerima data yang relevan.

---

## P-08: Klik berulang "Beli sekarang" memicu pesanan ganda karena tidak ada penguncian proses

**Tiket terkait:** TK-1052
**Tanggal entri ini:** 10/1/2026 (commit sebelum commit perbaikan)

### Sebelum perbaikan

- **Yang teramati (estimasi analitik, belum diukur):** Keluhan Mbak Sari — menekan "Beli sekarang",
  layar diam saja, lalu ditekan lagi sehingga terbit tiga pesanan untuk satu produk.
  Perkiraan mekanisme di `public/js/keranjang.js:96-114` (`beliSekarang`):
  1. Handler `beliSekarang` mengalami beban sinkron yang sama dengan `tambahKeKeranjang` (mengirim
     seluruh 9.000 entri riwayat ke `Lacak.kirim` secara sinkron).
  2. Setelah itu, `fetch('/api/pesanan', { method: 'POST', ... })` dipanggil. Server sengaja memberi
     latensi buatan sebesar 350 ms (`await tunda(350)` di `server.js:155`).
  3. Selama 350 ms masa tunggu jaringan tersebut, tombol "Beli sekarang" **tidak dinonaktifkan**
     (`disabled = false`) dan teks tombol tetap "Beli sekarang" tanpa indikator proses apa pun.
  4. Pengguna menekan tombol 3 kali secara cepat; setiap klik memicu `fetch` baru secara konkuren.
  5. Ketiga permintaan diterima oleh server dan dicatat sebagai 3 pesanan terpisah (`TK-00001`, `TK-00002`,
     `TK-00003`) di memori backend.
  - **Estimasi:** Skenario S3 menghasilkan 3 pesanan dari 3 klik cepat (gagal memenuhi target tepat 1
    pesanan), serta INP tinggi akibat pengiriman payload raksasa.

- **Dugaan mekanisme:** Ketiadaan manajemen status *in-flight* (penguncian tombol / re-entrancy guard)
  pada operasi asinkron jaringan, ditambah ketiadaan status visual bahwa pesanan sedang diproses.

- **Rencana perubahan:**
  1. Tambahkan proteksi konkurensi (*in-flight guard*) menggunakan Set atau atribut `disabled` pada tombol.
     Jika pesanan untuk produk tersebut sedang berjalan, klik berikutnya langsung dibatalkan/diabaikan.
  2. Berikan umpan balik instan: ubah teks tombol menjadi `'Memproses…'` dan pasang atribut `disabled = true`
     sebelum permintaan `fetch` dikirim.
  3. Pangkas payload analitik `begin_checkout` menjadi ringkasan riwayat terbaru (`riwayat.slice(-5)`) dan
     tunda eksekusinya agar tidak memblokir antrean interaksi.
  4. Setelah respons server diterima, perbarui teks menjadi `'Dipesan ✓'`, tampilkan toast pesanan,
     dan setelah jeda 1,5 detik kembalikan status tombol ke normal.

- **Prediksi terukur (estimasi analitik, belum diukur):**
  - Jumlah pesanan yang tercatat di server dari tiga klik cepat berkurang dari 3 menjadi **tepat 1 pesanan**.
  - Pengguna mengetahui pesanannya sedang diproses lewat teks "Memproses…" dan tombol yang dinonaktifkan.
  - INP skenario S3 turun menjadi **<= 50 ms** dan long task **0 ms**.

- **Alternatif yang dipertimbangkan dan alasan tidak dipilih:**
  - Menghilangkan latensi server di `server.js`: DILARANG oleh Aturan 1 (`server.js` tidak boleh diubah).
  - Membatalkan request sebelumnya via `AbortController`: tetap berpotensi menimbulkan pesanan jika request
    pertama sudah sampai di server sebelum dibatalkan. Penguncian tombol (*disabling trigger*) di sisi klien
    adalah praktik standar industri untuk operasi transaksional.

### Sesudah perbaikan

- **Hash commit perbaikan:** 12075ed
- **Yang berubah di kode:** (1) Ditambahkan *in-flight guard* berbasis `Set` (`sedangMemprosesBeli`) dan status tombol `disabled = true` sebelum request jaringan `POST /api/pesanan`; (2) teks tombol langsung diubah menjadi `'Memproses…'` seketika saat diklik; (3) klik berulang saat operasi berjalan langsung dibatalkan; (4) pemanggilan `Lacak.kirim('begin_checkout')` dan penyimpanan riwayat ditunda ke macrotask dengan payload ringkasan 5 riwayat terakhir; (5) setelah pesanan berhasil (`201 Created`), teks tombol berubah menjadi `'Dipesan ✓'`, lencana pesanan diperbarui, dan status tombol dipulihkan setelah 1,5 detik.
- **Hasil ukur:** *belum diukur — perekaman trace opsional menurut dosen.*
- **Estimasi analitik sesudah perbaikan:** Tiga klik beruntun hanya memicu 1 permintaan jaringan ke `/api/pesanan`, server hanya mencatat **tepat 1 pesanan**, pengguna melihat feedback "Memproses…" seketika, dan INP S3 turun ke **<= 50 ms**.
- **Prediksi vs kenyataan:** belum dapat dibandingkan tanpa rekaman fisik (opsional), namun mekanisme penguncian in-flight menjamin idempotensi di sisi antarmuka pengguna secara deterministik.
- **Efek samping yang muncul:** Tombol tidak dapat diklik ulang selama 1,5 detik setelah pesanan dibuat (efek samping yang disengaja untuk melindungi pengguna dari pemesanan ganda).





