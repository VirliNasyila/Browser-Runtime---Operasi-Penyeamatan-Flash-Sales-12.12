# Log prediksi

Aturan: satu entri per masalah. Bagian **Sebelum perbaikan** harus di-commit *sebelum* commit
perbaikannya. Bagian **Sesudah perbaikan** diisi setelah pengukuran ulang. Jangan menyunting
bagian "sebelum" setelah hasilnya diketahui; bila prediksi meleset, jelaskan di bagian "sesudah".

---

## P-01: [judul singkat masalah]

**Tiket terkait:** TK-1041
**Tanggal dan hash commit entri ini:** 9/30/2026

### Sebelum perbaikan

- **Yang teramati di trace (baseline):** Widget ?ukur=1 mencatat saat mengetik "sepatu": INP 15848ms (interaksi terburuk berupa pointerdown), dengan tundaInput naik dari 6531ms→12635ms pada keystroke-keystroke berikutnya, menunjukkan antrean task menumpuk karena tiap huruf memicu kerja sinkron sebelum huruf sebelumnya selesai diproses. Long task terlama 9368ms. CLS 0.423. Total blokir 17074ms dari 2 long task.
track Scripting vs
  Rendering, fungsi dominan di bottom-up summary (harusnya `terapkanSaringan`/`renderProduk`/
  `samakanTinggiJudul`)
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
> entri P-01 berasal dari alat ukur `?ukur=1` (pengukuran nyata). Seluruh angka pada entri P-02,
> P-03, dan P-04 adalah **estimasi analitik yang belum diukur**, dihitung dari mekanisme kode
> (jumlah produk × iterasi × sifat antrean tugas), bukan hasil rekaman.

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
  dipindah waktunya; memuat banner dari HTML statis — mustahil, isinya datang dari API. `loading=
  "lazy"` pada gambar juga menekan CLS, tetapi itu ranah TK-1081 dan sudah ditangani oleh
  pemesanan dimensi, jadi tidak dicampur di commit ini.
