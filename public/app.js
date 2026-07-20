/**
 * Frontend logic untuk aplikasi Deteksi Hoaks Berita.
 *
 * Berkas ini menangani: pemanggilan endpoint /analyze pada backend FastAPI,
 * normalisasi label dan skor probabilitas, segmentasi teks menjadi paragraf
 * dan kalimat di sisi klien, highlight kalimat/paragraf berdasarkan label
 * hoaks-fakta, serta rendering ringkasan verdict dan rincian confidence
 * ke dalam antarmuka index.html.
 */

// ==== Konfigurasi lingkungan & konstanta aplikasi frontend ====
// Nilai-nilai ini mengatur endpoint backend, batas waktu request, ambang
// confidence untuk highlight, dan panjang maksimum teks pada panel detail.
const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;
const CONFIDENCE_CUTOFF = 0.65;
const DETAIL_TEXT_MAX_LEN = 190;

// Daftar putih (whitelist) label kategori topik yang valid ditampilkan di UI,
// harus selaras dengan PETA_KATEGORI pada backend (app.py).
const TOPIC_CATEGORY_LABELS = new Set([
  // [FIX-PC3] Tambah 2 kategori yang sudah ada di PETA_KATEGORI backend
  // ([FIX-PC2]) tapi belum masuk whitelist frontend, sehingga sebelumnya
  // selalu ditolak oleh normalizeTopicCategoryLabel() dan fallback ke
  // topik global.
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

// Merapikan format base URL API: mengonversi tautan Hugging Face Spaces
// menjadi domain *.hf.space dan membuang trailing slash.
function normalizeApiBaseUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  const m = raw.match(
    /^https?:\/\/huggingface\.co\/spaces\/([^/?#]+)\/([^/?#]+)$/i,
  );
  if (m) return `https://${m[1].toLowerCase()}-${m[2].toLowerCase()}.hf.space`;
  return raw.replace(/\/+$/, "");
}

// Menentukan base URL API final: prioritas dari query string ?api=,
// lalu variabel global window.__HOAX_API_BASE_URL__, baru fallback default.
function resolveApiBaseUrl() {
  const q =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("api")
      : null;
  const r = typeof window !== "undefined" ? window.__HOAX_API_BASE_URL__ : null;
  return (
    normalizeApiBaseUrl(q) ||
    normalizeApiBaseUrl(r) ||
    normalizeApiBaseUrl(DEFAULT_API_BASE_URL)
  );
}

// ==== Inisialisasi variabel global: base URL API ====
const apiBaseUrl = resolveApiBaseUrl();

// ==== Inisialisasi variabel global: referensi elemen-elemen DOM ====
const detectBtn = document.getElementById("detectBtn");
const detectLabel = document.getElementById("detectLabel");
const detectSpinner = document.getElementById("detectSpinner");
const resetBtn = document.getElementById("resetBtn");
const newsText = document.getElementById("newsText");
const sentenceLevelToggle = document.getElementById("sentenceLevelToggle");
const topicToggle = document.getElementById("topicToggle");

const statParagraphs = document.getElementById("statParagraphs");
const statSentences = document.getElementById("statSentences");
const statWords = document.getElementById("statWords");

const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const outputSection = document.getElementById("outputSection");
const verdictBanner = document.getElementById("verdictBanner");
const verdictIcon = document.getElementById("verdictIcon");
const verdictLabel = document.getElementById("verdictLabel");
const verdictConf = document.getElementById("verdictConf");
const verdictTopic = document.getElementById("verdictTopic");
const evidenceSection = document.getElementById("evidenceSection");
const evidenceList = document.getElementById("evidenceList");
const globalSummary = document.getElementById("globalSummary");
const outputParagraphs = document.getElementById("outputParagraphs");
const confidenceDetails = document.getElementById("confidenceDetails");
const confidenceSummary = document.getElementById("confidenceSummary");
const confidenceList = document.getElementById("confidenceList");

// Meng-escape karakter HTML agar teks dari pengguna aman disisipkan sebagai innerHTML
function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Memotong teks panjang untuk ditampilkan ringkas pada panel rincian confidence
function truncate(text, maxLen = DETAIL_TEXT_MAX_LEN) {
  const raw = String(text || "").trim();
  return raw.length <= maxLen ? raw : `${raw.slice(0, maxLen - 3)}...`;
}

// Memformat angka probabilitas (0-1) menjadi string persentase 2 desimal
function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
}

// Menormalkan skor topik dari backend (bisa berupa angka 0-1, persen, atau string) ke skala 0-1
function normalizeTopicScore(score) {
  let p = score;
  if (typeof p === "string") {
    p = p.trim().replace(/%/g, "");
    if (!p) return null;
  }
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return n / 100;
  return null;
}

// Membersihkan label topik mentah; label kosong atau '-' dianggap tidak ada
function cleanTopicLabel(rawLabel) {
  const label = String(rawLabel ?? "").trim();
  return !label || label === "-" ? null : label;
}

// Memvalidasi label topik terhadap whitelist TOPIC_CATEGORY_LABELS sebelum ditampilkan
function normalizeTopicCategoryLabel(rawLabel) {
  const label = cleanTopicLabel(rawLabel);
  if (!label) return null;
  if (label === "topik_umum") return "Topik Umum";
  return TOPIC_CATEGORY_LABELS.has(label) ? label : null;
}

// Menyeragamkan karakter newline (CRLF/CR menjadi LF) sebelum diproses
function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

// Memecah teks menjadi paragraf berdasarkan baris kosong (mengikuti aturan backend)
function splitParagraphsByBlankLine(text) {
  return normalizeNewlines(text)
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// Memecah paragraf menjadi kalimat secara heuristik berbasis tanda baca akhir kalimat
function splitSentencesHeuristic(text) {
  const raw = String(text || "");
  const matches = raw.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const cleaned = matches.map((x) => x.trim()).filter((x) => x.length > 0);
  if (cleaned.length > 0) return cleaned;
  const fallback = raw.trim();
  return fallback ? [fallback] : [];
}

// Kumpulan fungsi penghitung statistik input (jumlah paragraf, kalimat, dan kata)
function countParagraphs(text) {
  return splitParagraphsByBlankLine(text).length;
}
function countSentences(text) {
  return splitSentencesHeuristic(text).length;
}
function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

// Memperbarui tampilan ringkasan statistik (paragraf/kalimat/kata) saat pengguna mengetik
function updateInputStats() {
  const text = String(newsText?.value || "");
  if (statParagraphs)
    statParagraphs.textContent = `Paragraf: ${countParagraphs(text)}`;
  if (statSentences)
    statSentences.textContent = `Kalimat: ${countSentences(text)}`;
  if (statWords) statWords.textContent = `Kata: ${countWords(text)}`;
}

// Merapikan jeda antar paragraf pada teks input sebelum dikirim ke backend
function normalizeParagraphBreaks(text) {
  const n = normalizeNewlines(text);
  if (!n.includes("\n")) return n;
  if (/\n\s*\n/.test(n)) return n;
  return n.replace(/\n+/g, "\n\n");
}

// Menormalkan label mentah dari backend ('hoax'/'not_hoax'/dsb.) menjadi 'hoaks' atau 'fakta'
function normalizeLabel(rawLabel) {
  const value = String(rawLabel || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!value) return "unknown";
  if (
    value.includes("hoax") &&
    !value.includes("not") &&
    !value.includes("non")
  )
    return "hoaks";
  if (
    value.includes("hoaks") &&
    !value.includes("not") &&
    !value.includes("non")
  )
    return "hoaks";
  if (
    value.includes("nothoax") ||
    value.includes("nonhoax") ||
    value.includes("fakta") ||
    value.includes("valid")
  )
    return "fakta";
  return "unknown";
}

// Menerjemahkan label kanonik menjadi teks tampilan berbahasa Indonesia
function labelText(n) {
  if (n === "hoaks") return "Hoaks";
  if (n === "fakta") return "Fakta";
  return "Tidak diketahui";
}

// Menentukan class CSS highlight kalimat/paragraf berdasarkan label & confidence
function kelasHighlight(label, confidence) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < CONFIDENCE_CUTOFF) return "hl--orange";
  const n = normalizeLabel(label);
  if (n === "hoaks") return "hl--red";
  if (n === "fakta") return "hl--green";
  return "hl--orange";
}

// Menentukan class CSS badge status (merah/hijau/oranye) pada panel rincian confidence
function badgeClass(label, confidence) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < CONFIDENCE_CUTOFF) return "badge--orange";
  return normalizeLabel(label) === "hoaks" ? "badge--red" : "badge--green";
}

