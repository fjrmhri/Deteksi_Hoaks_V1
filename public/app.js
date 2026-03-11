// =========================
// Konfigurasi API base URL
// =========================

const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;
const API_STORAGE_KEY = "hoax_api_base_url";
const LEGACY_API_BASE_URLS = [
  "https://fjrmhri-indobert-hoax-api.hf.space",
];

const normalizeApiBaseUrl = (rawUrl) => {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";

  const spacePageMatch = raw.match(
    /^https?:\/\/huggingface\.co\/spaces\/([^/?#]+)\/([^/?#]+)$/i
  );
  if (spacePageMatch) {
    const owner = spacePageMatch[1].toLowerCase();
    const space = spacePageMatch[2].toLowerCase();
    return `https://${owner}-${space}.hf.space`;
  }

  return raw.replace(/\/+$/, "");
};

const getSavedApiBaseUrl = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(API_STORAGE_KEY);
  } catch (_) {
    return null;
  }
};

const setSavedApiBaseUrl = (value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(API_STORAGE_KEY, value);
  } catch (_) {
    // ignore storage errors (private mode/quota)
  }
};

const resolveApiBaseUrl = () => {
  const queryApi =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("api")
      : null;
  const runtimeApi =
    typeof window !== "undefined" ? window.__HOAX_API_BASE_URL__ : null;
  const savedApi = getSavedApiBaseUrl();

  const normalizedQueryApi = normalizeApiBaseUrl(queryApi);
  const normalizedRuntimeApi = normalizeApiBaseUrl(runtimeApi);
  const normalizedSavedApi = normalizeApiBaseUrl(savedApi);
  const normalizedDefaultApi = normalizeApiBaseUrl(DEFAULT_API_BASE_URL);

  const shouldMigrateLegacySavedApi = LEGACY_API_BASE_URLS.includes(
    normalizedSavedApi
  );
  const effectiveSavedApi = shouldMigrateLegacySavedApi
    ? normalizedDefaultApi
    : normalizedSavedApi;

  const chosen =
    normalizedQueryApi ||
    normalizedRuntimeApi ||
    effectiveSavedApi ||
    normalizedDefaultApi;

  if (queryApi && typeof window !== "undefined") {
    setSavedApiBaseUrl(chosen);
  } else if (shouldMigrateLegacySavedApi) {
    setSavedApiBaseUrl(normalizedDefaultApi);
  }

  return chosen;
};

const apiBaseUrl = resolveApiBaseUrl();

// Ambil elemen DOM utama
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");
const submitSpinner = document.getElementById("submitSpinner");
const newsText = document.getElementById("newsText");
const loader = document.getElementById("loader");
const sampleBtn = document.getElementById("sampleBtn");
const clearBtn = document.getElementById("clearBtn");
const inputStats = document.getElementById("inputStats");
const statusPanel = document.getElementById("statusPanel");
const resultPanel = document.getElementById("resultPanel");
const resultBadge = document.getElementById("resultBadge");
const resultDecision = document.getElementById("resultDecision");
const resultScore = document.getElementById("resultScore");
const resultSummary = document.getElementById("resultSummary");
const resultRiskExplanation = document.getElementById("resultRiskExplanation");
const sharedTopicsEl = document.getElementById("sharedTopics");
const paragraphResultsEl = document.getElementById("paragraphResults");
const toggleParagraphsBtn = document.getElementById("toggleParagraphsBtn");

const copyBtn = document.getElementById("copyBtn");
const shareBtn = document.getElementById("shareBtn");

let lastResultShareText = "";
let areParagraphsCollapsed = false;
const INPUT_CACHE_KEY = "hoax_input_cache_v1";

const SAMPLE_TEXT = `Beredar unggahan media sosial yang menyebut pemerintah membagikan bantuan tunai tanpa syarat melalui tautan tertentu. Unggahan tersebut meminta warga mengirim data pribadi dan OTP agar dana cepat cair.

Kementerian terkait lalu mengeluarkan klarifikasi resmi bahwa informasi tersebut tidak benar. Masyarakat diminta mengecek pengumuman hanya dari situs dan akun pemerintah yang terverifikasi.

Pakar keamanan digital juga mengingatkan bahwa tautan serupa sering dipakai untuk phishing. Warga disarankan tidak membagikan pesan berantai sebelum verifikasi sumber.`;

