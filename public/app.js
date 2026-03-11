const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;

const SAMPLE_TEXT = `Beredar unggahan media sosial yang menyebut pemerintah membagikan bantuan tunai tanpa syarat melalui tautan tertentu. Unggahan tersebut meminta warga mengirim data pribadi dan OTP agar dana cepat cair.

Kementerian terkait lalu mengeluarkan klarifikasi resmi bahwa informasi tersebut tidak benar. Masyarakat diminta mengecek pengumuman hanya dari situs dan akun pemerintah yang terverifikasi.

Pakar keamanan digital juga mengingatkan bahwa tautan serupa sering dipakai untuk phishing. Warga disarankan tidak membagikan pesan berantai sebelum verifikasi sumber.`;

function normalizeApiBaseUrl(rawUrl) {
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
}

function resolveApiBaseUrl() {
  const queryApi =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("api")
      : null;
  const runtimeApi =
    typeof window !== "undefined" ? window.__HOAX_API_BASE_URL__ : null;

  return (
    normalizeApiBaseUrl(queryApi) ||
    normalizeApiBaseUrl(runtimeApi) ||
    normalizeApiBaseUrl(DEFAULT_API_BASE_URL)
  );
}

const apiBaseUrl = resolveApiBaseUrl();

const detectBtn = document.getElementById("detectBtn");
const detectLabel = document.getElementById("detectLabel");
const detectSpinner = document.getElementById("detectSpinner");
const sampleBtn = document.getElementById("sampleBtn");
const resetBtn = document.getElementById("resetBtn");
const newsText = document.getElementById("newsText");

const errorBox = document.getElementById("errorBox");
const outputSection = document.getElementById("outputSection");
const globalSummary = document.getElementById("globalSummary");
const outputParagraphs = document.getElementById("outputParagraphs");
const confidenceDetails = document.getElementById("confidenceDetails");
const confidenceSummary = document.getElementById("confidenceSummary");
const confidenceList = document.getElementById("confidenceList");

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
}

function normalizeInputForBackend(text) {
  const raw = String(text || "").replace(/\r\n?/g, "\n");
  if (!raw.includes("\n")) return raw;
  if (/\n\s*\n/.test(raw)) return raw;
  return raw.replace(/\n+/g, "\n\n");
}

function normalizeLabel(rawLabel) {
  const value = String(rawLabel || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!value) return "unknown";
  if (value.includes("hoax") && !value.includes("not") && !value.includes("non")) {
    return "hoaks";
  }
  if (value.includes("hoaks") && !value.includes("not") && !value.includes("non")) {
    return "hoaks";
  }
  if (
    value.includes("nothoax") ||
    value.includes("nonhoax") ||
    value.includes("fakta") ||
    value.includes("valid")
  ) {
    return "fakta";
  }
  return "unknown";
}

function labelText(normalizedLabel) {
  if (normalizedLabel === "hoaks") return "Hoaks";
  if (normalizedLabel === "fakta") return "Fakta";
  return "Tidak diketahui";
}

function kelasHighlight(label, confidence, cutoff = 0.65) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < cutoff) return "hl--orange";

  const normalized = normalizeLabel(label);
  if (normalized === "hoaks") return "hl--red";
  if (normalized === "fakta") return "hl--green";
  return "hl--orange";
}

function sortBySentenceIndex(sentences) {
  const safeSentences = Array.isArray(sentences) ? [...sentences] : [];
  safeSentences.sort((a, b) => {
    const ai = Number.isFinite(Number(a?.sentence_index)) ? Number(a.sentence_index) : 0;
    const bi = Number.isFinite(Number(b?.sentence_index)) ? Number(b.sentence_index) : 0;
    return ai - bi;
  });
  return safeSentences;
}

function sortByParagraphIndex(paragraphs) {
  const safeParagraphs = Array.isArray(paragraphs) ? [...paragraphs] : [];
  safeParagraphs.sort((a, b) => {
    const ai = Number.isFinite(Number(a?.paragraph_index)) ? Number(a.paragraph_index) : 0;
    const bi = Number.isFinite(Number(b?.paragraph_index)) ? Number(b.paragraph_index) : 0;
    return ai - bi;
  });
  return safeParagraphs;
}

function computeParagraphLabel(sentences, fallbackLabel = "") {
  const safeSentences = Array.isArray(sentences) ? sentences : [];

  const hasHoaxSentence = safeSentences.some(
    (sentence) => normalizeLabel(sentence?.label) === "hoaks"
  );

  if (hasHoaxSentence) return "hoaks";

  if (safeSentences.length === 0 && normalizeLabel(fallbackLabel) === "hoaks") {
    return "hoaks";
  }

  return "fakta";
}

function computeOverallLabel(paragraphs) {
  const safeParagraphs = Array.isArray(paragraphs) ? paragraphs : [];
  const hasHoaxParagraph = safeParagraphs.some((paragraph) => {
    const value = paragraph?.paragraphLabel || paragraph?.label;
    return normalizeLabel(value) === "hoaks";
  });
  return hasHoaxParagraph ? "hoaks" : "fakta";
}