// Menentukan teks badge status ('Hoaks'/'Fakta'/'Ragu') pada panel rincian confidence
function badgeText(label, confidence) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < CONFIDENCE_CUTOFF) return "Ragu";
  return normalizeLabel(label) === "hoaks" ? "Hoaks" : "Fakta";
}

// Mengambil probabilitas hoaks dari objek kalimat, dengan beberapa kemungkinan bentuk payload
function getSentenceHoaxProb(sentence) {
  if (Number.isFinite(Number(sentence?.hoax_probability)))
    return Number(sentence.hoax_probability);
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.hoax))) return Number(probs.hoax);
  return 0;
}

// Mengambil probabilitas fakta dari objek kalimat, fallback ke (1 - probabilitas hoaks)
function getSentenceFaktaProb(sentence) {
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.not_hoax))) return Number(probs.not_hoax);
  return Math.max(0, Math.min(1, 1 - getSentenceHoaxProb(sentence)));
}

// Mengekstrak info topik global (label & skor) dari payload hasil analisis backend
function extractGlobalTopic(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  const tg = safe.topics_global;
  if (tg && typeof tg === "object") {
    const label = cleanTopicLabel(tg.label);
    if (label) return { label, score: normalizeTopicScore(tg.score) };
  }
  if (typeof tg === "string") {
    const label = cleanTopicLabel(tg);
    if (label) return { label, score: null };
  }
  return { label: null, score: null };
}

