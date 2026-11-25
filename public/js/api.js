// Komunikasi dengan backend: /analyze dan /health.

import { BATAS_WAKTU_API_MS, urlApi } from "./konfigurasi.js";

export async function fetchDenganBatasWaktu(
  url,
  opsi = {},
  batasMs = BATAS_WAKTU_API_MS,
) {
  const pengendali = new AbortController();
  const penghitung = setTimeout(() => pengendali.abort(), batasMs);
  try {
    return await fetch(url, { ...opsi, signal: pengendali.signal });
  } finally {
    clearTimeout(penghitung);
  }
}

// Mengirim teks ke /analyze dan mengembalikan payload JSON; galat jaringan diterjemahkan ke pesan pengguna.
export async function panggilApiAnalisis(teks, perKalimat, topikPerParagraf) {
  if (!urlApi) throw new Error("API base URL kosong.");
  try {
    const respons = await fetchDenganBatasWaktu(`${urlApi}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: teks,
        topic_per_paragraph: topikPerParagraf === true,
        sentence_level: perKalimat !== false,
      }),
    });
    const payload = await respons.json().catch(() => null);
    if (!respons.ok || !payload) {
      const detail = payload?.detail || respons.statusText;
      throw new Error(
        `Gagal request (${respons.status}): ${detail || "Unknown error"}`,
      );
    }
    return payload;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Koneksi timeout saat menghubungi backend.");
    }
    if (err instanceof TypeError) {
      throw new Error(
        "Tidak dapat terhubung ke backend. Periksa koneksi dan URL API.",
      );
    }
    throw err;
  }
}

// Jumlah artikel indeks RAG dari /health; null bila RAG nonaktif atau permintaan gagal.
export async function ambilJumlahArtikelRag() {
  if (!urlApi) return null;
  try {
    const respons = await fetchDenganBatasWaktu(`${urlApi}/health`);
    const payload = await respons.json();
    const rag = payload?.rag_evidence;
    if (!respons.ok || !rag || rag.enabled !== true) return null;
    return Number(rag.n_articles) || 0;
  } catch (err) {
    return null;
  }
}
