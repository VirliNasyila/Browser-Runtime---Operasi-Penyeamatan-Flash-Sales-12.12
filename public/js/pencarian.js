// Pencarian, saringan kategori, dan pengurutan.

import { $, el, hargaSetelahDiskon } from './util.js';
import { keadaan, renderProduk } from './katalog.js';

const saringan = { kata: '', kategori: 'Semua', urut: 'relevan' };

// "Sepatu Lari" == "sepatu  lari" == "SEPATU-LARI"
function normalkan(teks) {
  return teks
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cocok(produk, kunci) {
  const teks = normalkan(produk.nama + ' ' + produk.merek + ' ' + produk.kategori + ' ' + produk.kota);
  return kunci.split(' ').every((k) => teks.includes(k));
}

const PEMBANDING = {
  murah: (a, b) => hargaSetelahDiskon(a) - hargaSetelahDiskon(b),
  mahal: (a, b) => hargaSetelahDiskon(b) - hargaSetelahDiskon(a),
  laris: (a, b) => b.terjual - a.terjual,
  rating: (a, b) => b.rating - a.rating || b.terjual - a.terjual,
};

export function terapkanSaringan() {
  const kunci = normalkan(saringan.kata);
  let hasil = keadaan.semuaProduk.filter((p) => {
    if (saringan.kategori !== 'Semua' && p.kategori !== saringan.kategori) return false;
    if (kunci && !cocok(p, kunci)) return false;
    return true;
  });
  if (PEMBANDING[saringan.urut]) hasil = hasil.slice().sort(PEMBANDING[saringan.urut]);
  renderProduk(hasil);

  if (window.Lacak && kunci) window.Lacak.kirim('search', { kata: saringan.kata, jumlah: hasil.length });
}

// Menyaring+menggambar ulang kisi (bisa ribuan kartu) itu kerja berat.
// Kalau dijalankan di setiap keystroke, tiap huruf jadi satu long task dan
// mengetik terasa "telat/hang" (TK-1041). 
// ditunda (browser menangani teks input secara native) — yang ditunda
// hanya kerja penyaringan/render, sampai user berhenti mengetik sejenak.
const JEDA_PENCARIAN_MS = 180;
let pewaktuPencarian;

export function pasangPencarian() {
  const kolom = $('#kolom-cari');
  kolom.addEventListener('input', () => {
    saringan.kata = kolom.value;
    clearTimeout(pewaktuPencarian);
    pewaktuPencarian = setTimeout(terapkanSaringan, JEDA_PENCARIAN_MS);
  });

  $('#pilih-urut').addEventListener('change', (e) => {
    saringan.urut = e.target.value;
    terapkanSaringan();
  });

  const wadah = $('#keping-kategori');
  const kategori = ['Semua', ...new Set(keadaan.semuaProduk.map((p) => p.kategori))];
  for (const nama of kategori) {
    const keping = el('button', 'keping', nama);
    keping.type = 'button';
    keping.setAttribute('aria-pressed', String(nama === 'Semua'));
    keping.addEventListener('click', () => {
      saringan.kategori = nama;
      wadah.querySelectorAll('.keping').forEach((k) => k.setAttribute('aria-pressed', String(k === keping)));
      terapkanSaringan();
    });
    wadah.append(keping);
  }
}
