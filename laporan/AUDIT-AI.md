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
- **Bukti:** angka dan tangkapan layar trace sebelum dan sesudah usulan AI diterapkan.
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
Untuk jenis pekerjaan apa AI paling membantu di tugas ini, dan di mana Anda harus paling waspada?