// Menentukan label topik yang ditampilkan per paragraf, dengan fallback ke topik global
function getParagraphTopicLabel(paragraph, payload) {
  const backendLabel = normalizeTopicCategoryLabel(paragraph?.topic?.label);
  if (backendLabel) return backendLabel;
  const globalLabel = normalizeTopicCategoryLabel(
    extractGlobalTopic(payload).label,
  );
  if (globalLabel) return globalLabel;
  return "Topik Umum";
}

// Menampilkan kotak pesan error ke pengguna
function showError(message) {
  if (!errorBox) return;
  if (errorText) errorText.textContent = message;
  else errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

// Menyembunyikan & mengosongkan kotak pesan error
function clearError() {
  if (!errorBox) return;
  if (errorText) errorText.textContent = "";
  else errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

// Mengatur tampilan tombol deteksi (label & spinner) selama proses analisis berjalan
function setLoading(isLoading) {
  if (!detectBtn || !detectLabel || !detectSpinner) return;
  detectBtn.disabled = isLoading;
  if (resetBtn) resetBtn.disabled = isLoading;
  if (isLoading) {
    detectLabel.textContent = "Menganalisis…";
    detectSpinner.classList.remove("hidden");
  } else {
    detectLabel.textContent = "Analisis Sekarang";
    detectSpinner.classList.add("hidden");
  }
}

// Mengosongkan seluruh area hasil analisis sebelum render ulang
function resetOutput() {
  if (outputParagraphs) outputParagraphs.innerHTML = "";
  if (globalSummary) globalSummary.textContent = "";
  if (outputSection) outputSection.classList.add("hidden");
  if (verdictBanner) verdictBanner.classList.add("hidden");
  if (verdictTopic) verdictTopic.classList.add("hidden");
  if (evidenceSection) evidenceSection.classList.add("hidden");
  if (evidenceList) evidenceList.innerHTML = "";
  if (confidenceList) confidenceList.innerHTML = "";
  if (confidenceSummary)
    confidenceSummary.textContent = "Rincian Keyakinan per Kalimat";
  if (confidenceDetails) {
    confidenceDetails.classList.add("hidden");
    confidenceDetails.open = false;
  }
}

// Merender banner verdict (hoaks/fakta), confidence, dan topik global ke antarmuka
function renderVerdict(payload) {
  if (!verdictBanner || !verdictIcon || !verdictLabel || !verdictConf) return;

  const doc = payload?.document;
  if (!doc) return;

  const pHoax = Number(doc.hoax_probability ?? 0);
  const confidence = Number(doc.confidence ?? Math.max(pHoax, 1 - pHoax));
  const normalized = normalizeLabel(doc.label);
  const isHoaks = normalized === "hoaks";

  verdictBanner.className = `verdict-banner verdict-banner--${isHoaks ? "hoaks" : "fakta"}`;
  verdictIcon.textContent = isHoaks ? "⚠" : "✓";
  verdictLabel.textContent = isHoaks
    ? "Terindikasi Hoaks"
    : "Terindikasi Fakta";
  verdictConf.textContent = `Confidence: ${formatPercent(confidence)} · P(hoaks): ${formatPercent(pHoax)}`;

  if (verdictTopic) {
    const globalTopic = extractGlobalTopic(payload);
    const topicLabel = cleanTopicLabel(globalTopic.label);
    if (topicLabel) {
      verdictTopic.textContent = `Topik: ${topicLabel}`;
      verdictTopic.classList.remove("hidden");
    } else {
      verdictTopic.classList.add("hidden");
    }
  }

  verdictBanner.classList.remove("hidden");
}

// Menentukan class badge berdasarkan verdict artikel evidence ('hoax'/'fakta'/lainnya
// dari backend RAG) -- memakai ulang class badge--merah/hijau/oranye yang sudah ada
// di panel Rincian Keyakinan, supaya konsisten secara visual.
function evidenceBadgeClass(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v === "hoax" || v === "hoaks") return "badge--red";
  if (v === "fakta") return "badge--green";
  return "badge--orange";
}

// Menerjemahkan verdict artikel evidence menjadi teks tampilan berbahasa Indonesia
function evidenceBadgeText(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v === "hoax" || v === "hoaks") return "Hoaks";
  if (v === "fakta") return "Fakta";
  return "Tidak diketahui";
}

