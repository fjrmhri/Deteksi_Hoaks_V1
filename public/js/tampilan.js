// Menampilkan hasil analisis ke DOM: galat, status memuat, verdict, bukti, sorotan, dan rincian keyakinan.

import {
  amankanHtml,
  ambilTopikGlobal,
  bersihkanLabelTopik,
  formatPersen,
  formatTanggalBukti,
  gabungkanSorotan,
  kelasBadge,
  kelasBadgeBukti,
  labelTopikParagraf,
  normalisasiLabel,
  paragrafEfektif,
  potongTeks,
  probFaktaKalimat,
  probHoaksKalimat,
  spanSorotan,
  susunMarkupRingkasan,
  susunModelRingkasan,
  teksBadge,
  teksBadgeBukti,
  urlBuktiAman,
  urutkanMenurutIndeks,
} from "./utilitas.js";

const $ = (id) => document.getElementById(id);

const tombolDeteksi = $("detectBtn");
const labelDeteksi = $("detectLabel");
const spinnerDeteksi = $("detectSpinner");
const tombolReset = $("resetBtn");
const tombolRapikan = $("rapikanBtn");
const kotakGalat = $("errorBox");
const teksGalat = $("errorText");
const bagianHasil = $("outputSection");
const bannerVerdict = $("verdictBanner");
const ikonVerdict = $("verdictIcon");
const labelVerdict = $("verdictLabel");
const keyakinanVerdict = $("verdictConf");
const badgeSumberVerdict = $("verdictSourceBadge");
const penjelasanVerdict = $("verdictExplanation");
const topikVerdict = $("verdictTopic");
const bagianBukti = $("evidenceSection");
const daftarBukti = $("evidenceList");
const jumlahArtikelRag = $("ragArticleCount");
const ringkasanGlobal = $("globalSummary");
const daftarParagraf = $("outputParagraphs");
const detailKeyakinan = $("confidenceDetails");
const judulKeyakinan = $("confidenceSummary");
const daftarKeyakinan = $("confidenceList");

export function tampilkanGalat(pesan) {
  if (!kotakGalat) return;
  if (teksGalat) teksGalat.textContent = pesan;
  else kotakGalat.textContent = pesan;
  kotakGalat.classList.remove("hidden");
}

export function hapusGalat() {
  if (!kotakGalat) return;
  if (teksGalat) teksGalat.textContent = "";
  else kotakGalat.textContent = "";
  kotakGalat.classList.add("hidden");
}

export function aturMemuat(sedangMemuat) {
  if (!tombolDeteksi || !labelDeteksi || !spinnerDeteksi) return;
  tombolDeteksi.disabled = sedangMemuat;
  if (tombolReset) tombolReset.disabled = sedangMemuat;
  if (tombolRapikan) tombolRapikan.disabled = sedangMemuat;
  if (sedangMemuat) {
    labelDeteksi.textContent = "Menganalisis…";
    spinnerDeteksi.classList.remove("hidden");
  } else {
    labelDeteksi.textContent = "Analisis Sekarang";
    spinnerDeteksi.classList.add("hidden");
  }
}

export function kosongkanHasil() {
  if (daftarParagraf) daftarParagraf.innerHTML = "";
  if (ringkasanGlobal) ringkasanGlobal.textContent = "";
  if (bagianHasil) bagianHasil.classList.add("hidden");
  if (bannerVerdict) bannerVerdict.classList.add("hidden");
  if (topikVerdict) topikVerdict.classList.add("hidden");
  if (badgeSumberVerdict) {
    badgeSumberVerdict.textContent = "";
    badgeSumberVerdict.classList.add("hidden");
  }
  if (penjelasanVerdict) {
    penjelasanVerdict.textContent = "";
    penjelasanVerdict.className = "verdict-explanation hidden";
  }
  if (bagianBukti) bagianBukti.classList.add("hidden");
  if (daftarBukti) daftarBukti.innerHTML = "";
  if (daftarKeyakinan) daftarKeyakinan.innerHTML = "";
  if (judulKeyakinan) judulKeyakinan.textContent = "Rincian Keyakinan per Kalimat";
  if (detailKeyakinan) {
    detailKeyakinan.classList.add("hidden");
    detailKeyakinan.open = false;
  }
}