// =========================
// Helper: Status UI
// =========================

const setStatus = (message, type = "info") => {
  if (!statusPanel) return;
  statusPanel.textContent = message;
  statusPanel.classList.remove("hidden", "error", "success");
  if (type === "error") statusPanel.classList.add("error");
  if (type === "success") statusPanel.classList.add("success");
};

const clearStatus = () => {
  if (!statusPanel) return;
  statusPanel.textContent = "";
  statusPanel.classList.add("hidden");
  statusPanel.classList.remove("error", "success");
};

const getParagraphCount = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return 0;
  const paragraphs = raw
    .split(/\n\s*\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (paragraphs.length > 0) return paragraphs.length;
  return 1;
};

const getWordCount = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return 0;
  return raw.split(/\s+/).filter(Boolean).length;
};

const updateInputStats = (text) => {
  if (!inputStats) return;
  const content = String(text || "");
  const charCount = content.length;
  const wordCount = getWordCount(content);
  const paragraphCount = getParagraphCount(content);
  inputStats.textContent = `${charCount} karakter • ${wordCount} kata • ${paragraphCount} paragraf`;
};

const saveInputDraft = (text) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INPUT_CACHE_KEY, String(text || ""));
  } catch (_) {
    // ignore storage errors
  }
};

const restoreInputDraft = () => {
  if (typeof window === "undefined" || !newsText) return;
  try {
    const draft = window.localStorage.getItem(INPUT_CACHE_KEY);
    if (draft && !newsText.value) {
      newsText.value = draft;
    }
  } catch (_) {
    // ignore storage errors
  }
  updateInputStats(newsText.value || "");
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const formatPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(2)}%`;
};

// =========================
// Spinner & tombol
// =========================

const setLoading = (isLoading) => {
  if (!submitBtn || !submitSpinner || !submitLabel) return;
  submitBtn.disabled = isLoading;
  if (sampleBtn) sampleBtn.disabled = isLoading;
  if (clearBtn) clearBtn.disabled = isLoading;
  if (loader) loader.classList.toggle("hidden", !isLoading);
  if (isLoading) {
    submitSpinner.classList.remove("hidden");
    submitLabel.textContent = "Memproses...";
  } else {
    submitSpinner.classList.add("hidden");
    submitLabel.textContent = "Analisis sekarang";
  }
};

// =========================
// Cek /health backend
// =========================

async function verifyBackend(url) {
  const base = url.replace(/\/+$/, "");
  const endpoint = `${base}/health`;

  try {
    const res = await fetchWithTimeout(endpoint, { method: "GET" });
    if (!res.ok) throw new Error(`Backend merespons kode ${res.status}`);
    return true;
  } catch (err) {
    console.error("Gagal memverifikasi backend:", err);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timeout saat menghubungi backend /health.");
    }
    if (err instanceof TypeError) {
      throw new Error(
        "Gagal menghubungi backend. Pastikan URL API benar (HTTPS) dan Space aktif."
      );
    }
    throw new Error(err instanceof Error ? err.message : "Tidak dapat terhubung ke backend.");
  }
}

// =========================
// Risk badge
// =========================

const mapRiskToBadge = (riskLevel) => {
  const level = String(riskLevel || "").toLowerCase().trim();
  if (level === "high") {
    return { text: "Hoaks - risiko tinggi", className: "badge badge--high" };
  }
  if (level === "medium") {
    return { text: "Perlu dicek (curiga)", className: "badge badge--medium" };
  }
  if (level === "low") {
    return { text: "Bukan hoaks (cenderung valid)", className: "badge badge--low" };
  }
  return { text: "Risiko tidak diketahui", className: "badge" };
};

const mapSentenceColorClass = (color) => {
  const normalized = String(color || "").toLowerCase().trim();
  if (normalized === "red") return "sentence-item sentence-item--red";
  if (normalized === "amber" || normalized === "orange") {
    return "sentence-item sentence-item--amber";
  }
  return "sentence-item sentence-item--green";
};

const mapLabelText = (label) => {
  const normalized = String(label || "").toLowerCase().trim();
  if (normalized === "hoax") return "Hoaks";
  if (normalized === "not_hoax") return "Bukan hoaks";
  return label || "Tidak diketahui";
};

// =========================
// Render helpers
// =========================

const updateToggleParagraphsBtn = (enabled) => {
  if (!toggleParagraphsBtn) return;
  toggleParagraphsBtn.disabled = !enabled;
  toggleParagraphsBtn.textContent = areParagraphsCollapsed
    ? "Buka semua paragraf"
    : "Tutup semua paragraf";
};

const renderSharedTopics = (sharedTopics) => {
  if (!sharedTopicsEl) return;

  if (!Array.isArray(sharedTopics) || sharedTopics.length === 0) {
    sharedTopicsEl.innerHTML = "";
    sharedTopicsEl.classList.add("hidden");
    return;
  }

  sharedTopicsEl.classList.remove("hidden");
  sharedTopicsEl.innerHTML = "";

  const title = document.createElement("p");
  title.className = "shared-topics__title";
  title.textContent = "Topik bersama antar paragraf:";
  sharedTopicsEl.appendChild(title);

  const row = document.createElement("div");
  row.className = "shared-topics__row";

  sharedTopics.forEach((topic) => {
    const chip = document.createElement("span");
    chip.className = "topic-chip";
    const indices = Array.isArray(topic?.paragraph_indices)
      ? topic.paragraph_indices.map((n) => `P${Number(n) + 1}`).join(", ")
      : "";
    chip.textContent = `${topic?.label || "topik"} (${indices})`;
    row.appendChild(chip);
  });

  sharedTopicsEl.appendChild(row);
};

const renderParagraphs = (paragraphs) => {
  if (!paragraphResultsEl) return;
  paragraphResultsEl.innerHTML = "";
  const fragment = document.createDocumentFragment();

  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Tidak ada paragraf yang dapat dianalisis.";
    fragment.appendChild(empty);
    paragraphResultsEl.appendChild(fragment);
    updateToggleParagraphsBtn(false);
    return;
  }

  paragraphs.forEach((paragraph) => {
    const wrapper = document.createElement("details");
    wrapper.className = "paragraph-card";
    wrapper.open = !areParagraphsCollapsed;

    const header = document.createElement("summary");
    header.className = "paragraph-card__header";

    const title = document.createElement("h3");
    title.className = "paragraph-card__title";
    title.textContent = `Paragraf ${Number(paragraph?.paragraph_index) + 1}`;

    const status = document.createElement("span");
    status.className =
      String(paragraph?.label || "").toLowerCase() === "hoax"
        ? "paragraph-badge paragraph-badge--hoax"
        : "paragraph-badge paragraph-badge--fact";
    status.textContent = mapLabelText(paragraph?.label);

    header.appendChild(title);
    header.appendChild(status);

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "paragraph-card__body";

    const topic = document.createElement("p");
    topic.className = "paragraph-topic";
    const topicLabel = paragraph?.topic?.label || "topik_umum";
    const topicScore = formatPercent(paragraph?.topic?.score || 0);
    topic.textContent = `Topik: ${topicLabel} (skor ${topicScore})`;

    const paragraphMeta = document.createElement("p");
    paragraphMeta.className = "paragraph-meta";
    paragraphMeta.textContent =
      `P(hoaks): ${formatPercent(paragraph?.hoax_probability)} • ` +
      `Confidence: ${formatPercent(paragraph?.confidence)}`;

    const sentenceList = document.createElement("div");
    sentenceList.className = "sentence-list";

    const sentences = Array.isArray(paragraph?.sentences) ? paragraph.sentences : [];
    sentences.forEach((sentence) => {
      const item = document.createElement("div");
      item.className = mapSentenceColorClass(sentence?.color);

      const head = document.createElement("div");
      head.className = "sentence-item__head";
      head.textContent =
        `Kalimat ${Number(sentence?.sentence_index) + 1} • ${mapLabelText(sentence?.label)} • ` +
        `P(hoaks) ${formatPercent(sentence?.hoax_probability)} • ` +
        `Conf ${formatPercent(sentence?.confidence)}`;

      const body = document.createElement("p");
      body.className = "sentence-item__text";
      body.textContent = sentence?.text || "";

      item.appendChild(head);
      item.appendChild(body);
      sentenceList.appendChild(item);
    });

    bodyWrap.appendChild(topic);
    bodyWrap.appendChild(paragraphMeta);
    bodyWrap.appendChild(sentenceList);

    wrapper.appendChild(header);
    wrapper.appendChild(bodyWrap);
    fragment.appendChild(wrapper);
  });

  paragraphResultsEl.appendChild(fragment);
  updateToggleParagraphsBtn(true);
};

// =========================
// Render hasil utama
// =========================

const renderResult = (analysisResult, originalText) => {
  if (
    !resultPanel ||
    !resultBadge ||
    !resultDecision ||
    !resultScore ||
    !resultSummary ||
    !resultRiskExplanation
  ) {
    return;
  }

  const doc = analysisResult.document || {};
  const summary = doc.summary || {};

  const badgeInfo = mapRiskToBadge(doc.risk_level);
  resultBadge.textContent = badgeInfo.text;
  resultBadge.className = badgeInfo.className;

  resultDecision.textContent =
    `Prediksi dokumen: ${mapLabelText(doc.label)} ` +
    `(agregasi kalimat: ${mapLabelText(doc.sentence_aggregate_label)})`;

  resultScore.textContent =
    `P(hoaks dokumen): ${formatPercent(doc.hoax_probability)} • ` +
    `Confidence: ${formatPercent(doc.confidence)}`;

  resultSummary.textContent =
    `Paragraf: ${summary.paragraph_count ?? 0} • ` +
    `Kalimat: ${summary.sentence_count ?? 0} • ` +
    `Hoaks: ${summary.hoax_sentence_count ?? 0} • ` +
    `Bukan hoaks: ${summary.not_hoax_sentence_count ?? 0}`;

  resultRiskExplanation.textContent = doc.risk_explanation || "";

  renderSharedTopics(analysisResult.sharedTopics || []);
  areParagraphsCollapsed = false;
  renderParagraphs(analysisResult.paragraphs || []);

  const paragraphShareLines = (analysisResult.paragraphs || []).map((p) => {
    const topic = p?.topic?.label || "topik_umum";
    const label = mapLabelText(p?.label);
    const hoaxSentences = Array.isArray(p?.sentences)
      ? p.sentences.filter((s) => String(s?.label).toLowerCase() === "hoax").length
      : 0;
    return `- Paragraf ${Number(p?.paragraph_index) + 1}: ${label}, topic=${topic}, kalimat hoaks=${hoaxSentences}`;
  });

  lastResultShareText =
    `Hasil Analisis Hoaks V1\n\n` +
    `${resultDecision.textContent}\n` +
    `${resultBadge.textContent}\n` +
    `${resultScore.textContent}\n` +
    `${resultSummary.textContent}\n\n` +
    `Ringkasan paragraf:\n${paragraphShareLines.join("\n")}\n\n` +
    `Teks berita:\n${originalText}`;

  resultPanel.classList.remove("hidden");
};

// =========================
// API call
// =========================

async function callApi(text) {
  if (!apiBaseUrl) throw new Error("API base URL kosong.");

  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/analyze`;

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      const message =
        (data && data.detail) || response.statusText || "API tidak merespons dengan benar.";
      throw new Error(`API error (${response.status}): ${message}`);
    }

    return data;
  } catch (err) {
    console.error("Gagal memanggil API analyze:", err);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Timeout saat menunggu respons /analyze dari backend.");
    }
    if (err instanceof TypeError) {
      throw new Error(
        "Gagal terhubung ke backend. Pastikan API Hugging Face Space aktif dan mengizinkan CORS."
      );
    }
    throw new Error(err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.");
  }
}