// Memformat tanggal artikel evidence (format 'YYYY-MM-DD' dari backend) menjadi
// format singkat berbahasa Indonesia; fallback ke teks mentah bila tidak valid.
function formatEvidenceDate(rawDate) {
  const raw = String(rawDate || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Merender daftar artikel cek-fakta TurnBackHoax yang mirip dengan teks yang
// dianalisis (payload.document.evidence_matches). Otomatis tersembunyi bila
// backend tidak mengembalikan field ini sama sekali (mis. RAG belum aktif)
// atau memang tidak ada artikel yang cukup mirip -- tidak pernah error.
function renderEvidence(payload) {
  if (!evidenceSection || !evidenceList) return;

  const items = Array.isArray(payload?.document?.evidence_matches)
    ? payload.document.evidence_matches
    : [];

  evidenceList.innerHTML = "";

  if (items.length === 0) {
    evidenceSection.classList.add("hidden");
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const title = String(item?.title || "").trim() || "Artikel tanpa judul";
    const url = String(item?.url || "").trim();
    const date = formatEvidenceDate(item?.date);
    const similarity = Number(item?.similarity);

    const li = document.createElement("li");
    li.className = "evidence-item";

    const main = document.createElement("div");
    main.className = "evidence-item__main";

    const link = document.createElement("a");
    link.className = "evidence-item__title";
    link.textContent = title;
    if (url) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    main.appendChild(link);

    const meta = document.createElement("div");
    meta.className = "evidence-item__meta";
    if (date) {
      const dateSpan = document.createElement("span");
      dateSpan.textContent = date;
      meta.appendChild(dateSpan);
    }
    if (Number.isFinite(similarity)) {
      const simSpan = document.createElement("span");
      simSpan.textContent = `Kemiripan ${formatPercent(similarity)}`;
      meta.appendChild(simSpan);
    }
    main.appendChild(meta);

    const badge = document.createElement("span");
    badge.className = `confidence-badge evidence-item__badge ${evidenceBadgeClass(item?.verdict)}`;
    badge.textContent = evidenceBadgeText(item?.verdict);

    li.appendChild(main);
    li.appendChild(badge);
    fragment.appendChild(li);
  });

  evidenceList.appendChild(fragment);
  evidenceSection.classList.remove("hidden");
}

// Melakukan fetch dengan pembatalan otomatis (AbortController) jika melebihi batas waktu
async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Memanggil endpoint /analyze pada backend; otomatis retry dengan skema request lama
// (tanpa parameter tambahan) apabila backend membalas 422 Unprocessable Entity.
async function callAnalyzeApi(text, sentenceLevel, topicPerParagraph) {
  if (!apiBaseUrl) throw new Error("API base URL kosong.");
  const endpoint = `${apiBaseUrl}/analyze`;

  const parsePayload = async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      const detail = payload?.detail || response.statusText;
      throw new Error(
        `Gagal request (${response.status}): ${detail || "Unknown error"}`,
      );
    }
    return payload;
  };

  try {
    let response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        topic_per_paragraph: topicPerParagraph === true,
        sentence_level: sentenceLevel !== false,
      }),
    });
    if (response.status === 422) {
      response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }
    return await parsePayload(response);
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

