// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast } from './util.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const total = akhir - awal + 1;
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik');

  // Satu tugas per detik, hanya menulis angka yang benar-benar berubah.
  // Garis memakai transform: scaleX (properti komposit) sehingga tidak pernah
  // membaca offsetWidth -- dulu pembacaan itu memaksa Layout di tiap tick 10 ms.
  const tulis = (node, nilai) => {
    const teks = duaDigit(nilai);
    if (node.textContent !== teks) node.textContent = teks;
  };

  function maju() {
    const sisa = Math.max(akhir - Date.now(), 0);
    tulis(jam, Math.floor(sisa / 3600000));
    tulis(menit, Math.floor((sisa % 3600000) / 60000));
    tulis(detik, Math.floor((sisa % 60000) / 1000));
    garis.style.transform = 'scaleX(' + (sisa / total).toFixed(5) + ')';
    // diselaraskan ke batas detik jam dinding supaya angka tidak meleset
    setTimeout(maju, 1000 - (Date.now() % 1000));
  }
  maju();
}

async function pasangBannerPromo() {
  const respons = await fetch('/api/promo');
  const promo = await respons.json();

  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    if (window.Lacak) window.Lacak.kirim('promo_click', { judul: promo.judul });
  });

  // Mengisi slot yang sudah ada di HTML, bukan menyisipkan elemen baru:
  // penyisipan setelah fetch ±1,8 dtk menggeser seluruh konten di bawahnya.
  $('#promo-banner').replaceChildren(teks, tombol);
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangBannerPromo();
}
