// Konstanta aplikasi dan penentuan alamat backend.

export const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
export const BATAS_WAKTU_API_MS = 25000;
export const AMBANG_KEYAKINAN = 0.65;
export const PANJANG_MAKS_TEKS_DETAIL = 190;

// Label kategori yang boleh tampil; harus sama dengan PETA_KATEGORI di backend.
export const LABEL_KATEGORI_TOPIK = new Set([
  "Agama & Sosial",
  "Bencana & Cuaca",
  "Ekonomi & Bisnis",
  "Hiburan & Gaya Hidup",
  "Internasional",
  "Keamanan & Pertahanan",
  "Kesehatan",
  "Klaim & Pemeriksaan Fakta",
  "Kriminal & Hukum",
  "Lingkungan & Energi",
  "Nasional & Pemerintahan",
  "Olahraga",
  "Pendidikan",
  "Politik",
  "Teknologi & Sains",
  "Topik Umum",
  "Transportasi & Infrastruktur",
]);

// Mengubah tautan halaman Space menjadi domain *.hf.space dan membuang garis miring di akhir.
export function normalisasiUrlApi(urlMentah) {
  const mentah = String(urlMentah || "").trim();
  if (!mentah) return "";
  const m = mentah.match(
    /^https?:\/\/huggingface\.co\/spaces\/([^/?#]+)\/([^/?#]+)$/i,
  );
  if (m) return `https://${m[1].toLowerCase()}-${m[2].toLowerCase()}.hf.space`;
  return mentah.replace(/\/+$/, "");
}

// Urutan sumber alamat backend: parameter ?api=, window.__HOAX_API_BASE_URL__, lalu DEFAULT_API_BASE_URL.
export function tentukanUrlApi() {
  const q =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("api")
      : null;
  const r = typeof window !== "undefined" ? window.__HOAX_API_BASE_URL__ : null;
  return (
    normalisasiUrlApi(q) ||
    normalisasiUrlApi(r) ||
    normalisasiUrlApi(DEFAULT_API_BASE_URL)
  );
}

export const urlApi = tentukanUrlApi();