function getSentenceHoaxProbability(sentence) {
  if (Number.isFinite(Number(sentence?.hoax_probability))) {
    return Number(sentence.hoax_probability);
  }

  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.hoax))) return Number(probs.hoax);
  if (Number.isFinite(Number(probs.Hoax))) return Number(probs.Hoax);

  return 0;
}

function getSentenceFaktaProbability(sentence) {
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.not_hoax))) return Number(probs.not_hoax);
  if (Number.isFinite(Number(probs.fakta))) return Number(probs.fakta);

  const pHoax = getSentenceHoaxProbability(sentence);
  return Math.max(0, Math.min(1, 1 - pHoax));
}

function needsSoftSpace(prevRawText, nextRawText) {
  if (!prevRawText || !nextRawText) return false;
  if (/\s$/.test(prevRawText)) return false;
  if (/^\s/.test(nextRawText)) return false;
  if (/^[,.;:!?)]/.test(nextRawText)) return false;
  return true;
}

function joinHighlightedSentences(sentences) {
  const safeSentences = sortBySentenceIndex(sentences);
  const chunks = [];

  safeSentences.forEach((sentence) => {
    const rawText = String(sentence?.text ?? "");
    if (rawText === "") return;

    const normalized = normalizeLabel(sentence?.label);
    const confidence = Number(sentence?.confidence);
    const highlightClass = kelasHighlight(normalized, confidence, 0.65);
    const tooltip = `${labelText(normalized)} | confidence ${formatPercent(confidence)}`;

    chunks.push({
      rawText,
      html: `<span class="hl ${highlightClass}" title="${escapeHtml(tooltip)}">${escapeHtml(
        rawText
      )}</span>`,
    });
  });

  if (chunks.length === 0) return "";

  let html = "";
  for (let i = 0; i < chunks.length; i += 1) {
    const current = chunks[i];
    const previous = i > 0 ? chunks[i - 1] : null;

    if (previous && needsSoftSpace(previous.rawText, current.rawText)) {
      html += " ";
    }
    html += current.html;
  }

  return html;
}

function prepareParagraphModel(paragraphs) {
  const items = [];
  const sortedParagraphs = sortByParagraphIndex(paragraphs);

  let sentenceCount = 0;
  let paragraphHoaks = 0;
  let paragraphFakta = 0;
  let raguSentences = 0;

  sortedParagraphs.forEach((paragraph, index) => {
    const paragraphNumber = Number.isFinite(Number(paragraph?.paragraph_index))
      ? Number(paragraph.paragraph_index) + 1
      : index + 1;

    const sentences = sortBySentenceIndex(paragraph?.sentences);
    const paragraphLabel = computeParagraphLabel(sentences, paragraph?.label);

    if (paragraphLabel === "hoaks") paragraphHoaks += 1;
    else paragraphFakta += 1;

    sentenceCount += sentences.length;
    sentences.forEach((sentence) => {
      const conf = Number(sentence?.confidence);
      if (Number.isFinite(conf) && conf < 0.65) {
        raguSentences += 1;
      }
    });

    const topicLabelRaw = paragraph?.topic?.label;
    const topicLabel =
      typeof topicLabelRaw === "string" && topicLabelRaw.trim() ? topicLabelRaw.trim() : "-";
    const topicScore = Number(paragraph?.topic?.score);

    items.push({
      paragraphNumber,
      paragraphLabel,
      topicLabel,
      topicScore,
      paragraphText: String(paragraph?.text ?? ""),
      sentences,
    });
  });

  const overallLabel = computeOverallLabel(items);

  return {
    items,
    counts: {
      paragraphCount: items.length,
      sentenceCount,
      paragraphHoaks,
      paragraphFakta,
      raguSentences,
    },
    overallLabel,
  };
}

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function setLoading(isLoading) {
  if (!detectBtn || !detectLabel || !detectSpinner) return;

  detectBtn.disabled = isLoading;
  if (sampleBtn) sampleBtn.disabled = isLoading;
  if (resetBtn) resetBtn.disabled = isLoading;

  if (isLoading) {
    detectLabel.textContent = "Mendeteksi...";
    detectSpinner.classList.remove("hidden");
  } else {
    detectLabel.textContent = "Deteksi";
    detectSpinner.classList.add("hidden");
  }
}

function resetOutput() {
  if (outputParagraphs) outputParagraphs.innerHTML = "";
  if (globalSummary) globalSummary.textContent = "";
  if (outputSection) outputSection.classList.add("hidden");

  if (confidenceList) confidenceList.innerHTML = "";
  if (confidenceSummary) confidenceSummary.textContent = "Rincian Keyakinan";
  if (confidenceDetails) {
    confidenceDetails.classList.add("hidden");
    confidenceDetails.open = false;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnalyzeApi(text) {
  if (!apiBaseUrl) throw new Error("API base URL kosong.");

  const endpoint = `${apiBaseUrl}/analyze`;

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      const detail = payload && payload.detail ? payload.detail : response.statusText;
      throw new Error(`Gagal request (${response.status}): ${detail || "Unknown error"}`);
    }

    return payload;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Koneksi timeout saat menghubungi backend.");
    }
    if (err instanceof TypeError) {
      throw new Error("Tidak dapat terhubung ke backend. Periksa URL API dan CORS.");
    }
    throw err;
  }
}

