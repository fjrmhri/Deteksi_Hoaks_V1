// Fungsi murni: format, normalisasi teks dan label, serta penyusunan data tampilan dari payload backend.

import {
  AMBANG_KEYAKINAN,
  LABEL_KATEGORI_TOPIK,
  PANJANG_MAKS_TEKS_DETAIL,
} from "./konfigurasi.js";

export function amankanHtml(teks) {
  return String(teks || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function potongTeks(teks, panjangMaks = PANJANG_MAKS_TEKS_DETAIL) {
  const mentah = String(teks || "").trim();
  return mentah.length <= panjangMaks
    ? mentah
    : `${mentah.slice(0, panjangMaks - 3)}...`;
}

export function formatPersen(nilai) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
}

// Label topik kosong atau "-" dianggap tidak ada.
export function bersihkanLabelTopik(labelMentah) {
  const label = String(labelMentah ?? "").trim();
  return !label || label === "-" ? null : label;
}

export function normalisasiLabelKategori(labelMentah) {
  const label = bersihkanLabelTopik(labelMentah);
  if (!label) return null;
  if (label === "topik_umum") return "Topik Umum";
  return LABEL_KATEGORI_TOPIK.has(label) ? label : null;
}

export function normalisasiBarisBaru(teks) {
  return String(teks || "").replace(/\r\n?/g, "\n");
}

export function pecahParagraf(teks) {
  return normalisasiBarisBaru(teks)
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function pecahKalimatHeuristik(teks) {
  const mentah = String(teks || "");
  const cocok = mentah.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const bersih = cocok.map((x) => x.trim()).filter((x) => x.length > 0);
  if (bersih.length > 0) return bersih;
  const cadangan = mentah.trim();
  return cadangan ? [cadangan] : [];
}

export function hitungParagraf(teks) {
  return pecahParagraf(teks).length;
}

export function hitungKalimat(teks) {
  return pecahKalimatHeuristik(teks).length;
}

export function hitungKata(teks) {
  return String(teks || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

// Teks tanpa baris kosong: setiap baris baru dijadikan batas paragraf sebelum dikirim ke backend.
export function normalisasiJedaParagraf(teks) {
  const n = normalisasiBarisBaru(teks);
  if (!n.includes("\n")) return n;
  if (/\n\s*\n/.test(n)) return n;
  return n.replace(/\n+/g, "\n\n");
}

// Label backend ("hoax", "not_hoax", dan variannya) menjadi "hoaks", "fakta", atau "unknown".
export function normalisasiLabel(labelMentah) {
  const nilai = String(labelMentah || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!nilai) return "unknown";
  if (
    nilai.includes("hoax") &&
    !nilai.includes("not") &&
    !nilai.includes("non")
  )
    return "hoaks";
  if (
    nilai.includes("hoaks") &&
    !nilai.includes("not") &&
    !nilai.includes("non")
  )
    return "hoaks";
  if (
    nilai.includes("nothoax") ||
    nilai.includes("nonhoax") ||
    nilai.includes("fakta") ||
    nilai.includes("valid")
  )
    return "fakta";
  return "unknown";
}

export function teksLabel(n) {
  if (n === "hoaks") return "Hoaks";
  if (n === "fakta") return "Fakta";
  return "Tidak diketahui";
}

export function kelasSorotan(label, keyakinan) {
  const yakin = Number(keyakinan);
  if (Number.isFinite(yakin) && yakin < AMBANG_KEYAKINAN) return "hl--orange";
  const n = normalisasiLabel(label);
  if (n === "hoaks") return "hl--red";
  if (n === "fakta") return "hl--green";
  return "hl--orange";
}

export function kelasBadge(label, keyakinan) {
  const yakin = Number(keyakinan);
  if (Number.isFinite(yakin) && yakin < AMBANG_KEYAKINAN)
    return "badge--orange";
  return normalisasiLabel(label) === "hoaks" ? "badge--red" : "badge--green";
}

export function teksBadge(label, keyakinan) {
  const yakin = Number(keyakinan);
  if (Number.isFinite(yakin) && yakin < AMBANG_KEYAKINAN) return "Ragu";
  return normalisasiLabel(label) === "hoaks" ? "Hoaks" : "Fakta";
}

export function probHoaksKalimat(kalimat) {
  if (Number.isFinite(Number(kalimat?.hoax_probability)))
    return Number(kalimat.hoax_probability);
  const prob = kalimat?.probabilities || {};
  if (Number.isFinite(Number(prob.hoax))) return Number(prob.hoax);
  return 0;
}

export function probFaktaKalimat(kalimat) {
  const prob = kalimat?.probabilities || {};
  if (Number.isFinite(Number(prob.not_hoax))) return Number(prob.not_hoax);
  return Math.max(0, Math.min(1, 1 - probHoaksKalimat(kalimat)));
}

// Label topik global dari payload (objek topics_global, atau string bila backend mengirim string).
export function ambilTopikGlobal(payload) {
  const aman = payload && typeof payload === "object" ? payload : {};
  const tg = aman.topics_global;
  if (tg && typeof tg === "object") {
    const label = bersihkanLabelTopik(tg.label);
    if (label) return label;
  }
  if (typeof tg === "string") {
    const label = bersihkanLabelTopik(tg);
    if (label) return label;
  }
  return null;
}

// Topik paragraf dari backend; bila tidak valid dipakai topik global, lalu "Topik Umum".
export function labelTopikParagraf(paragraf, payload) {
  const labelBackend = normalisasiLabelKategori(paragraf?.topic?.label);
  if (labelBackend) return labelBackend;
  const labelGlobal = normalisasiLabelKategori(ambilTopikGlobal(payload));
  if (labelGlobal) return labelGlobal;
  return "Topik Umum";
}

export function kelasBadgeBukti(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v === "hoax" || v === "hoaks") return "badge--red";
  if (v === "fakta") return "badge--green";
  return "badge--orange";
}

export function teksBadgeBukti(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v === "hoax" || v === "hoaks") return "Hoaks";
  if (v === "fakta") return "Fakta";
  return "Tidak diketahui";
}

// Tanggal "YYYY-MM-DD" menjadi DD/MM/YYYY tanpa lewat zona waktu browser; teks mentah bila tidak valid.
export function formatTanggalBukti(tanggalMentah) {
  const mentah = String(tanggalMentah || "").trim();
  if (!mentah) return "";
  const iso = mentah.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (iso) {
    const [, y, m, d] = iso;
    const cek = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    const sah =
      cek.getUTCFullYear() === Number(y) &&
      cek.getUTCMonth() === Number(m) - 1 &&
      cek.getUTCDate() === Number(d);
    return sah ? `${d}/${m}/${y}` : mentah;
  }
  const hasil = new Date(mentah);
  if (Number.isNaN(hasil.getTime())) return mentah;
  return hasil.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Ambil tautan pertama dan hanya izinkan http/https; selain itu string kosong (judul tampil tanpa tautan).
export function urlBuktiAman(mentah) {
  const baris =
    String(mentah || "")
      .split(/\s+/)
      .find(Boolean) || "";
  if (!baris) return "";
  try {
    const u = new URL(baris);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch (err) {
    return "";
  }
}

export function urutkanMenurutIndeks(daftar, kunci) {
  return [...(Array.isArray(daftar) ? daftar : [])].sort((a, b) => {
    const ia = Number.isFinite(Number(a?.[kunci])) ? Number(a[kunci]) : 0;
    const ib = Number.isFinite(Number(b?.[kunci])) ? Number(b[kunci]) : 0;
    return ia - ib;
  });
}

function kategoriKeyakinan(label, keyakinan) {
  const yakin = Number(keyakinan);
  if (!Number.isFinite(yakin) || yakin < AMBANG_KEYAKINAN) return "ragu";
  return normalisasiLabel(label) === "hoaks" ? "hoaks" : "fakta";
}

/**
 * Menghitung jumlah hoaks/fakta/ragu per kalimat dan per paragraf.
 * Paragraf mengikuti label paragraf dari backend; paragraf hasil pemetaan ulang di sisi klien (tanpa label)
 * dianggap hoaks bila memuat satu kalimat hoaks.
 */
export function susunModelRingkasan(daftarParagraf, mode) {
  const butir = Array.isArray(daftarParagraf) ? daftarParagraf : [];
  const jumlahKalimat = { hoaks: 0, fakta: 0, ragu: 0 };
  const jumlahParagraf = { hoaks: 0, fakta: 0, ragu: 0 };

  if (mode === "sentence") {
    butir.forEach((p) => {
      const daftarKalimat = Array.isArray(p?.sentences) ? p.sentences : [];
      let adaHoaks = false,
        adaFakta = false;
      daftarKalimat.forEach((k) => {
        const kat = kategoriKeyakinan(k?.label, k?.confidence);
        jumlahKalimat[kat]++;
        if (kat === "hoaks") adaHoaks = true;
        if (kat === "fakta") adaFakta = true;
      });
      if (typeof p?.label === "string" && p.label.trim() !== "") {
        jumlahParagraf[kategoriKeyakinan(p.label, p?.confidence)]++;
      } else {
        jumlahParagraf[adaHoaks ? "hoaks" : adaFakta ? "fakta" : "ragu"]++;
      }
    });
  } else {
    butir.forEach((p) => {
      const k =
        Array.isArray(p?.sentences) && p.sentences.length > 0
          ? p.sentences[0]
          : null;
      jumlahParagraf[kategoriKeyakinan(k?.label, k?.confidence)]++;
    });
  }

  return {
    mode,
    jumlahKalimat,
    jumlahParagraf,
    totalKalimat: jumlahKalimat.hoaks + jumlahKalimat.fakta + jumlahKalimat.ragu,
    totalParagraf: butir.length,
  };
}

export function susunMarkupRingkasan(ringkasan) {
  const { jumlahKalimat: jk, jumlahParagraf: jp } = ringkasan;
  const baris = [];
  if (ringkasan.mode === "sentence") {
    baris.push(
      `Kalimat: ${ringkasan.totalKalimat} total · ${jk.hoaks} hoaks · ${jk.fakta} fakta · ${jk.ragu} ragu`,
    );
  }
  baris.push(
    `Paragraf: ${ringkasan.totalParagraf} total · ${jp.hoaks} hoaks · ${jp.fakta} fakta · ${jp.ragu} ragu`,
  );
  return baris.map((l) => amankanHtml(l)).join("<br>");
}

/**
 * Bila backend mengembalikan satu paragraf padahal input pengguna punya beberapa paragraf, kalimat dibagi ulang
 * ke paragraf input sesuai perkiraan jumlah kalimatnya. Paragraf yang tidak mendapat kalimat dilewati.
 */
export function susunParagrafCadangan(paragrafBackend, teksInput) {
  const paragrafInput = pecahParagraf(teksInput);
  const terurut = urutkanMenurutIndeks(paragrafBackend, "paragraph_index");
  if (paragrafInput.length <= 1 || terurut.length !== 1) return terurut;

  const sumber = terurut[0] || {};
  const daftarKalimat = urutkanMenurutIndeks(sumber.sentences, "sentence_index");
  const perkiraan = paragrafInput.map((pt) => pecahKalimatHeuristik(pt).length);
  const hasil = [];
  let kursor = 0;

  for (let i = 0; i < paragrafInput.length; i++) {
    const sisaParagraf = paragrafInput.length - i;
    const sisaKalimat = daftarKalimat.length - kursor;
    let ambil = perkiraan[i] || 0;
    if (i === paragrafInput.length - 1) {
      ambil = Math.max(0, sisaKalimat);
    } else {
      const cadangan = Math.max(0, sisaParagraf - 1);
      const batas = Math.max(0, sisaKalimat - cadangan);
      if (ambil > batas) ambil = batas;
      if (ambil <= 0 && batas > 0) ambil = 1;
    }
    if (ambil === 0) continue;
    const potongan = daftarKalimat
      .slice(kursor, kursor + ambil)
      .map((k, li) => ({ ...k, sentence_index: li }));
    kursor += ambil;
    hasil.push({
      paragraph_index: i,
      text: paragrafInput[i],
      topic: null,
      sentences: potongan,
    });
  }
  if (kursor < daftarKalimat.length && hasil.length > 0) {
    const sisa = daftarKalimat.slice(kursor);
    const terakhir = hasil[hasil.length - 1];
    terakhir.sentences = [...terakhir.sentences, ...sisa].map((k, i) => ({
      ...k,
      sentence_index: i,
    }));
  }
  return hasil;
}

export function ambilParagraf(payload, teksInput) {
  if (!payload || !Array.isArray(payload.paragraphs)) return [];
  return susunParagrafCadangan(payload.paragraphs, teksInput);
}

export function perluSpasi(kiri, kanan) {
  if (!kiri || !kanan) return false;
  if (/\s$/.test(kiri) || /^\s/.test(kanan)) return false;
  if (/^[,.;:!?)]/.test(kanan)) return false;
  return true;
}

// Mode per kalimat: paragraf tanpa kalimat tidak ditampilkan dan tidak dihitung di ringkasan.
export function paragrafEfektif(daftarParagraf, perKalimat) {
  const daftar = Array.isArray(daftarParagraf) ? daftarParagraf : [];
  return perKalimat
    ? daftar.filter((p) => Array.isArray(p?.sentences) && p.sentences.length > 0)
    : daftar;
}

export function spanSorotan(label, keyakinan, teks) {
  const n = normalisasiLabel(label);
  const yakin = Number(keyakinan);
  const judul = `${teksLabel(n)} · confidence ${formatPersen(yakin)}`;
  return `<span class="hl ${kelasSorotan(n, yakin)}" title="${amankanHtml(judul)}">${amankanHtml(teks)}</span>`;
}

// Menggabungkan kalimat menjadi HTML dengan sorotan per label.
export function gabungkanSorotan(daftarKalimat) {
  const terurut = urutkanMenurutIndeks(daftarKalimat, "sentence_index");
  const potongan = [];
  terurut.forEach((k) => {
    const mentah = String(k?.text ?? "");
    if (!mentah) return;
    potongan.push({ mentah, html: spanSorotan(k?.label, k?.confidence, mentah) });
  });
  let html = "";
  for (let i = 0; i < potongan.length; i++) {
    if (i > 0 && perluSpasi(potongan[i - 1].mentah, potongan[i].mentah))
      html += " ";
    html += potongan[i].html;
  }
  return html;
}