/**
 * Banner verdict dokumen, topik global, dan penanda override RAG.
 * Penjelasan risiko hanya ditampilkan saat verdict berasal dari override RAG, karena sorotan kalimat
 * tetap mengikuti IndoBERT dan bisa tampak berlawanan dengan verdict dokumen.
 */
export function tampilkanVerdict(payload) {
  if (!bannerVerdict || !ikonVerdict || !labelVerdict || !keyakinanVerdict) return;

  const dok = payload?.document;
  if (!dok) return;

  const pHoaks = Number(dok.hoax_probability ?? 0);
  const keyakinan = Number(dok.confidence ?? Math.max(pHoaks, 1 - pHoaks));
  const hoaks = normalisasiLabel(dok.label) === "hoaks";

  bannerVerdict.className = `verdict-banner verdict-banner--${hoaks ? "hoaks" : "fakta"}`;
  ikonVerdict.textContent = hoaks ? "⚠" : "✓";
  labelVerdict.textContent = hoaks ? "Terindikasi Hoaks" : "Terindikasi Fakta";
  keyakinanVerdict.textContent = `Confidence: ${formatPersen(keyakinan)} · P(hoaks): ${formatPersen(pHoaks)}`;

  if (topikVerdict) {
    const labelTopik = bersihkanLabelTopik(ambilTopikGlobal(payload));
    if (labelTopik) {
      topikVerdict.textContent = `Topik: ${labelTopik}`;
      topikVerdict.classList.remove("hidden");
    } else {
      topikVerdict.classList.add("hidden");
    }
  }

  const overrideRag =
    String(dok.verdict_source || "").toLowerCase() === "rag_override";

  if (badgeSumberVerdict) {
    if (overrideRag) {
      badgeSumberVerdict.textContent =
        "🔎 Verdict dari evidence RAG (hoaks terverifikasi)";
      badgeSumberVerdict.classList.remove("hidden");
    } else {
      badgeSumberVerdict.textContent = "";
      badgeSumberVerdict.classList.add("hidden");
    }
  }

  if (penjelasanVerdict) {
    const penjelasan = overrideRag ? String(dok.risk_explanation || "").trim() : "";
    if (penjelasan) {
      penjelasanVerdict.textContent = penjelasan;
      penjelasanVerdict.className =
        "verdict-explanation verdict-explanation--override";
      penjelasanVerdict.classList.remove("hidden");
    } else {
      penjelasanVerdict.classList.add("hidden");
    }
  }

  bannerVerdict.classList.remove("hidden");
}

/**
 * Daftar artikel cek fakta (document.evidence_matches). Disembunyikan bila kosong.
 * Bukti pertama diberi penanda bila verdict dokumen berasal dari override RAG.
 */
