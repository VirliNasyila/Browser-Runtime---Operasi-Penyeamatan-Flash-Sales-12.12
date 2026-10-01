// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.

import { $ } from './util.js';

const sudahTercatat = new Set();

// Animasi "muncul" + pencatatan impresi pindah dari periksaGulir() ke
// IntersectionObserver ini (katalog.js memanggil amatiKartu() untuk tiap kartu
// baru karena kartu kini dirender bertahap). Dulu keduanya dijalankan di tiap
// event scroll lewat querySelectorAll + getBoundingClientRect.
// Tulisan minHeight dihapus bersama perubahan animasi kartu ke transform (TK-1078):
// margin-top yang dulu ditanjam tak dipakai lagi, jadi tidak ada yang perlu
// ditambal, dan observer ini jadi bebas tulis layout sama sekali.
const pengamatKartu = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const kartu = entry.target;
    kartu.classList.add('terlihat');
    const id = kartu.dataset.id;
    if (!sudahTercatat.has(id)) {
      sudahTercatat.add(id);
      if (window.Lacak) window.Lacak.kirim('impression', { produk: [id] });
    }
    pengamatKartu.unobserve(kartu);
  }
}, { rootMargin: '80px 0px' });

export function amatiKartu(kartu) {
  pengamatKartu.observe(kartu);
}

export function periksaGulir() {
  const kepala = $('#kepala');
  const bar = $('#bar-gulir');
  const keAtas = $('#ke-atas');

  const y = window.scrollY;
  kepala.classList.toggle('melayang', y > 8);
  keAtas.hidden = y < 900;

  const tinggiDokumen = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = (tinggiDokumen > 0 ? (y / tinggiDokumen) * 100 : 0) + '%';
}

// Alias saja supaya import { segarkanGulir } di katalog.js (TK-1081) tidak
// pecah. Ini TIDAK menambah throttling/IntersectionObserver untuk bagian
// header/bar/tombol-ke-atas -- periksaGulir tetap berjalan langsung di tiap
// event scroll seperti semula, karena membenahi itu di luar scope TK-1081
// (lihat TK-1063 untuk perbaikan sesungguhnya pada bagian ini).
export const segarkanGulir = periksaGulir;

export function pasangGulir() {
  window.addEventListener('scroll', periksaGulir);
  window.addEventListener('resize', periksaGulir);

  // Cegah "pull to refresh" tak sengaja di Android ketika pengguna sedang di puncak halaman.
  let yAwal = 0;
  const utama = $('#utama');
  utama.addEventListener('touchstart', (e) => { yAwal = e.touches[0].clientY; }, { passive: false });
  utama.addEventListener('touchmove', (e) => {
    const menarikKeBawah = e.touches[0].clientY > yAwal;
    if (window.scrollY === 0 && menarikKeBawah) e.preventDefault();
    periksaGulir();
  }, { passive: false });
  utama.addEventListener('wheel', () => { periksaGulir(); }, { passive: false });

  $('#ke-atas').addEventListener('click', () => window.scrollTo({ top: 0 }));
}