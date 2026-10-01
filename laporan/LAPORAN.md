# Laporan audit performa dan interaksi TokoKilat

Anggota:  
1. Faiz Akhsya 241524039
2. Idotoho Reimon Simanjuntak 241524047
3. Virli Nasyila Putri 241524062
Tanggal: 25/09/2026
Panjang maksimal setara 6 halaman (tidak termasuk lampiran gambar).

## 1. Ringkasan eksekutif (maks. 150 kata)
Apa masalah terbesar, apa yang dilakukan, berapa hasilnya. Tulis untuk manajer produk, bukan untuk engineer.

## 2. Lingkungan pengukuran
Laptop: 
- Virli Nasyila Putri_(AMD Ryzen 5 5500U with Radeon Graphics)
Chrome:
- Virli Nasyila Putri_154.0.8037.92 (Official Build) (64-bit) (cohort: 154.0.8037.92 Rollout) 
Jumlah produk: 3000 (npm start, bukan varian start:ringan)
CPU throttling: 4x slowdown (sesuai protokol)
Viewport: 412 x 915

## 3. Hasil sebelum dan sesudah

| Skenario | Metrik | Sebelum (median) | Sesudah (median) | Target | Tercapai? |
|---|---|---|---|---|---|
| S0 | CLS |0-0,997 (variatif, lihat P-06)| 0,137 | <= 0,1 | Tercapai |
| S0 | Jumlah permintaan gambar dalam 10 dtk pertama |3000/3016 |8/24 | sebanding dengan yang terlihat |Ya|
| S1 | INP |15.848 ms|48 ms| <= 200 ms |Ya|
| S1 | Long task terlama |9.368 ms| 0 ms| <= 100 ms |Ya|
| S2 | INP | | | <= 200 ms | |
| S3 | Jumlah pesanan dari 3 klik | | | 1 | |
| S4 | INP / progres tergambar bertahap? | | | | |
| S5 | Frame > 50 ms per 10 dtk | | | <= 2 | |
| S6 | Frame > 50 ms per 10 dtk | | | <= 2 | |

## 4. Temuan

### T-01: Pencarian membekukan halaman di tiap huruf yang diketik

- **Tiket terkait:** TK-1041
- **Gejala bagi pengguna:** Mengetik di kolom pencarian terasa macet/hang; huruf-huruf
  seperti tertahan, hasil baru muncul setelah jeda lama.
- **Bukti:** Data widget `?ukur=1` sebelum/sesudah (lihat PREDIKSI.md P-01) — INP turun
  dari 15.848ms ke 48ms. [Catatan: flame chart Performance panel tidak berhasil
  direkam di perangkat ini untuk kasus ini — lihat bagian 2 "Penyimpangan protokol".]
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

### T-02: Ribuan gambar diminta sekaligus meski baru sebagian terlihat

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
  → 1,92 detik. CLS membaik ke 0,137 (masih di atas target 0,1 —).

## 5. Dugaan yang ternyata keliru
Dugaan dari catatan serah terima, dari tiket, atau dari tim Anda sendiri yang terbantah oleh
pengukuran. Sertakan angkanya. Bagian ini sama pentingnya dengan bagian temuan.

## 6. Yang belum beres dan rekomendasi
Masalah yang tersisa, risiko, dan usulan untuk tim lain (backend, vendor SDK, desain).

## 7. Pernyataan penggunaan AI dan pembagian kerja
Pertanyaan : 
- Virli Nasyila Putri : "Berikan gambaran untuk mengerjakan tugas web ini, dan juga berikan saran/usulan hal - hal yang baik dilakukan dan buruk dilakukan
Pembagian Tugas : 
- Virli Nasyila Putri - TK-0141 (P-01) + TK-1081 (P-06) 