// Mengurutkan array objek berdasarkan properti index numerik (paragraph_index/sentence_index)
function sortByIndex(arr, key) {
  return [...(Array.isArray(arr) ? arr : [])].sort((a, b) => {
    const ai = Number.isFinite(Number(a?.[key])) ? Number(a[key]) : 0;
    const bi = Number.isFinite(Number(b?.[key])) ? Number(b[key]) : 0;
    return ai - bi;
  });
}

// Membangun model ringkasan jumlah hoaks/fakta/ragu, baik per kalimat maupun per paragraf
function buildSummaryModel(paragraphs, mode) {
  const items = Array.isArray(paragraphs) ? paragraphs : [];
  const sc = { hoaks: 0, fakta: 0, ragu: 0 };
  const pc = { hoaks: 0, fakta: 0, ragu: 0 };

  if (mode === "sentence") {
    items.forEach((item) => {
      const sents = Array.isArray(item?.sentences) ? item.sentences : [];
      let hasH = false,
        hasF = false;
      sents.forEach((s) => {
        const conf = Number(s?.confidence);
        const cat =
          !Number.isFinite(conf) || conf < CONFIDENCE_CUTOFF
            ? "ragu"
            : normalizeLabel(s?.label) === "hoaks"
              ? "hoaks"
              : "fakta";
        sc[cat]++;
        if (cat === "hoaks") hasH = true;
        if (cat === "fakta") hasF = true;
      });
      pc[hasH ? "hoaks" : hasF ? "fakta" : "ragu"]++;
    });
  } else {
    items.forEach((item) => {
      const s =
        Array.isArray(item?.sentences) && item.sentences.length > 0
          ? item.sentences[0]
          : null;
      const conf = Number(s?.confidence);
      const cat =
        !Number.isFinite(conf) || conf < CONFIDENCE_CUTOFF
          ? "ragu"
          : normalizeLabel(s?.label) === "hoaks"
            ? "hoaks"
            : "fakta";
      pc[cat]++;
    });
  }

  return {
    mode,
    sc,
    pc,
    total_s: sc.hoaks + sc.fakta + sc.ragu,
    total_p: items.length,
  };
}

// Membangun markup teks ringkasan global dari model ringkasan (buildSummaryModel)
function buildSummaryMarkup(sm) {
  const lines = [];
  if (sm.mode === "sentence") {
    lines.push(
      `Kalimat: ${sm.total_s} total · ${sm.sc.hoaks} hoaks · ${sm.sc.fakta} fakta · ${sm.sc.ragu} ragu`,
    );
    lines.push(
      `Paragraf: ${sm.total_p} total · ${sm.pc.hoaks} hoaks · ${sm.pc.fakta} fakta · ${sm.pc.ragu} ragu`,
    );
  } else {
    lines.push(
      `Paragraf: ${sm.total_p} total · ${sm.pc.hoaks} hoaks · ${sm.pc.fakta} fakta · ${sm.pc.ragu} ragu`,
    );
  }
  return lines.map((l) => escapeHtml(l)).join("<br>");
}

