// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { amatiKartu, segarkanGulir } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  gambar.src = produk.gambar;
  gambar.alt = produk.nama;
  // loading="lazy": browser menunda permintaan jaringan gambar sampai kartu
  // mendekati viewport, jadi tidak ribuan request gambar sekaligus (TK-1081).
  // width/height sesuai ukuran asli SVG dari server: browser bisa hitung
  // aspect-ratio sebelum gambar selesai dimuat, sehingga tidak ada layout
  // shift saat gambar akhirnya tampil (menjaga CLS S0).
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  gambar.width = 480;
  gambar.height = 480;
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

  badan.append(el('div', 'keterangan', '★ ' + produk.rating.toLocaleString('id-ID') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);
  return kartu;
}

// Judul produk panjangnya beda-beda (1-3 baris). Dulu tinggi disamakan lewat
// JS: baca offsetHeight lalu tulis style.height berulang di dalam loop, yang
// artinya browser dipaksa menghitung Layout berkali-kali secara sinkron di
// setiap iterasi ("layout thrashing") — inilah bagian utama long task saat
// mengetik di pencarian (TK-1041). Diganti murni CSS (line-clamp 2 baris di
// toko.css): tinggi judul konsisten tanpa JS membaca ukuran elemen sama sekali.

// Render sekaligus ribuan kartu (+ ribuan <img>) adalah kerja besar dalam satu
// task dan memicu ribuan permintaan gambar bersamaan (TK-1081). Sebagai
// gantinya kartu dibangun bertahap per kelompok; kelompok berikutnya dipicu
// saat pengguna menggulir mendekati ujung kisi (IntersectionObserver pada
// sebuah "penanda" di bawah kisi), sehingga tiap kelompok tetap kecil dan ada
// jeda alami untuk browser merender & memproses input di antaranya.
const UKURAN_KELOMPOK = 60;

let pengamatKelanjutan = null;
let daftarBerjalan = [];
let indeksBerjalan = 0;
let penanda = null;

function renderKelompokBerikutnya() {
  const kisi = $('#kisi');
  const akhir = Math.min(indeksBerjalan + UKURAN_KELOMPOK, daftarBerjalan.length);
  const potongan = document.createDocumentFragment();
  for (; indeksBerjalan < akhir; indeksBerjalan++) {
    const kartu = buatKartu(daftarBerjalan[indeksBerjalan]);
    potongan.append(kartu);
    amatiKartu(kartu);
  }
  kisi.insertBefore(potongan, penanda);

  if (indeksBerjalan >= daftarBerjalan.length && pengamatKelanjutan) {
    pengamatKelanjutan.disconnect();
    pengamatKelanjutan = null;
    penanda.remove();
  }
  segarkanGulir();
}

export function renderProduk(daftar) {
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;
  kisi.innerHTML = '';
  if (pengamatKelanjutan) { pengamatKelanjutan.disconnect(); pengamatKelanjutan = null; }

  // Jumlah hasil yang ditampilkan di ringkasan selalu benar dan langsung
  // terlihat, walau kartunya sendiri baru dibangun bertahap saat digulir.
  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';

  if (daftar.length === 0) {
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
    segarkanGulir();
    return;
  }

  daftarBerjalan = daftar;
  indeksBerjalan = 0;
  penanda = el('div', 'kisi-penanda');
  penanda.setAttribute('aria-hidden', 'true');
  kisi.append(penanda);

  renderKelompokBerikutnya();

  if (indeksBerjalan < daftarBerjalan.length) {
    pengamatKelanjutan = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) renderKelompokBerikutnya();
    }, { rootMargin: '600px 0px' });
    pengamatKelanjutan.observe(penanda);
  }
}

// Menempel harga voucher ke kartu yang sudah ada, tanpa membongkar kisi:
// renderProduk ulang untuk ribuan kartu adalah long task sendiri (TK-1057).
// Kartu yang dirender belakangan (render bertahap) ikut benar karena
// buatKartu() membaca keadaan.hargaVoucher saat membuat kartunya.
export function perbaruiHargaVoucherDiKartu() {
  const kartu = $('#kisi').children;
  for (let i = 0; i < kartu.length; i++) {
    const baris = kartu[i].querySelector('.harga');
    if (!baris) continue;
    const lama = baris.querySelector('.harga-voucher');
    if (lama) lama.remove();
    const hargaVoucher = keadaan.hargaVoucher.get(Number(kartu[i].dataset.id));
    if (hargaVoucher) baris.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  }
}