const extractAnalyzeResult = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Respons API kosong atau tidak valid.");
  }

  if (!payload.document || !Array.isArray(payload.paragraphs)) {
    throw new Error("Respons API /analyze tidak sesuai format yang diharapkan.");
  }

  return {
    document: payload.document,
    paragraphs: payload.paragraphs,
    sharedTopics: Array.isArray(payload.shared_topics) ? payload.shared_topics : [],
    meta: payload.meta || {},
  };
};

// =========================
// Copy & Share helpers
// =========================

async function handleCopy() {
  if (!lastResultShareText) {
    setStatus("Belum ada hasil untuk dicopy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(lastResultShareText);
    setStatus("Hasil berhasil disalin ke clipboard.", "success");
  } catch (err) {
    console.error("Gagal copy:", err);
    setStatus("Gagal menyalin ke clipboard.", "error");
  }
}

async function handleShare() {
  if (!lastResultShareText) {
    setStatus("Belum ada hasil untuk dibagikan.", "error");
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: "Hasil Analisis Hoaks", text: lastResultShareText });
    } catch (err) {
      console.error("Share dibatalkan / gagal:", err);
    }
  } else {
    await handleCopy();
  }
}

function handleFillSample() {
  if (!newsText) return;
  newsText.value = SAMPLE_TEXT;
  saveInputDraft(newsText.value);
  updateInputStats(newsText.value);
  newsText.focus();
}