// Fallback: memetakan ulang kalimat ke paragraf sesuai input asli pengguna,
// dipakai saat backend menggabungkan seluruh teks menjadi satu paragraf saja.
function buildFallbackParagraphs(backendParagraphs, inputText) {
  const inputPars = splitParagraphsByBlankLine(inputText);
  const sorted = sortByIndex(backendParagraphs, "paragraph_index");
  if (inputPars.length <= 1 || sorted.length !== 1) return sorted;

  const src = sorted[0] || {};
  const sents = sortByIndex(src.sentences, "sentence_index");
  const est = inputPars.map((pt) => splitSentencesHeuristic(pt).length);
  const rebuilt = [];
  let cursor = 0;

  for (let i = 0; i < inputPars.length; i++) {
    const remaining = inputPars.length - i;
    const remSents = sents.length - cursor;
    let take = est[i] || 0;
    if (i === inputPars.length - 1) {
      take = Math.max(0, remSents);
    } else {
      const reserve = Math.max(0, remaining - 1);
      const maxAllow = Math.max(0, remSents - reserve);
      if (take > maxAllow) take = maxAllow;
      if (take <= 0 && maxAllow > 0) take = 1;
    }
    const slice = sents
      .slice(cursor, cursor + take)
      .map((s, li) => ({ ...s, sentence_index: li }));
    cursor += take;
    rebuilt.push({
      paragraph_index: i,
      text: inputPars[i],
      topic: null,
      sentences: slice,
    });
  }
  if (cursor < sents.length && rebuilt.length > 0) {
    const leftovers = sents.slice(cursor);
    const last = rebuilt[rebuilt.length - 1];
    last.sentences = [...last.sentences, ...leftovers].map((s, i) => ({
      ...s,
      sentence_index: i,
    }));
  }
  return rebuilt;
}

// Mengambil daftar paragraf final (dengan fallback) yang siap dirender ke UI
function extractParagraphs(payload, inputText) {
  if (!payload || !Array.isArray(payload.paragraphs)) return [];
  return buildFallbackParagraphs(payload.paragraphs, inputText);
}

// Menentukan perlu-tidaknya spasi penyambung saat kalimat-kalimat digabung kembali
function needsSoftSpace(prev, curr) {
  if (!prev || !curr) return false;
  if (/\s$/.test(prev) || /^\s/.test(curr)) return false;
  if (/^[,.;:!?)]/.test(curr)) return false;
  return true;
}

// Menggabungkan kalimat-kalimat menjadi satu string HTML dengan highlight per label
function joinHighlighted(sentences) {
  const ordered = sortByIndex(sentences, "sentence_index");
  const chunks = [];
  ordered.forEach((sentence) => {
    const raw = String(sentence?.text ?? "");
    if (!raw) return;
    const normalized = normalizeLabel(sentence?.label);
    const confidence = Number(sentence?.confidence);
    const hlClass = kelasHighlight(normalized, confidence);
    const title = `${labelText(normalized)} · confidence ${formatPercent(confidence)}`;
    chunks.push({
      rawText: raw,
      html: `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(raw)}</span>`,
    });
  });
  if (chunks.length === 0) return "";
  let html = "";
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0 && needsSoftSpace(chunks[i - 1].rawText, chunks[i].rawText))
      html += " ";
    html += chunks[i].html;
  }
  return html;
}

