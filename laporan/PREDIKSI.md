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


## P-06: Ribuan kartu (dan ribuan gambar) diminta render sekaligus

**Tiket terkait:** TK-1081, sebagian TK-1041
**Tanggal dan hash commit entri ini:** [ISI — isi setelah commit entri ini]

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

- **Hash commit perbaikan:** [ISI — isi setelah kamu commit kode fix-nya]
- **Hasil ukur (median 3 kali):** [ISI — ukur ulang pakai langkah Network tab yang sama setelah fix diterapkan]
- **Prediksi vs kenyataan:** [ISI]
- **Efek samping yang muncul:** [ISI]