function handleClearInput() {
  if (!newsText) return;
  newsText.value = "";
  saveInputDraft("");
  updateInputStats("");
  clearStatus();
  if (resultPanel) resultPanel.classList.add("hidden");
  updateToggleParagraphsBtn(false);
  newsText.focus();
}

function handleToggleParagraphs() {
  if (!paragraphResultsEl) return;
  const blocks = paragraphResultsEl.querySelectorAll(".paragraph-card");
  if (!blocks.length) return;

  areParagraphsCollapsed = !areParagraphsCollapsed;
  blocks.forEach((block) => {
    block.open = !areParagraphsCollapsed;
  });
  updateToggleParagraphsBtn(true);
}

// =========================
// Handler submit
// =========================

async function handleSubmit() {
  clearStatus();
  if (resultPanel) resultPanel.classList.add("hidden");
  updateToggleParagraphsBtn(false);

  const text = newsText ? newsText.value.trim() : "";
  saveInputDraft(newsText ? newsText.value : "");
  updateInputStats(newsText ? newsText.value : "");
  if (!text) {
    setStatus("Masukkan teks berita terlebih dahulu.", "error");
    return;
  }

  setStatus("Memproses analisis multi-paragraf di backend...", "info");
  setLoading(true);

  try {
    const payload = await callApi(text);
    const analysisResult = extractAnalyzeResult(payload);
    renderResult(analysisResult, text);
    setStatus("Berhasil memuat hasil analisis.", "success");
    if (resultPanel) {
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.", "error");
  } finally {
    setLoading(false);
  }
}

if (submitBtn) submitBtn.addEventListener("click", handleSubmit);
if (sampleBtn) sampleBtn.addEventListener("click", handleFillSample);
if (clearBtn) clearBtn.addEventListener("click", handleClearInput);
if (toggleParagraphsBtn)
  toggleParagraphsBtn.addEventListener("click", handleToggleParagraphs);

if (newsText) {
  newsText.addEventListener("input", () => {
    saveInputDraft(newsText.value);
    updateInputStats(newsText.value);
  });
  newsText.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
      handleSubmit();
    }
  });
}

if (copyBtn) copyBtn.addEventListener("click", handleCopy);
if (shareBtn) shareBtn.addEventListener("click", handleShare);
updateToggleParagraphsBtn(false);
restoreInputDraft();

// =========================
// Inisialisasi awal
// =========================

if (!apiBaseUrl) {
  setStatus("API base URL kosong di app.js.", "error");
  if (submitBtn) submitBtn.disabled = true;
} else {
  setStatus(`Menggunakan backend: ${apiBaseUrl}`, "info");
  verifyBackend(apiBaseUrl)
    .then(() => setStatus(`Tersambung ke backend: ${apiBaseUrl}`, "success"))
    .catch((err) => setStatus(err.message, "error"));
}
