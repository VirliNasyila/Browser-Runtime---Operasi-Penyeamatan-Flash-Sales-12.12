// Pencarian, saringan kategori, dan pengurutan.


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