function extractParagraphs(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (!Array.isArray(payload.paragraphs)) return [];
  return payload.paragraphs;
}

function renderOutputInline(paragraphs) {
  if (!outputSection || !outputParagraphs || !globalSummary) {
    return null;
  }

  outputParagraphs.innerHTML = "";

  const model = prepareParagraphModel(paragraphs);

  globalSummary.textContent =
    `Ringkasan: ${labelText(model.overallLabel)} • ${model.counts.paragraphCount} paragraf • ` +
    `${model.counts.sentenceCount} kalimat • Hoaks ${model.counts.paragraphHoaks} • ` +
    `Fakta ${model.counts.paragraphFakta} • Ragu ${model.counts.raguSentences}`;

  if (model.items.length === 0) {
    outputParagraphs.innerHTML =
      '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    outputSection.classList.remove("hidden");
    return model;
  }

  const fragment = document.createDocumentFragment();

  model.items.forEach((item) => {
    const block = document.createElement("article");
    block.className = "paragraph-block";

    const topicScoreText = Number.isFinite(item.topicScore)
      ? ` (skor ${formatPercent(item.topicScore)})`
      : "";

    const meta = document.createElement("p");
    meta.className = "paragraph-meta";
    meta.textContent =
      `Paragraf ${item.paragraphNumber} • Topik: ${item.topicLabel}${topicScoreText} • ` +
      `Label paragraf: ${labelText(item.paragraphLabel)}`;

    const text = document.createElement("p");
    text.className = "paragraph-text";

    const highlighted = joinHighlightedSentences(item.sentences);
    if (highlighted) {
      text.innerHTML = highlighted;
    } else {
      text.innerHTML = escapeHtml(item.paragraphText);
    }

    block.appendChild(meta);
    block.appendChild(text);
    fragment.appendChild(block);
  });

  outputParagraphs.appendChild(fragment);
  outputSection.classList.remove("hidden");

  return model;
}

function renderConfidenceDetails(paragraphs) {
  if (!confidenceDetails || !confidenceSummary || !confidenceList) return;

  const model = prepareParagraphModel(paragraphs);
  const rows = [];

  model.items.forEach((item) => {
    item.sentences.forEach((sentence, sIdx) => {
      const sentenceNumber = Number.isFinite(Number(sentence?.sentence_index))
        ? Number(sentence.sentence_index) + 1
        : sIdx + 1;

      const normalized = normalizeLabel(sentence?.label);
      const conf = Number(sentence?.confidence);
      const pHoax = getSentenceHoaxProbability(sentence);
      const pFakta = getSentenceFaktaProbability(sentence);

      rows.push(
        `P${item.paragraphNumber} S${sentenceNumber} | ${labelText(normalized)} | confidence ${formatPercent(
          conf
        )} | P(hoaks) ${formatPercent(pHoax)} | P(fakta) ${formatPercent(pFakta)}`
      );
    });
  });

  confidenceSummary.textContent =
    `Rincian Keyakinan • ${model.counts.paragraphCount} paragraf • ${model.counts.sentenceCount} kalimat • ` +
    `Hoaks ${model.counts.paragraphHoaks} • Fakta ${model.counts.paragraphFakta} • Ragu ${model.counts.raguSentences}`;

  if (rows.length === 0) {
    confidenceList.innerHTML = "<li>Tidak ada rincian confidence yang tersedia.</li>";
  } else {
    confidenceList.innerHTML = rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("");
  }

  confidenceDetails.classList.remove("hidden");
}

function handleSample() {
  if (!newsText) return;
  newsText.value = SAMPLE_TEXT;
  newsText.focus();
}

function handleReset() {
  if (newsText) newsText.value = "";
  clearError();
  resetOutput();
  if (newsText) newsText.focus();
}

async function handleDetect() {
  clearError();
  resetOutput();

  const rawText = String(newsText?.value || "");
  if (!rawText.trim()) {
    showError("Masukkan teks berita terlebih dahulu.");
    return;
  }

  const textToSend = normalizeInputForBackend(rawText);

  setLoading(true);
  try {
    const payload = await callAnalyzeApi(textToSend);
    const paragraphs = extractParagraphs(payload);

    renderOutputInline(paragraphs);
    renderConfidenceDetails(paragraphs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.";
    showError(msg);
  } finally {
    setLoading(false);
  }
}

if (detectBtn) detectBtn.addEventListener("click", handleDetect);
if (sampleBtn) sampleBtn.addEventListener("click", handleSample);
if (resetBtn) resetBtn.addEventListener("click", handleReset);

if (newsText) {
  newsText.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
      handleDetect();
    }
  });
}
