# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: opencode (agent coding, model mimo-v2.6-flash) — A-02 dan A-03.
A-01 memakai AI percakapan (dikerjakan tim).
Branch atau commit tempat usulan diterapkan: https://github.com/VirliNasyila/Browser-Runtime---Operasi-Penyeamatan-Flash-Sales-12.12
Catatan A-02/A-03: usulan **tidak diterapkan ke `main`** — keduanya diuji lewat analisis kode terhadap
berkas yang sama dan diverifikasi tidak memenuhi target/melanggar aturan main (lihat butir "Bukti").
Pengukuran trace tidak dilakukan (opsional menurut dosen), sehingga bukti berupa kode + CLS alat ukur.


---

## A-01: [Debounce pencarian tanpa menyentuh layout thrashing]

- **Tiket yang diminta diperbaiki:** TK-1041
- **Prompt yang diberikan (ringkas):** "Kolom pencarian di TokoKilat lag sekali tiap kali mengetik,tolong perbaiki."
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):** 
// hanya menambahkan debounce di sekitar pemanggilan lama, tanpa mengubah apa pun di dalam renderProduk()/samakanTinggiJudul()

  let waktu;
  kolom.addEventListener('input', () => {
    saringan.kata = kolom.value;
    clearTimeout(waktu);
    waktu = setTimeout(terapkanSaringan, 300);
  });

- **Jenis masalah pada usulan:** pilih satu atau lebih
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** angka sebelum dan sesudah usulan AI diterapkan.
sebelum usulan AI 
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

setelah usulan AI
{
  "waktu": "2026-09-30T12:41:26.157Z",
  "jumlahLongTask": 0,
  "longTaskTerlama": 0,
  "totalBlokir": 0,
  "jumlahInteraksi": 8,
  "inp": 48,
  "inpRinci": {
    "durasi": 48,
    "jenis": "pointerdown",
    "target": "?",
    "tundaInput": 2,
    "proses": 0,
    "presentasi": 46
  },
  "limaInteraksiTerlambat": [
    {
      "durasi": 48,
      "jenis": "pointerdown",
      "target": "?",
      "tundaInput": 2,
      "proses": 0,
      "presentasi": 46
    },
    {
      "durasi": 48,
      "jenis": "keyup",
      "target": "#kolom-cari",
      "tundaInput": 0,
      "proses": 0,
      "presentasi": 48
    },
    {
      "durasi": 48,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 0,
      "proses": 0,
      "presentasi": 48
    },
    {
      "durasi": 40,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 1,
      "proses": 0,
      "presentasi": 39
    },
    {
      "durasi": 40,
      "jenis": "keydown",
      "target": "#kolom-cari",
      "tundaInput": 0,
      "proses": 0,
      "presentasi": 40
    }
  ],
  "cls": 0.059,
  "frameLambat": 0,
  "frameTerburuk": 0
}
- **Mengapa AI bisa keliru di sini:** AI hanya diberi gejala ("lag saat mengetik"), bukan trace. Dari
  kode saja, debounce terlihat seperti perbaikan yang benar dan memang MENGURANGI gejala (tidak ada
  lagi kerja di setiap huruf) -- tapi AI tidak tahu bahwa `samakanTinggiJudul` di dalam `renderProduk`
  punya masalah tersendiri (layout thrashing) yang independen dari seberapa sering fungsi itu
  dipanggil. AI membaca kode secara statis; ia tidak bisa melihat bahwa satu pemanggilan `renderProduk`
  pada hasil besar tetap menghasilkan satu long task, karena itu hanya kelihatan di *trace* eksekusi
  sungguhan, bukan di kode.
- **Perbaikan yang benar menurut tim:** Debounce tetap diperlukan (dipakai juga di P-01), TAPI harus
  digabung dengan menghilangkan layout thrashing (ganti ke CSS line-clamp) dan memecah render jadi
  bertahap -- lihat PREDIKSI.md P-01.

---

## A-02: requestAnimationFrame untuk hitung mundur & teks berjalan (TK-1070)

- **Tiket yang diminta diperbaiki:** TK-1070 ("baru buka 5 menit HP sudah panas")
- **Prompt yang diberikan (ringkas):** "Halaman flash sale ini bikin HP panas walau cuma dibuka
  diam-diam, tolong bikin lebih hemat baterai tanpa menghapus hitung mundur dan teks berjalan."
- **Usulan AI (ringkas):**
  ```js
  // ganti setInterval(10ms) dengan rAF supaya sinkron dengan refresh rate layar
  let x = teks.parentElement.offsetWidth;
  function gambar() {
    x -= 1;
    if (x < -teks.offsetWidth) x = teks.parentElement.offsetWidth;
    teks.style.left = x + 'px';
    requestAnimationFrame(gambar);
  }
  requestAnimationFrame(gambar);
  ```
  hitung mundur juga dipindah ke rAF dengan pembacaan `offsetWidth` yang sama.
- **Jenis masalah pada usulan:**
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [x] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [x] Memperbaiki sesuatu yang tidak berpengaruh memadai
  - [ ] Menimbulkan regresi
  - [ ] Melanggar aturan main
- **Bukti (analisis kode, tanpa trace — lihat LAPORAN §2):** rAF hanya memangkas frekuensi dari
  100 ke ~60 tick/dtk, tetap **membangunkan main thread setiap frame** dan tetap menjalankan pola
  baca layout (`offsetWidth`) → tulis gaya (`style.left`) di dalam frame yang sama, yaitu persis
  paksaan Layout + Paint yang membuat baterai terbakar. Yang hilang hanya ~40% frekuensi; target
  S6 ("aktivitas main thread saat diam mendekati nol") tetap tidak tercapai karena **setiap frame
  masih memicu kerja di main thread selama pengguna diam**. Selain itu rAF tidak berjalan saat tab
  di latar belakang, jadi teks berjalan bisa berhenti mengikuti jam.
