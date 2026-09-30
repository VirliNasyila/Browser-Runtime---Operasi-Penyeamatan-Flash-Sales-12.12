# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: claude/gemini dll
Branch atau commit tempat usulan diterapkan: https://github.com/VirliNasyila/Browser-Runtime---Operasi-Penyeamatan-Flash-Sales-12.12


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

## Refleksi (maks. 200 kata)
AI paling membantu dalam **eksekusi sintaksis dan implementasi teknis cepat**, seperti membuat boilerplate fungsi *debounce*, menyusun struktur *IntersectionObserver*, atau mengubah manipulasi DOM manual menjadi aturan CSS (`-webkit-line-clamp`). AI sangat mempercepat proses *refactoring* begitu strategi perbaikan sudah ditentukan oleh developer.

Area yang paling memerlukan **kewaspadaan tinggi** adalah **diagnosis performa *runtime* dan penentuan akar masalah**. AI membaca kode secara statis, sehingga tidak memiliki visibilitas terhadap perilaku *browser rendering engine*, *layout thrashing*, maupun kemacetan antrean *task* pada *main thread*. Tanpa data *profiling/trace*, AI cenderung memberikan perbaikan di permukaan (seperti sekadar menambah *debounce*) yang mengurangi frekuensi lag tetapi membiarkan *long task* berat tetap terjadi. Oleh karena itu, analisis metrik nyata dan pengujian *trace* independen tetap sepenuhnya menjadi tanggung jawab developer.

