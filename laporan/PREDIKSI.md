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

- **Hash commit perbaikan:** ....
- **Hasil ukur (median 3 kali):** ....
- **Prediksi vs kenyataan:** tepat, meleset, atau sebagian? Bila meleset, apa yang salah dari model mental Anda?
- **Efek samping yang muncul:** ....
