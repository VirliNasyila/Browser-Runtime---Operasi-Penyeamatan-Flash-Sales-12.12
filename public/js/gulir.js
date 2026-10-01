// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';

const sudahTercatat = new Set();
let antrianImpresi = [];
let idIdleImpresi = null;

// Mengirim analitik impresi secara batch lewat requestIdleCallback (TK-1063):
// SDK vendor (lacak.min.js) mengeksekusi loop hashing f() sebanyak 2.000.000
// iterasi per panggilan kirim. Bila dipanggil sinkron per kartu saat scroll,
// main thread mengalami rentetan long task (>100ms) dan frame drop (>50ms).
// Dengan batching dan idle dispatch, 2 juta iterasi hanya dieksekusi 1 kali
// per batch saat browser idle, tanpa mengganggu rendering frame scroll.
function jadwalkanKirimImpresi() {
  if (idIdleImpresi != null) return;
  const proses = () => {
    idIdleImpresi = null;
    if (antrianImpresi.length === 0 || !window.Lacak) return;
    const batch = antrianImpresi.splice(0, antrianImpresi.length);
    window.Lacak.kirim('impression', { produk: batch });
  };
  if (typeof window.requestIdleCallback === 'function') {
    idIdleImpresi = window.requestIdleCallback(proses, { timeout: 1000 });
  } else {
    idIdleImpresi = setTimeout(proses, 200);
  }
}

const pengamatKartu = new IntersectionObserver((entries) => {
  let adaBaru = false;
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const kartu = entry.target;
    kartu.classList.add('terlihat');
    const id = kartu.dataset.id;
    if (id && !sudahTercatat.has(id)) {
      sudahTercatat.add(id);
      antrianImpresi.push(id);
      adaBaru = true;
    }
    pengamatKartu.unobserve(kartu);
  }
  if (adaBaru) jadwalkanKirimImpresi();
}, { rootMargin: '80px 0px' });

export function amatiKartu(kartu) {
  pengamatKartu.observe(kartu);
}

let tinggiScrollMaks = 0;
let melayangSaatIni = false;
let keAtasTampil = false;
let rafMenunggu = false;

export function perbaruiUkuranDokumen() {
  tinggiScrollMaks = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

// Pemeriksaan posisi scroll:
// 1. scrollHeight di-cache via perbaruiUkuranDokumen() dan hanya dihitung ulang
//    saat render produk bertahap / resize, bukan membaca layout di tiap frame.
// 2. Class dan attribute hidden dijaga guard boolean agar tidak merusak
//    style/DOM secara redundan di tiap event scroll.
// 3. Bar gulir memakai transform: scaleX (kompositor), bukan width (layout).
export function periksaGulir() {
  const kepala = $('#kepala');
  const bar = $('#bar-gulir');
  const keAtas = $('#ke-atas');

  const y = window.scrollY;

  const harusMelayang = y > 8;
  if (harusMelayang !== melayangSaatIni) {
    melayangSaatIni = harusMelayang;
    kepala.classList.toggle('melayang', melayangSaatIni);
  }

  const harusKeAtas = y >= 900;
  if (harusKeAtas !== keAtasTampil) {
    keAtasTampil = harusKeAtas;
    keAtas.hidden = !keAtasTampil;
  }

  if (tinggiScrollMaks <= 0) perbaruiUkuranDokumen();
  const fraksi = tinggiScrollMaks > 0 ? Math.min(1, Math.max(0, y / tinggiScrollMaks)) : 0;
  bar.style.transform = `scaleX(${fraksi})`;
}

function onScroll() {
  if (rafMenunggu) return;
  rafMenunggu = true;
  requestAnimationFrame(() => {
    rafMenunggu = false;
    periksaGulir();
  });
}

export function segarkanGulir() {
  perbaruiUkuranDokumen();
  periksaGulir();
}

export function pasangGulir() {
  segarkanGulir();

  // Listener scroll dan resize menggunakan { passive: true } agar compositor thread
  // dapat menggulir halaman secara asinkron tanpa harus menunggu main thread (TK-1063).
  // Pencegahan pull-to-refresh Android ditangani via CSS overscroll-behavior-y: contain
  // pada body, sehingga listener touchstart/touchmove/wheel non-passive tidak diperlukan.
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    perbaruiUkuranDokumen();
    onScroll();
  }, { passive: true });

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}