- **Mengapa AI bisa keliru di sini:** AI membaca gejala "timer 10 ms boros" secara lokal dan
  mengenali rAF sebagai pola standar pengganti timer. Ia tidak mengevaluasi *kenapa* callback itu
  mahal (baca layout + tulis gaya → Layout/Paint), sehingga yang dilakukan hanya menukar satu
  mekanisme membangunkan thread dengan mekanisme lain. Tanpa melihat trace idle, perbedaan
  "200 kerja/dtk" vs "60 kerja/dtk" terlihat seperti perbaikan, padahal target menuntut nol.
- **Perbaikan yang benar menurut tim:** animasi dipindah **sepenuhnya ke compositor**
  (`@keyframes` + `transform`/`opacity`): teks berjalan jadi CSS murni (dua salinan identik,
  geser −50% lebar sendiri, nol JavaScript), garis hitung mundur jadi `scaleX` yang hanya ditulis
  1× per detik, denyut badge pakai `transform`. Satu-satunya tugas tersisa adalah 3 penulisan angka
  per detik. Lihat `PREDIKSI.md` P-03 dan LAPORAN T-02.

---

## A-03: loading="lazy" + memindahkan banner untuk CLS (TK-1078)

- **Tiket yang diminta diperbaiki:** TK-1078 ("halaman loncat turun sendiri, yang kepencet iklan")
- **Prompt yang diberikan (ringkas):** "CLS halaman flash sale saya 0,423, tolong perbaiki sampai
  di bawah 0,1."
- **Usulan AI (ringkas):**
  ```js
  // semua gambar dimuat malas supaya tidak ada pergeseran saat load
  document.querySelectorAll('.kartu-media img').forEach((img) => { img.loading = 'lazy'; });
  // banner promo dipindah ke bawah daftar supaya tidak menggeser konten
  document.querySelector('footer').prepend(banner);
  ```
- **Jenis masalah pada usulan:**
  - [x] Salah diagnosis (memperbaiki hal yang bukan penyebab utama)
  - [x] Menimbulkan regresi (fitur, aksesibilitas)
  - [x] Melanggar aturan main
  - [ ] Tidak lengkap
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh
- **Bukti (analisis kode + CLS 0,423 dari alat ukur):**
  1. `loading="lazy"` **tidak mengurangi CLS sama sekali** pada kasus ini — pergeseran terjadi
     karena `<img>` **tidak punya atribut `width`/`height`** sehingga ruang tidak terpesan sebelum
     biner datang; dengan lazy loading, ruang justru baru terisi *lebih lambat* lagi ketika gambar
     masuk viewport. Pemesanan ruang (`width="480" height="480"` + `aspect-ratio`), bukan penundaan
     muat, yang memperbaikinya.
  2. Sumber CLS terbesar bukan gambar sama sekali: `prepend` banner setelah fetch 1.800 ms
     menggeser ±148 px seluruh konten di bawahnya, dan transisi `.kartu` memakai `margin-top`
     (properti layout). Keduanya tidak tersentuh oleh usulan ini.
  3. **Melanggar aturan main #4:** memindahkan banner promo ke kaki halaman menghapus keberadaan
     banner promo yang harus tetap ada; banner juga jadi tidak terlihat sehingga fitur rusak
     secara fungsional walaupun kodenya "masih ada".
- **Mengapa AI bisa keliru di sini:** CLS adalah angka agregat; AI menerjemahkan "CLS tinggi" langsung
  ke penyebab paling terkenal (gambar tanpa dimensi) dan mengaitkannya dengan solusi paling terkenal
  (`loading="lazy"`), tanpa membedakan antara *menunda muat* dan *memesan ruang*. Untuk bagian
  banner, menggeser konten memang menurunkan CLS secara harfiah, sehingga solusi itu terlihat benar
  pada angka tetapi merusak fitur — jenis kesalahan yang hanya terlihat bila aturan produk dibaca.
- **Perbaikan yang benar menurut tim:** (1) slot banner sudah ada di `index.html` sejak paint
  pertama dan `promo.js` hanya mengisinya; (2) tinggi banner dikunci agar slot kosong dan terisi
  identik; (3) `width="480" height="480"` + `aspect-ratio: 1` memesan ruang gambar; (4) animasi
  kartu pindah ke `opacity` + `transform`; (5) `samakanTinggiJudul()` dihapus dan tinggi judul
  diseragamkan CSS. Lihat `PREDIKSI.md` P-04 dan LAPORAN T-03.

---

## Refleksi (maks. 200 kata)
AI paling membantu dalam **eksekusi sintaksis dan implementasi teknis cepat**, seperti membuat boilerplate fungsi *debounce*, menyusun struktur *IntersectionObserver*, atau mengubah manipulasi DOM manual menjadi aturan CSS (`-webkit-line-clamp`). AI sangat mempercepat proses *refactoring* begitu strategi perbaikan sudah ditentukan oleh developer.

Area yang paling memerlukan **kewaspadaan tinggi** adalah **diagnosis performa *runtime* dan penentuan akar masalah**. AI membaca kode secara statis, sehingga tidak memiliki visibilitas terhadap perilaku *browser rendering engine*, *layout thrashing*, maupun kemacetan antrean *task* pada *main thread*. Tanpa data *profiling/trace*, AI cenderung memberikan perbaikan di permukaan (seperti sekadar menambah *debounce*) yang mengurangi frekuensi lag tetapi membiarkan *long task* berat tetap terjadi. Oleh karena itu, analisis metrik nyata dan pengujian *trace* independen tetap sepenuhnya menjadi tanggung jawab developer.

