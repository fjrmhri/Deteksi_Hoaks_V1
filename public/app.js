/**
 * Titik masuk frontend Deteksi Hoaks Berita: membaca input, memanggil backend, dan menampilkan hasil.
 * Modul pendukung ada di folder js/.
 */

import { ambilJumlahArtikelRag, panggilApiAnalisis } from "./js/api.js";
import {
  adaElemenJumlahArtikelRag,
  aturMemuat,
  hapusGalat,
  kosongkanHasil,
  tampilkanBukti,
  tampilkanGalat,
  tampilkanHasil,
  tampilkanJumlahArtikelRag,
  tampilkanKeyakinan,
  tampilkanVerdict,
} from "./js/tampilan.js";
import {
  ambilParagraf,
  hitungKalimat,
  hitungKata,
  hitungParagraf,
  normalisasiBarisBaru,
  normalisasiJedaParagraf,
} from "./js/utilitas.js";

const tombolDeteksi = document.getElementById("detectBtn");
const tombolReset = document.getElementById("resetBtn");
const tombolRapikan = document.getElementById("rapikanBtn");
const teksBerita = document.getElementById("newsText");
const sakelarKalimat = document.getElementById("sentenceLevelToggle");
const sakelarTopik = document.getElementById("topicToggle");
const statParagraf = document.getElementById("statParagraphs");
const statKalimat = document.getElementById("statSentences");
const statKata = document.getElementById("statWords");

function perbaruiStatistikInput() {
  const teks = String(teksBerita?.value || "");
  if (statParagraf) statParagraf.textContent = `Paragraf: ${hitungParagraf(teks)}`;
  if (statKalimat) statKalimat.textContent = `Kalimat: ${hitungKalimat(teks)}`;
  if (statKata) statKata.textContent = `Kata: ${hitungKata(teks)}`;
}

function tanganiReset() {
  if (teksBerita) teksBerita.value = "";
  hapusGalat();
  kosongkanHasil();
  perbaruiStatistikInput();
  if (teksBerita) teksBerita.focus();
}

/**
 * Menggabungkan baris yang terputus akibat salin-tempel (WhatsApp, PDF, situs berita) menjadi paragraf utuh.
 * Baris kosong dianggap batas paragraf yang disengaja.
 */
function tanganiRapikan() {
  if (!teksBerita) return;
  const mentah = teksBerita.value;
  if (!mentah.trim()) return;

  const blok = normalisasiBarisBaru(mentah).split(/\n[ \t]*\n+/);
  const bersih = blok
    .map((b) =>
      b
        .split("\n")
        .map((baris) => baris.trim())
        .filter((baris) => baris.length > 0)
        .join(" "),
    )
    .filter((b) => b.trim().length > 0);

  teksBerita.value = bersih.join("\n\n");
  perbaruiStatistikInput();
}

// Validasi input, panggil /analyze, lalu tampilkan verdict, bukti, sorotan, dan rincian keyakinan.
async function tanganiDeteksi() {
  hapusGalat();
  kosongkanHasil();

  const teks = String(teksBerita?.value || "");
  if (!teks.trim()) {
    tampilkanGalat("Masukkan teks berita terlebih dahulu.");
    return;
  }

  const teksKirim = normalisasiJedaParagraf(teks);
  const perKalimat = sakelarKalimat ? Boolean(sakelarKalimat.checked) : true;
  const topikPerParagraf = sakelarTopik ? Boolean(sakelarTopik.checked) : false;

  aturMemuat(true);
  try {
    const payload = await panggilApiAnalisis(teksKirim, perKalimat, topikPerParagraf);
    tampilkanVerdict(payload);
    tampilkanBukti(payload);
    const daftar = ambilParagraf(payload, teksKirim);
    const ringkasan = tampilkanHasil(payload, daftar, perKalimat, topikPerParagraf);
    tampilkanKeyakinan(daftar, perKalimat, ringkasan);
  } catch (err) {
    tampilkanGalat(
      err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.",
    );
  } finally {
    aturMemuat(false);
  }
}

// Indikator sekunder: kegagalan hanya menyembunyikan elemen, tidak menampilkan galat.
async function muatJumlahArtikelRag() {
  if (!adaElemenJumlahArtikelRag()) return;
  tampilkanJumlahArtikelRag(await ambilJumlahArtikelRag());
}

if (tombolDeteksi) tombolDeteksi.addEventListener("click", tanganiDeteksi);
if (tombolReset) tombolReset.addEventListener("click", tanganiReset);
if (tombolRapikan) tombolRapikan.addEventListener("click", tanganiRapikan);

if (teksBerita) {
  teksBerita.addEventListener("input", perbaruiStatistikInput);
  teksBerita.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
      tanganiDeteksi();
    }
  });
}

perbaruiStatistikInput();
muatJumlahArtikelRag();