export function tampilkanBukti(payload) {
  if (!bagianBukti || !daftarBukti) return;

  const butir = Array.isArray(payload?.document?.evidence_matches)
    ? payload.document.evidence_matches
    : [];
  const overrideRag =
    String(payload?.document?.verdict_source || "").toLowerCase() ===
    "rag_override";

  daftarBukti.innerHTML = "";

  if (butir.length === 0) {
    bagianBukti.classList.add("hidden");
    return;
  }

  const fragmen = document.createDocumentFragment();
  butir.forEach((b, idx) => {
    const judul = String(b?.title || "").trim() || "Artikel tanpa judul";
    const url = urlBuktiAman(b?.url);
    const tanggal = formatTanggalBukti(b?.date);
    const kemiripan = Number(b?.similarity);
    const pemicuOverride = overrideRag && idx === 0;

    const li = document.createElement("li");
    li.className = pemicuOverride
      ? "evidence-item evidence-item--override"
      : "evidence-item";

    const utama = document.createElement("div");
    utama.className = "evidence-item__main";

    const tautan = document.createElement("a");
    tautan.className = "evidence-item__title";
    tautan.textContent = judul;
    if (url) {
      tautan.href = url;
      tautan.target = "_blank";
      tautan.rel = "noopener noreferrer";
    }
    utama.appendChild(tautan);

    const meta = document.createElement("div");
    meta.className = "evidence-item__meta";
    if (tanggal) {
      const span = document.createElement("span");
      span.textContent = tanggal;
      meta.appendChild(span);
    }
    if (Number.isFinite(kemiripan)) {
      const span = document.createElement("span");
      span.textContent = `Kemiripan ${formatPersen(kemiripan)}`;
      meta.appendChild(span);
    }
    utama.appendChild(meta);

    if (pemicuOverride) {
      const tanda = document.createElement("span");
      tanda.className = "evidence-item__override-tag";
      tanda.textContent = "Pemicu override verdict";
      utama.appendChild(tanda);
    }

    const badge = document.createElement("span");
    badge.className = `confidence-badge evidence-item__badge ${kelasBadgeBukti(b?.verdict)}`;
    badge.textContent = teksBadgeBukti(b?.verdict);

    li.appendChild(utama);
    li.appendChild(badge);
    fragmen.appendChild(li);
  });

  daftarBukti.appendChild(fragmen);
  bagianBukti.classList.remove("hidden");
}

export function tampilkanJumlahArtikelRag(jumlah) {
  if (!jumlahArtikelRag) return;
  if (jumlah === null) {
    jumlahArtikelRag.classList.add("hidden");
    return;
  }
  jumlahArtikelRag.textContent = `Artikel referensi tersimpan: ${jumlah}`;
  jumlahArtikelRag.classList.remove("hidden");
}

export function adaElemenJumlahArtikelRag() {
  return Boolean(jumlahArtikelRag);
}

// Paragraf hasil analisis dengan sorotan per kalimat atau per paragraf, plus ringkasan global.
export function tampilkanHasil(payload, daftar, perKalimat, topikPerParagraf) {
  if (!bagianHasil || !daftarParagraf || !ringkasanGlobal) return null;
  daftarParagraf.innerHTML = "";

  const efektif = paragrafEfektif(daftar, perKalimat);
  const ringkasan = susunModelRingkasan(efektif, perKalimat ? "sentence" : "paragraph");

  ringkasanGlobal.innerHTML = susunMarkupRingkasan(ringkasan);

  if (efektif.length === 0) {
    daftarParagraf.innerHTML =
      '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    bagianHasil.classList.remove("hidden");
    return ringkasan;
  }

  const fragmen = document.createDocumentFragment();

  urutkanMenurutIndeks(efektif, "paragraph_index").forEach((paragraf, index) => {
    const nomorP = Number.isFinite(Number(paragraf?.paragraph_index))
      ? Number(paragraf.paragraph_index) + 1
      : index + 1;
    const daftarKalimat = urutkanMenurutIndeks(paragraf?.sentences, "sentence_index");
    const teksP = String(paragraf?.text ?? "");

    const blok = document.createElement("article");
    blok.className = "paragraph-block";

    const teks = document.createElement("p");
    teks.className = "paragraph-text";

    if (perKalimat) {
      teks.innerHTML = gabungkanSorotan(daftarKalimat) || amankanHtml(teksP);
    } else {
      const k = daftarKalimat[0] || null;
      teks.innerHTML = k
        ? spanSorotan(k?.label, k?.confidence, teksP)
        : amankanHtml(teksP);
    }

    if (topikPerParagraf) {
      const labelTopik = labelTopikParagraf(paragraf, payload);
      const meta = document.createElement("p");
      meta.className = "paragraph-meta";
      meta.textContent = labelTopik
        ? `Paragraf ${nomorP} · Topik: ${labelTopik}`
        : `Paragraf ${nomorP} · Topik belum tersedia`;
      blok.appendChild(meta);
    }

    blok.appendChild(teks);
    fragmen.appendChild(blok);
  });

  daftarParagraf.appendChild(fragmen);
  bagianHasil.classList.remove("hidden");
  return ringkasan;
}