// Merender seluruh paragraf hasil analisis (highlight kalimat/paragraf & info topik) ke UI
function renderOutput(payload, paragraphs, sentenceLevel, topicPerParagraph) {
  if (!outputSection || !outputParagraphs || !globalSummary) return null;
  outputParagraphs.innerHTML = "";

  const mode = sentenceLevel ? "sentence" : "paragraph";
  const sm = buildSummaryModel(paragraphs, mode);

  globalSummary.innerHTML = buildSummaryMarkup(sm);

  if (paragraphs.length === 0) {
    outputParagraphs.innerHTML =
      '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    outputSection.classList.remove("hidden");
    return sm;
  }

  const sorted = sortByIndex(paragraphs, "paragraph_index");
  const fragment = document.createDocumentFragment();

  sorted.forEach((paragraph, index) => {
    const pNum = Number.isFinite(Number(paragraph?.paragraph_index))
      ? Number(paragraph.paragraph_index) + 1
      : index + 1;
    const sents = sortByIndex(paragraph?.sentences, "sentence_index");
    const pText = String(paragraph?.text ?? "");

    const block = document.createElement("article");
    block.className = "paragraph-block";

    const text = document.createElement("p");
    text.className = "paragraph-text";

    if (sentenceLevel) {
      const hl = joinHighlighted(sents);
      text.innerHTML = hl || escapeHtml(pText);
    } else {
      const s = sents[0] || null;
      if (s) {
        const norm = normalizeLabel(s?.label);
        const conf = Number(s?.confidence);
        const hlClass = kelasHighlight(norm, conf);
        const title = `${labelText(norm)} · confidence ${formatPercent(conf)}`;
        text.innerHTML = `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(pText)}</span>`;
      } else {
        text.innerHTML = escapeHtml(pText);
      }
    }

    if (topicPerParagraph) {
      const topicLabel = getParagraphTopicLabel(paragraph, payload);
      const meta = document.createElement("p");
      meta.className = "paragraph-meta";
      meta.textContent = topicLabel
        ? `Paragraf ${pNum} · Topik: ${topicLabel}`
        : `Paragraf ${pNum} · Topik belum tersedia`;
      block.appendChild(meta);
    }

    block.appendChild(text);
    fragment.appendChild(block);
  });

  outputParagraphs.appendChild(fragment);
  outputSection.classList.remove("hidden");
  return sm;
}

// Merender panel rincian confidence per kalimat atau per paragraf
function renderConfidence(paragraphs, sentenceLevel, sm) {
  if (!confidenceDetails || !confidenceSummary || !confidenceList) return;

  const mode = sentenceLevel ? "sentence" : "paragraph";
  const summaryModel = sm || buildSummaryModel(paragraphs, mode);

  if (sentenceLevel) {
    confidenceSummary.textContent = `Rincian Keyakinan · ${summaryModel.total_s} kalimat`;
  } else {
    confidenceSummary.textContent = `Rincian Keyakinan · ${summaryModel.total_p} paragraf`;
  }

  confidenceList.innerHTML = "";
  const sorted = sortByIndex(paragraphs, "paragraph_index");
  const fragment = document.createDocumentFragment();

  if (sentenceLevel) {
    sorted.forEach((item, idx) => {
      const pNum = Number.isFinite(Number(item?.paragraph_index))
        ? Number(item.paragraph_index) + 1
        : idx + 1;
      sortByIndex(item?.sentences, "sentence_index").forEach(
        (sentence, sIdx) => {
          const sNum = Number.isFinite(Number(sentence?.sentence_index))
            ? Number(sentence.sentence_index) + 1
            : sIdx + 1;
          const conf = Number(sentence?.confidence);
          const pHoax = getSentenceHoaxProb(sentence);
          const pFakta = getSentenceFaktaProb(sentence);
          const fullText = String(sentence?.text ?? "").trim();
          const shortText = truncate(fullText);

          const li = document.createElement("li");
          li.className = "confidence-item";
          li.title = fullText || "(teks kosong)";

          const head = document.createElement("div");
          head.className = "confidence-head";
          const pos = document.createElement("span");
          pos.className = "confidence-pos";
          pos.textContent = `P${pNum} S${sNum}`;
          const badge = document.createElement("span");
          badge.className = `confidence-badge ${badgeClass(sentence?.label, conf)}`;
          badge.textContent = badgeText(sentence?.label, conf);
          head.appendChild(pos);
          head.appendChild(badge);

          const metrics = document.createElement("div");
          metrics.className = "confidence-metrics";
          [
            [`Conf ${formatPercent(conf)}`, ""],
            [`P(hoaks) ${formatPercent(pHoax)}`, "--red"],
            [`P(fakta) ${formatPercent(pFakta)}`, "--green"],
          ].forEach(([text]) => {
            const span = document.createElement("span");
            span.className = "confidence-metric";
            span.textContent = text;
            metrics.appendChild(span);
          });

          const sentText = document.createElement("p");
          sentText.className = "confidence-text";
          sentText.textContent = shortText || "(teks kosong)";

          li.appendChild(head);
          li.appendChild(metrics);
          li.appendChild(sentText);
          fragment.appendChild(li);
        },
      );
    });
  } else {
    sorted.forEach((item, idx) => {
      const pNum = Number.isFinite(Number(item?.paragraph_index))
        ? Number(item.paragraph_index) + 1
        : idx + 1;
      const s =
        Array.isArray(item?.sentences) && item.sentences.length > 0
          ? item.sentences[0]
          : {};
      const conf = Number(s?.confidence);
      const pHoax = getSentenceHoaxProb(s);
      const pFakta = getSentenceFaktaProb(s);
      const fullText = String(item?.text || s?.text || "").trim();
      const shortText = truncate(fullText);

      const li = document.createElement("li");
      li.className = "confidence-item";
      li.title = fullText || "(teks kosong)";

      const head = document.createElement("div");
      head.className = "confidence-head";
      const pos = document.createElement("span");
      pos.className = "confidence-pos";
      pos.textContent = `P${pNum}`;
      const badge = document.createElement("span");
      badge.className = `confidence-badge ${badgeClass(s?.label, conf)}`;
      badge.textContent = badgeText(s?.label, conf);
      head.appendChild(pos);
      head.appendChild(badge);

      const metrics = document.createElement("div");
      metrics.className = "confidence-metrics";
      [
        `Conf ${formatPercent(conf)}`,
        `P(hoaks) ${formatPercent(pHoax)}`,
        `P(fakta) ${formatPercent(pFakta)}`,
      ].forEach((t) => {
        const span = document.createElement("span");
        span.className = "confidence-metric";
        span.textContent = t;
        metrics.appendChild(span);
      });

      const paraText = document.createElement("p");
      paraText.className = "confidence-text";
      paraText.textContent = shortText || "(teks kosong)";

      li.appendChild(head);
      li.appendChild(metrics);
      li.appendChild(paraText);
      fragment.appendChild(li);
    });
  }

  if (fragment.childNodes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tidak ada rincian confidence yang tersedia.";
    fragment.appendChild(li);
  }
  confidenceList.appendChild(fragment);
  confidenceDetails.classList.remove("hidden");
}

// Handler tombol reset: mengosongkan input teks & seluruh hasil analisis di layar
function handleReset() {
  if (newsText) newsText.value = "";
  clearError();
  resetOutput();
  updateInputStats();
  if (newsText) newsText.focus();
}

// Handler tombol deteksi: memvalidasi input, memanggil backend, lalu merender seluruh hasil
async function handleDetect() {
  clearError();
  resetOutput();

  const text = String(newsText?.value || "");
  if (!text.trim()) {
    showError("Masukkan teks berita terlebih dahulu.");
    return;
  }

  const textToSend = normalizeParagraphBreaks(text);
  const sentenceLevel = sentenceLevelToggle
    ? Boolean(sentenceLevelToggle.checked)
    : true;
  const topicPerParagraph = topicToggle ? Boolean(topicToggle.checked) : false;

  setLoading(true);
  try {
    const payload = await callAnalyzeApi(
      textToSend,
      sentenceLevel,
      topicPerParagraph,
    );
    renderVerdict(payload);
    renderEvidence(payload);

    const paragraphs = extractParagraphs(payload, textToSend);
    const sm = renderOutput(
      payload,
      paragraphs,
      sentenceLevel,
      topicPerParagraph,
    );
    renderConfidence(paragraphs, sentenceLevel, sm);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.";
    showError(msg);
  } finally {
    setLoading(false);
  }
}

// ==== Pendaftaran event listener utama (tombol aksi & input teks) ====
if (detectBtn) detectBtn.addEventListener("click", handleDetect);
if (resetBtn) resetBtn.addEventListener("click", handleReset);

if (newsText) {
  newsText.addEventListener("input", updateInputStats);
  newsText.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
      handleDetect();
    }
  });
}

// Inisialisasi awal: tampilkan statistik input begitu halaman selesai dimuat
updateInputStats();