function butirKeyakinan(posisi, label, keyakinan, pHoaks, pFakta, teksPenuh) {
  const li = document.createElement("li");
  li.className = "confidence-item";
  li.title = teksPenuh || "(teks kosong)";

  const kepala = document.createElement("div");
  kepala.className = "confidence-head";
  const pos = document.createElement("span");
  pos.className = "confidence-pos";
  pos.textContent = posisi;
  const badge = document.createElement("span");
  badge.className = `confidence-badge ${kelasBadge(label, keyakinan)}`;
  badge.textContent = teksBadge(label, keyakinan);
  kepala.appendChild(pos);
  kepala.appendChild(badge);

  const metrik = document.createElement("div");
  metrik.className = "confidence-metrics";
  [
    `Conf ${formatPersen(keyakinan)}`,
    `P(hoaks) ${formatPersen(pHoaks)}`,
    `P(fakta) ${formatPersen(pFakta)}`,
  ].forEach((t) => {
    const span = document.createElement("span");
    span.className = "confidence-metric";
    span.textContent = t;
    metrik.appendChild(span);
  });

  const teks = document.createElement("p");
  teks.className = "confidence-text";
  teks.textContent = potongTeks(teksPenuh) || "(teks kosong)";

  li.appendChild(kepala);
  li.appendChild(metrik);
  li.appendChild(teks);
  return li;
}

// Panel rincian keyakinan per kalimat (P1 S1, ...) atau per paragraf (P1, ...).
export function tampilkanKeyakinan(daftar, perKalimat, ringkasan) {
  if (!detailKeyakinan || !judulKeyakinan || !daftarKeyakinan) return;

  const efektif = paragrafEfektif(daftar, perKalimat);
  const model =
    ringkasan || susunModelRingkasan(efektif, perKalimat ? "sentence" : "paragraph");

  judulKeyakinan.textContent = perKalimat
    ? `Rincian Keyakinan · ${model.totalKalimat} kalimat`
    : `Rincian Keyakinan · ${model.totalParagraf} paragraf`;

  daftarKeyakinan.innerHTML = "";
  const fragmen = document.createDocumentFragment();

  urutkanMenurutIndeks(efektif, "paragraph_index").forEach((p, idx) => {
    const nomorP = Number.isFinite(Number(p?.paragraph_index))
      ? Number(p.paragraph_index) + 1
      : idx + 1;
    if (perKalimat) {
      urutkanMenurutIndeks(p?.sentences, "sentence_index").forEach((k, sIdx) => {
        const nomorK = Number.isFinite(Number(k?.sentence_index))
          ? Number(k.sentence_index) + 1
          : sIdx + 1;
        fragmen.appendChild(
          butirKeyakinan(
            `P${nomorP} S${nomorK}`,
            k?.label,
            Number(k?.confidence),
            probHoaksKalimat(k),
            probFaktaKalimat(k),
            String(k?.text ?? "").trim(),
          ),
        );
      });
    } else {
      const k =
        Array.isArray(p?.sentences) && p.sentences.length > 0 ? p.sentences[0] : {};
      fragmen.appendChild(
        butirKeyakinan(
          `P${nomorP}`,
          k?.label,
          Number(k?.confidence),
          probHoaksKalimat(k),
          probFaktaKalimat(k),
          String(p?.text || k?.text || "").trim(),
        ),
      );
    }
  });

  if (fragmen.childNodes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tidak ada rincian confidence yang tersedia.";
    fragmen.appendChild(li);
  }
  daftarKeyakinan.appendChild(fragmen);
  detailKeyakinan.classList.remove("hidden");
}
