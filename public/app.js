/**
 * app.js — v2.0.0
 * Changelog:
 *   [FIX-JS-1] Hapus topicModelSelect (tidak ada di HTML) — tidak ada lagi
 *              referensi ke dropdown topic model.
 *   [FIX-JS-2] resolveActiveTopicModel selalu kembalikan "bertopic".
 *   [FIX-JS-3] callAnalyzeApi hapus parameter topicModel.
 *   [FIX-JS-4] handleDetect hapus topicModel variable.
 *   [FIX-JS-5] Hapus referensi LDA dari topicModelLabel.
 *   [FIX-JS-6] summaryExtraLines langsung hardcode "BERTopic".
 */

const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;
const CONFIDENCE_CUTOFF = 0.65;
const DETAIL_TEXT_MAX_LEN = 190;
const isDebug =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "1";

const ID_STOPWORDS = new Set([
  "yang","dan","di","ke","dari","untuk","dengan","pada","adalah","itu","ini",
  "tersebut","atau","karena","agar","juga","dalam","sebagai","oleh","bahwa",
  "namun","tetapi","saat","ketika","setelah","sebelum","tanpa","sudah","belum",
  "masih","akan","bisa","dapat","harus","lebih","kurang","hanya","hingga",
  "sampai","jadi","yakni","yaitu","ialah","para","kami","kita","saya","aku",
  "anda","mereka","dia","ia","maka","pun","lah","kah","nya","sebuah","seorang",
  "beberapa","banyak","semua","tiap","setiap","antara","tentang","dalamnya",
  "atas","bawah","secara","langsung","tidak","bukan","ya","iya","nah","si",
  "sang","sehingga","supaya","serta","lagi","pula","telah","sedang","menjadi",
  "terjadi","terhadap","menurut","seperti","bagi","guna","demi","apa","siapa",
  "mana","kapan","mengapa","bagaimana","dll","dsb","yak","oke","ok",
]);

function normalizeApiBaseUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  const spacePageMatch = raw.match(
    /^https?:\/\/huggingface\.co\/spaces\/([^/?#]+)\/([^/?#]+)$/i,
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
let lastPayload = null;

const detectBtn             = document.getElementById("detectBtn");
const detectLabel           = document.getElementById("detectLabel");
const detectSpinner         = document.getElementById("detectSpinner");
const resetBtn              = document.getElementById("resetBtn");
const newsText              = document.getElementById("newsText");
const sentenceLevelToggle   = document.getElementById("sentenceLevelToggle");
const topicPerParagraphToggle = document.getElementById("topicToggle");

const analysisInfoBar = document.getElementById("analysisInfoBar");
const infoThreshold   = document.getElementById("infoThreshold");
const infoTopicModel  = document.getElementById("infoTopicModel");

const statParagraphs = document.getElementById("statParagraphs");
const statSentences  = document.getElementById("statSentences");
const statWords      = document.getElementById("statWords");

const errorBox           = document.getElementById("errorBox");
const outputSection      = document.getElementById("outputSection");
const globalSummary      = document.getElementById("globalSummary");
const outputParagraphs   = document.getElementById("outputParagraphs");
const confidenceDetails  = document.getElementById("confidenceDetails");
const confidenceSummary  = document.getElementById("confidenceSummary");
const confidenceList     = document.getElementById("confidenceList");

// =========================
// Util
// =========================

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(text, maxLen = DETAIL_TEXT_MAX_LEN) {
  const raw = String(text || "").trim();
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen - 3)}...`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
}

function normalizeTopicScore(score) {
  let parsed = score;
  if (typeof parsed === "string") {
    const cleaned = parsed.trim().replace(/%/g, "");
    if (!cleaned) return null;
    parsed = cleaned;
  }
  const n = Number(parsed);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return n / 100;
  return null;
}

// [FIX-JS-2] Topic model selalu BERTopic — tidak ada dropdown pilihan
function resolveActiveTopicModel() {
  return "bertopic";
}

function cleanTopicLabel(rawLabel) {
  const label = String(rawLabel ?? "").trim();
  if (!label || label === "-") return null;
  return label;
}

function firstTopicLabel(...candidates) {
  for (const candidate of candidates) {
    const label = cleanTopicLabel(candidate);
    if (label) return label;
  }
  return null;
}

function firstTopicScore(...candidates) {
  for (const candidate of candidates) {
    const score = normalizeTopicScore(candidate);
    if (score !== null) return score;
  }
  return null;
}

function extractTopicFromObject(topicLike) {
  if (!topicLike || typeof topicLike !== "object") {
    return { label: null, score: null };
  }
  const label = firstTopicLabel(
    topicLike.label, topicLike.topic_label, topicLike.topic,
    topicLike.name, topicLike.topicName, topicLike.topicLabel,
  );
  if (!label) return { label: null, score: null };
  const score = firstTopicScore(
    topicLike.score, topicLike.probability, topicLike.topic_score,
    topicLike.topic_probability, topicLike.topicScore, topicLike.topicProbability,
    topicLike.confidence, topicLike.conf, topicLike.prob, topicLike.pct, topicLike.topicProb,
  );
  return { label, score };
}

function extractTopicFromParagraph(paragraph) {
  const safe = paragraph && typeof paragraph === "object" ? paragraph : {};

  if (safe.topic && typeof safe.topic === "object") {
    const rawLabel = typeof safe.topic.label === "string" ? safe.topic.label.trim() : "";
    if (rawLabel) {
      return { label: rawLabel, score: normalizeTopicScore(safe.topic.score) };
    }
    const topicObject = extractTopicFromObject({
      label: safe.topic.label, score: safe.topic.score, probability: safe.topic.probability,
    });
    if (topicObject.label) return topicObject;
  } else if (typeof safe.topic === "string") {
    const label = cleanTopicLabel(safe.topic);
    if (label) return { label, score: null };
  }

  const flatLabel = firstTopicLabel(safe.topic_label, safe.topicLabel);
  if (flatLabel) {
    return {
      label: flatLabel,
      score: firstTopicScore(safe.topic_score, safe.topic_probability, safe.topicProb),
    };
  }

  return { label: null, score: null };
}

function extractGlobalTopic(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};
  const topicsGlobal = safe.topics_global;

  if (typeof topicsGlobal === "string") {
    const label = cleanTopicLabel(topicsGlobal);
    if (label) return { label, score: null };
  }
  if (topicsGlobal && typeof topicsGlobal === "object") {
    const direct = extractTopicFromObject(topicsGlobal);
    if (direct.label) return direct;
  }

  if (typeof safe.topic === "string") {
    const label = cleanTopicLabel(safe.topic);
    if (label) return { label, score: null };
  }
  if (safe.topic && typeof safe.topic === "object") {
    const fromTopicObject = extractTopicFromObject(safe.topic);
    if (fromTopicObject.label) return fromTopicObject;
  }

  const topicLabel = firstTopicLabel(safe.topic_label, safe.topicLabel);
  if (topicLabel) {
    return {
      label: topicLabel,
      score: firstTopicScore(safe.topic_score, safe.topic_probability),
    };
  }

  return { label: null, score: null };
}

function formatTopicMeta(label, score) {
  const safeLabel = cleanTopicLabel(label);
  if (!safeLabel) return "Topik: -";
  const normalizedScore = normalizeTopicScore(score);
  if (normalizedScore !== null && normalizedScore > 0) {
    return `Topik: ${safeLabel} (skor ${formatPercent(normalizedScore)})`;
  }
  return `Topik: ${safeLabel}`;
}

function inferTopicLocal(paragraphText) {
  const raw = String(paragraphText || "").toLowerCase();
  if (!raw.trim()) return { label: null, score: null };
  const cleaned = raw.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { label: null, score: null };
  const tokens = cleaned.split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !ID_STOPWORDS.has(t));
  if (tokens.length === 0) return { label: null, score: null };
  const freq = new Map();
  tokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));
  const ranked = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return { label: null, score: null };
  const top1 = ranked[0];
  const top2 = ranked[1];
  const label = top2 ? `${top1[0]} / ${top2[0]}` : top1[0];
  const score = Math.max(0, Math.min(1, top1[1] / tokens.length));
  return { label, score: Number.isFinite(score) && score > 0 ? score : null };
}

function resolveParagraphTopic(paragraph, globalTopic, paragraphText, isFallback) {
  const backendTopic = extractTopicFromParagraph(paragraph);
  const backendLabel = cleanTopicLabel(backendTopic?.label);
  if (backendLabel) {
    return { label: backendLabel, score: normalizeTopicScore(backendTopic?.score) };
  }
  if (isFallback) {
    const localTopic = inferTopicLocal(paragraphText);
    const localLabel = cleanTopicLabel(localTopic?.label);
    if (localLabel) {
      return { label: localLabel, score: normalizeTopicScore(localTopic?.score) };
    }
  }
  const globalLabel = cleanTopicLabel(globalTopic?.label);
  if (globalLabel) {
    return { label: globalLabel, score: normalizeTopicScore(globalTopic?.score) };
  }
  return { label: null, score: null };
}

function debugTopicSnippet(payload) {
  const paragraph0 =
    payload && Array.isArray(payload.paragraphs) && payload.paragraphs.length > 0
      ? payload.paragraphs[0] : null;
  const candidate =
    payload?.topics_global || payload?.topic_info || paragraph0?.topic || null;
  try {
    const raw = JSON.stringify(candidate, null, 2);
    if (!raw) return "null";
    return raw.length > 1800 ? `${raw.slice(0, 1800)}\n...` : raw;
  } catch (_err) {
    return "[topic snippet tidak bisa di-serialize]";
  }
}

function getDebugBox() {
  if (!outputSection || !globalSummary || !isDebug) return null;
  let box = document.getElementById("debugBox");
  if (!box) {
    box = document.createElement("pre");
    box.id = "debugBox";
    box.className = "debug-box";
    globalSummary.insertAdjacentElement("afterend", box);
  }
  return box;
}

function clearDebugBox() {
  const existing = document.getElementById("debugBox");
  if (existing) existing.remove();
}

function renderTopicDebug(payload, globalTopic, model, options = {}) {
  if (!isDebug) { clearDebugBox(); return; }
  const box = getDebugBox();
  if (!box) return;
  const topKeys = payload && typeof payload === "object"
    ? Object.keys(payload).sort().slice(0, 80) : [];
  const metaTopicModel = payload?.meta?.topic_model_used || "bertopic";
  box.textContent = [
    "[DEBUG topic]",
    `isFallback=${Boolean(options?.isFallback)}`,
    `topic_model_used (meta): ${metaTopicModel}`,
    `threshold_used (meta): ${payload?.meta?.threshold_used ?? "null"}`,
    `payload keys: ${topKeys.join(", ") || "-"}`,
    "topic snippet:", debugTopicSnippet(payload),
  ].join("\n");
}

// =========================
// Text utilities
// =========================

function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function splitParagraphsByBlankLine(text) {
  return normalizeNewlines(text).split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
}

function splitSentencesHeuristic(text) {
  const raw = String(text || "");
  const matches = raw.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const cleaned = matches.map((x) => x.trim()).filter((x) => x.length > 0);
  if (cleaned.length > 0) return cleaned;
  const fallback = raw.trim();
  return fallback ? [fallback] : [];
}

function countParagraphs(text) { return splitParagraphsByBlankLine(text).length; }
function countSentences(text) { return splitSentencesHeuristic(text).length; }
function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function updateInputStats() {
  const text = String(newsText?.value || "");
  if (statParagraphs) statParagraphs.textContent = `Paragraf: ${countParagraphs(text)}`;
  if (statSentences)  statSentences.textContent  = `Kalimat: ${countSentences(text)}`;
  if (statWords)      statWords.textContent      = `Kata: ${countWords(text)}`;
}

function normalizeParagraphBreaks(text) {
  const normalized = normalizeNewlines(text);
  if (!normalized.includes("\n")) return normalized;
  if (/\n\s*\n/.test(normalized)) return normalized;
  return normalized.replace(/\n+/g, "\n\n");
}

// =========================
// Label normalization
// =========================

function normalizeLabel(rawLabel) {
  const value = String(rawLabel || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!value) return "unknown";
  if (value.includes("hoax") && !value.includes("not") && !value.includes("non")) return "hoaks";
  if (value.includes("hoaks") && !value.includes("not") && !value.includes("non")) return "hoaks";
  if (value.includes("nothoax") || value.includes("nonhoax") ||
      value.includes("fakta") || value.includes("valid")) return "fakta";
  return "unknown";
}

function labelText(normalizedLabel) {
  if (normalizedLabel === "hoaks") return "Hoaks";
  if (normalizedLabel === "fakta") return "Fakta";
  return "Tidak diketahui";
}

function kelasHighlight(label, confidence, cutoff = CONFIDENCE_CUTOFF) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < cutoff) return "hl--orange";
  const normalized = normalizeLabel(label);
  if (normalized === "hoaks") return "hl--red";
  if (normalized === "fakta") return "hl--green";
  return "hl--orange";
}

function badgeClass(label, confidence, cutoff = CONFIDENCE_CUTOFF) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < cutoff) return "badge--orange";
  return normalizeLabel(label) === "hoaks" ? "badge--red" : "badge--green";
}

function badgeText(label, confidence, cutoff = CONFIDENCE_CUTOFF) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < cutoff) return "Ragu";
  return normalizeLabel(label) === "hoaks" ? "Hoaks" : "Fakta";
}

function getSentenceHoaxProbability(sentence) {
  if (Number.isFinite(Number(sentence?.hoax_probability))) return Number(sentence.hoax_probability);
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.hoax))) return Number(probs.hoax);
  return 0;
}

function getSentenceFaktaProbability(sentence) {
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.not_hoax))) return Number(probs.not_hoax);
  return Math.max(0, Math.min(1, 1 - getSentenceHoaxProbability(sentence)));
}

// =========================
// UI state
// =========================

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
  if (globalSummary)    globalSummary.textContent  = "";
  if (outputSection)    outputSection.classList.add("hidden");
  clearDebugBox();
  if (analysisInfoBar) analysisInfoBar.classList.add("hidden");
  if (confidenceList)  confidenceList.innerHTML = "";
  if (confidenceSummary) confidenceSummary.textContent = "Rincian Keyakinan";
  if (confidenceDetails) {
    confidenceDetails.classList.add("hidden");
    confidenceDetails.open = false;
  }
}

// =========================
// API call — [FIX-JS-3] hapus topicModel parameter
// =========================

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnalyzeApi(text, topicPerParagraph, sentenceLevel) {
  if (!apiBaseUrl) throw new Error("API base URL kosong.");
  const endpoint = `${apiBaseUrl}/analyze`;

  const parsePayload = async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      const detail = payload?.detail || response.statusText;
      throw new Error(`Gagal request (${response.status}): ${detail || "Unknown error"}`);
    }
    return payload;
  };

  try {
    let response = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        topic_per_paragraph: Boolean(topicPerParagraph),
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
      throw new Error("Tidak dapat terhubung ke backend. Periksa URL API dan CORS.");
    }
    throw err;
  }
}

// =========================
// Paragraph/sentence model
// =========================

function sortByParagraphIndex(paragraphs) {
  const safe = Array.isArray(paragraphs) ? [...paragraphs] : [];
  return safe.sort((a, b) => {
    const ai = Number.isFinite(Number(a?.paragraph_index)) ? Number(a.paragraph_index) : 0;
    const bi = Number.isFinite(Number(b?.paragraph_index)) ? Number(b.paragraph_index) : 0;
    return ai - bi;
  });
}

function sortBySentenceIndex(sentences) {
  const safe = Array.isArray(sentences) ? [...sentences] : [];
  return safe.sort((a, b) => {
    const ai = Number.isFinite(Number(a?.sentence_index)) ? Number(a.sentence_index) : 0;
    const bi = Number.isFinite(Number(b?.sentence_index)) ? Number(b.sentence_index) : 0;
    return ai - bi;
  });
}

function computeParagraphLabel(sentences) {
  const safe = Array.isArray(sentences) ? sentences : [];
  const hoaxCount = safe.filter((s) => normalizeLabel(s?.label) === "hoaks").length;
  return hoaxCount > safe.length / 2 ? "hoaks" : "fakta";
}

function computeOverallLabel(paragraphs) {
  const safe = Array.isArray(paragraphs) ? paragraphs : [];
  const hoaxCount = safe.filter((p) => normalizeLabel(p?.paragraphLabel) === "hoaks").length;
  return hoaxCount > safe.length / 2 ? "hoaks" : "fakta";
}

function getUnitCategory(label, confidence, cutoff = CONFIDENCE_CUTOFF) {
  const conf = Number(confidence);
  if (!Number.isFinite(conf) || conf < cutoff) return "ragu";
  return normalizeLabel(label) === "hoaks" ? "hoaks" : "fakta";
}

function buildSummaryModel(paragraphModels, mode, cutoff = CONFIDENCE_CUTOFF) {
  const items = Array.isArray(paragraphModels) ? paragraphModels : [];
  const sentenceCounts  = { hoaks: 0, fakta: 0, ragu: 0 };
  const paragraphCounts = { hoaks: 0, fakta: 0, ragu: 0 };

  if (mode === "sentence") {
    items.forEach((item) => {
      const sentences = Array.isArray(item?.sentences) ? item.sentences : [];
      let hasHoaks = false; let hasFakta = false;
      sentences.forEach((sentence) => {
        const category = getUnitCategory(sentence?.label, sentence?.confidence, cutoff);
        sentenceCounts[category] += 1;
        if (category === "hoaks") hasHoaks = true;
        if (category === "fakta") hasFakta = true;
      });
      let paragraphCategory = "ragu";
      if (hasHoaks) paragraphCategory = "hoaks";
      else if (hasFakta) paragraphCategory = "fakta";
      paragraphCounts[paragraphCategory] += 1;
    });
  } else {
    items.forEach((item) => {
      const paragraphPrediction =
        Array.isArray(item?.sentences) && item.sentences.length > 0 ? item.sentences[0] : null;
      const category = getUnitCategory(
        paragraphPrediction?.label, paragraphPrediction?.confidence, cutoff,
      );
      paragraphCounts[category] += 1;
    });
  }

  const overallLabel =
    paragraphCounts.hoaks > 0 ? "hoaks" :
    paragraphCounts.fakta > 0 ? "fakta" : "ragu";

  return {
    mode,
    paragraphs_total: items.length,
    sentences_total: mode === "sentence"
      ? sentenceCounts.hoaks + sentenceCounts.fakta + sentenceCounts.ragu : 0,
    counts_sentence: mode === "sentence" ? sentenceCounts : null,
    counts_paragraph: paragraphCounts,
    overall_label: overallLabel,
  };
}

function buildGlobalSummaryMarkup(summaryModel, globalTopicText = null, extraLines = []) {
  const lines = [];
  if (summaryModel?.mode === "sentence") {
    lines.push("Mode: Per kalimat • Unit analisis: kalimat");
    lines.push(
      `Kalimat: total ${summaryModel.sentences_total} • Hoaks ${summaryModel.counts_sentence.hoaks} • Fakta ${summaryModel.counts_sentence.fakta} • Ragu ${summaryModel.counts_sentence.ragu}`,
    );
    lines.push(
      `Paragraf: total ${summaryModel.paragraphs_total} • Hoaks ${summaryModel.counts_paragraph.hoaks} • Fakta ${summaryModel.counts_paragraph.fakta} • Ragu ${summaryModel.counts_paragraph.ragu}`,
    );
  } else {
    lines.push("Mode: Per paragraf • Unit analisis: paragraf");
    lines.push(
      `Paragraf: total ${summaryModel.paragraphs_total} • Hoaks ${summaryModel.counts_paragraph.hoaks} • Fakta ${summaryModel.counts_paragraph.fakta} • Ragu ${summaryModel.counts_paragraph.ragu}`,
    );
  }
  if (globalTopicText) lines.push(`Topik Global: ${globalTopicText}`);
  if (Array.isArray(extraLines)) {
    extraLines.forEach((line) => {
      const text = String(line || "").trim();
      if (text) lines.push(text);
    });
  }
  return lines.map((line) => escapeHtml(line)).join("<br>");
}

function buildConfidenceSummaryText(summaryModel) {
  if (summaryModel?.mode === "sentence") {
    return (
      `Rincian Keyakinan • Mode: Per kalimat • ` +
      `Kalimat ${summaryModel.sentences_total} (Hoaks ${summaryModel.counts_sentence.hoaks} • Fakta ${summaryModel.counts_sentence.fakta} • Ragu ${summaryModel.counts_sentence.ragu}) • ` +
      `Paragraf ${summaryModel.paragraphs_total} (Hoaks ${summaryModel.counts_paragraph.hoaks} • Fakta ${summaryModel.counts_paragraph.fakta} • Ragu ${summaryModel.counts_paragraph.ragu})`
    );
  }
  return (
    `Rincian Keyakinan • Mode: Per paragraf • ` +
    `Paragraf ${summaryModel.paragraphs_total} (Hoaks ${summaryModel.counts_paragraph.hoaks} • Fakta ${summaryModel.counts_paragraph.fakta} • Ragu ${summaryModel.counts_paragraph.ragu})`
  );
}

function needsSoftSpace(previousRaw, currentRaw) {
  if (!previousRaw || !currentRaw) return false;
  if (/\s$/.test(previousRaw)) return false;
  if (/^\s/.test(currentRaw)) return false;
  if (/^[,.;:!?)]/.test(currentRaw)) return false;
  return true;
}

function joinHighlightedSentences(sentences) {
  const ordered = sortBySentenceIndex(sentences);
  const chunks = [];

  ordered.forEach((sentence) => {
    const rawText = String(sentence?.text ?? "");
    if (rawText === "") return;
    const normalized = normalizeLabel(sentence?.label);
    const confidence = Number(sentence?.confidence);
    const hlClass = kelasHighlight(normalized, confidence, CONFIDENCE_CUTOFF);
    const title = `${labelText(normalized)} | confidence ${formatPercent(confidence)}`;
    chunks.push({
      rawText,
      html: `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(rawText)}</span>`,
    });
  });

  if (chunks.length === 0) return "";
  let html = "";
  for (let i = 0; i < chunks.length; i += 1) {
    const current = chunks[i];
    const previous = i > 0 ? chunks[i - 1] : null;
    if (previous && needsSoftSpace(previous.rawText, current.rawText)) html += " ";
    html += current.html;
  }
  return html;
}

function buildFallbackParagraphs(paragraphsFromBackend, inputTextUsed) {
  const inputParagraphs  = splitParagraphsByBlankLine(inputTextUsed);
  const backendParagraphs = sortByParagraphIndex(paragraphsFromBackend);
  if (inputParagraphs.length <= 1 || backendParagraphs.length !== 1) return backendParagraphs;

  const sourceParagraph  = backendParagraphs[0] || {};
  const sourceSentences  = sortBySentenceIndex(sourceParagraph.sentences);
  const estimatedPerParagraph = inputParagraphs.map(
    (pt) => splitSentencesHeuristic(pt).length,
  );

  const rebuilt = [];
  let cursor = 0;
  for (let i = 0; i < inputParagraphs.length; i += 1) {
    const remainingParagraphs = inputParagraphs.length - i;
    const remainingSentences  = sourceSentences.length - cursor;
    let takeCount = estimatedPerParagraph[i] || 0;
    if (i === inputParagraphs.length - 1) {
      takeCount = Math.max(0, remainingSentences);
    } else {
      const minReserve = Math.max(0, remainingParagraphs - 1);
      const maxAllowed = Math.max(0, remainingSentences - minReserve);
      if (takeCount > maxAllowed) takeCount = maxAllowed;
      if (takeCount <= 0 && maxAllowed > 0) takeCount = 1;
    }
    const slice = sourceSentences.slice(cursor, cursor + takeCount)
      .map((sentence, localIdx) => ({ ...sentence, sentence_index: localIdx }));
    cursor += takeCount;
    rebuilt.push({ paragraph_index: i, text: inputParagraphs[i], topic: null, sentences: slice });
  }
  if (cursor < sourceSentences.length && rebuilt.length > 0) {
    const leftovers = sourceSentences.slice(cursor);
    const lastParagraph = rebuilt[rebuilt.length - 1];
    lastParagraph.sentences = [...lastParagraph.sentences, ...leftovers]
      .map((sentence, idx) => ({ ...sentence, sentence_index: idx }));
  }
  return rebuilt;
}

function extractParagraphs(payload, inputTextUsed) {
  if (!payload || typeof payload !== "object") return [];
  if (!Array.isArray(payload.paragraphs)) return [];
  const sorted = sortByParagraphIndex(payload.paragraphs);
  return buildFallbackParagraphs(sorted, inputTextUsed);
}

function prepareParagraphModel(paragraphs, globalTopic = { label: null, score: null }, options = {}) {
  const sorted = sortByParagraphIndex(paragraphs);
  const items  = [];
  const isFallback        = Boolean(options?.isFallback);
  const topicPerParagraph = Boolean(options?.topicPerParagraph);
  const inputParagraphTexts = Array.isArray(options?.inputParagraphTexts)
    ? options.inputParagraphTexts : [];

  let sentenceCount = 0;
  let sentenceHoaksCount = 0;

  sorted.forEach((paragraph, index) => {
    const paragraphNumber = Number.isFinite(Number(paragraph?.paragraph_index))
      ? Number(paragraph.paragraph_index) + 1 : index + 1;
    const sentences     = sortBySentenceIndex(paragraph?.sentences);
    const paragraphLabel = computeParagraphLabel(sentences);

    sentences.forEach((sentence) => {
      sentenceCount += 1;
      if (normalizeLabel(sentence?.label) === "hoaks") sentenceHoaksCount += 1;
    });

    const paragraphTextForTopic = String(paragraph?.text ?? inputParagraphTexts[index] ?? "");
    let normalizedTopicLabel = null;
    let resolvedTopicScore   = null;
    let hasTopicLabel        = false;
    let hasTopicScore        = false;

    if (topicPerParagraph) {
      const resolvedTopic = resolveParagraphTopic(paragraph, globalTopic, paragraphTextForTopic, isFallback);
      normalizedTopicLabel = cleanTopicLabel(resolvedTopic?.label);
      resolvedTopicScore   = normalizeTopicScore(resolvedTopic?.score);
      hasTopicLabel        = Boolean(normalizedTopicLabel);
      hasTopicScore        = hasTopicLabel && Number.isFinite(Number(resolvedTopicScore)) && Number(resolvedTopicScore) > 0;
    }

    items.push({
      paragraphNumber,
      paragraphLabel,
      topicLabel:   normalizedTopicLabel || "-",
      topicScore:   resolvedTopicScore,
      hasTopicLabel,
      hasTopicScore,
      paragraphText: paragraphTextForTopic,
      sentences,
    });
  });

  return {
    items,
    overallLabel: computeOverallLabel(items),
    counts: { paragraphCount: items.length, sentenceCount, sentenceHoaksCount },
  };
}

// =========================
// Render
// =========================

function renderOutputInlineWithPayload(payload, paragraphs, options = {}) {
  if (!outputSection || !outputParagraphs || !globalSummary) return null;

  outputParagraphs.innerHTML = "";
  const globalTopic       = extractGlobalTopic(payload);
  const topicPerParagraph = Boolean(options?.topicPerParagraph);
  const sentenceLevel     = options?.sentenceLevel !== false;
  const model        = prepareParagraphModel(paragraphs, globalTopic, options);
  const mode         = sentenceLevel ? "sentence" : "paragraph";
  const summaryModel = buildSummaryModel(model.items, mode, CONFIDENCE_CUTOFF);

  let globalTopicText = null;
  const globalTopicLabel = cleanTopicLabel(globalTopic.label);
  if (!topicPerParagraph && globalTopicLabel) {
    const globalTopicScore = normalizeTopicScore(globalTopic.score);
    globalTopicText = globalTopicScore !== null && globalTopicScore > 0
      ? `${globalTopicLabel} (${formatPercent(globalTopicScore)})` : globalTopicLabel;
  }

  // [FIX-JS-6] Selalu tampilkan "BERTopic" — tidak ada conditional
  const summaryExtraLines = ["Metode topik aktif: BERTopic"];

  globalSummary.innerHTML = buildGlobalSummaryMarkup(summaryModel, globalTopicText, summaryExtraLines);

  if (model.items.length === 0) {
    outputParagraphs.innerHTML = '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    outputSection.classList.remove("hidden");
    renderTopicDebug(payload, globalTopic, model, options);
    return { model, globalTopic, summaryModel };
  }

  const fragment = document.createDocumentFragment();

  model.items.forEach((item) => {
    const block  = document.createElement("article");
    block.className = "paragraph-block";

    const metaEl = document.createElement("p");
    metaEl.className = "paragraph-meta";
    if (topicPerParagraph) {
      metaEl.textContent = `Paragraf ${item.paragraphNumber} • ${formatTopicMeta(item.topicLabel, item.topicScore)}`;
    } else {
      metaEl.textContent = `Paragraf ${item.paragraphNumber}`;
    }

    const text = document.createElement("p");
    text.className = "paragraph-text";

    if (sentenceLevel) {
      const highlighted = joinHighlightedSentences(item.sentences);
      text.innerHTML = highlighted || escapeHtml(item.paragraphText);
    } else {
      const paraPrediction = item.sentences[0] || null;
      if (paraPrediction) {
        const normalized = normalizeLabel(paraPrediction?.label);
        const confidence = Number(paraPrediction?.confidence);
        const hlClass = kelasHighlight(normalized, confidence, CONFIDENCE_CUTOFF);
        const title = `${labelText(normalized)} | confidence ${formatPercent(confidence)}`;
        text.innerHTML = `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(item.paragraphText)}</span>`;
      } else {
        text.innerHTML = escapeHtml(item.paragraphText);
      }
    }

    block.appendChild(metaEl);
    block.appendChild(text);
    fragment.appendChild(block);
  });

  outputParagraphs.appendChild(fragment);
  outputSection.classList.remove("hidden");
  renderTopicDebug(payload, globalTopic, model, options);
  return { model, globalTopic, summaryModel };
}

function renderConfidenceDetails(paragraphs, globalTopic = { label: null, score: null }, options = {}) {
  if (!confidenceDetails || !confidenceSummary || !confidenceList) return;

  const model        = prepareParagraphModel(paragraphs, globalTopic, options);
  const sentenceLevel = options?.sentenceLevel !== false;
  const mode         = sentenceLevel ? "sentence" : "paragraph";
  const summaryModel = options?.summaryModel || buildSummaryModel(model.items, mode, CONFIDENCE_CUTOFF);

  confidenceSummary.textContent = buildConfidenceSummaryText(summaryModel);
  confidenceList.innerHTML = "";

  if (model.items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tidak ada rincian confidence yang tersedia.";
    confidenceList.appendChild(li);
    confidenceDetails.classList.remove("hidden");
    return;
  }

  const fragment = document.createDocumentFragment();

  if (sentenceLevel) {
    model.items.forEach((item) => {
      item.sentences.forEach((sentence, sIdx) => {
        const sentenceNumber = Number.isFinite(Number(sentence?.sentence_index))
          ? Number(sentence.sentence_index) + 1 : sIdx + 1;
        const confidence = Number(sentence?.confidence);
        const pHoax      = getSentenceHoaxProbability(sentence);
        const pFakta     = getSentenceFaktaProbability(sentence);
        const fullText   = String(sentence?.text ?? "").trim();
        const shortText  = truncate(fullText, DETAIL_TEXT_MAX_LEN);

        const li = document.createElement("li");
        li.className = "confidence-item";
        li.title = fullText || "(teks kosong)";

        const head   = document.createElement("div");
        head.className = "confidence-head";
        const pos    = document.createElement("span");
        pos.className = "confidence-pos";
        pos.textContent = `P${item.paragraphNumber} S${sentenceNumber}`;
        const badge  = document.createElement("span");
        badge.className = `confidence-badge ${badgeClass(sentence?.label, confidence)}`;
        badge.textContent = badgeText(sentence?.label, confidence);
        head.appendChild(pos);
        head.appendChild(badge);

        const metrics = document.createElement("div");
        metrics.className = "confidence-metrics";
        const makeMetric = (text) => {
          const span = document.createElement("span");
          span.className = "confidence-metric";
          span.textContent = text;
          return span;
        };
        metrics.appendChild(makeMetric(`Confidence ${formatPercent(confidence)}`));
        metrics.appendChild(makeMetric(`P(hoaks) ${formatPercent(pHoax)}`));
        metrics.appendChild(makeMetric(`P(fakta) ${formatPercent(pFakta)}`));

        const sentenceText = document.createElement("p");
        sentenceText.className = "confidence-text";
        sentenceText.textContent = shortText || "(teks kosong)";

        li.appendChild(head);
        li.appendChild(metrics);
        li.appendChild(sentenceText);
        fragment.appendChild(li);
      });
    });
  } else {
    model.items.forEach((item) => {
      const sentence   = item.sentences[0] || {};
      const confidence = Number(sentence?.confidence);
      const pHoax      = getSentenceHoaxProbability(sentence);
      const pFakta     = getSentenceFaktaProbability(sentence);
      const fullText   = String(item.paragraphText || sentence?.text || "").trim();
      const shortText  = truncate(fullText, DETAIL_TEXT_MAX_LEN);

      const li = document.createElement("li");
      li.className = "confidence-item";
      li.title = fullText || "(teks kosong)";

      const head  = document.createElement("div");
      head.className = "confidence-head";
      const pos   = document.createElement("span");
      pos.className = "confidence-pos";
      pos.textContent = `P${item.paragraphNumber}`;
      const badge = document.createElement("span");
      badge.className = `confidence-badge ${badgeClass(sentence?.label, confidence)}`;
      badge.textContent = badgeText(sentence?.label, confidence);
      head.appendChild(pos);
      head.appendChild(badge);

      const metrics = document.createElement("div");
      metrics.className = "confidence-metrics";
      const makeMetric = (text) => {
        const span = document.createElement("span");
        span.className = "confidence-metric";
        span.textContent = text;
        return span;
      };
      metrics.appendChild(makeMetric(`Confidence ${formatPercent(confidence)}`));
      metrics.appendChild(makeMetric(`P(hoaks) ${formatPercent(pHoax)}`));
      metrics.appendChild(makeMetric(`P(fakta) ${formatPercent(pFakta)}`));

      const paragraphText = document.createElement("p");
      paragraphText.className = "confidence-text";
      paragraphText.textContent = shortText || "(teks kosong)";

      li.appendChild(head);
      li.appendChild(metrics);
      li.appendChild(paragraphText);
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

// =========================
// Handlers
// =========================

function handleReset() {
  if (newsText) newsText.value = "";
  lastPayload = null;
  clearError();
  resetOutput();
  updateInputStats();
  if (newsText) newsText.focus();
}

async function handleDetect() {
  clearError();
  resetOutput();

  const text = String(newsText?.value || "");
  if (!text.trim()) {
    showError("Masukkan teks berita terlebih dahulu.");
    return;
  }

  const textToSend = normalizeParagraphBreaks(text);
  const inputParagraphTexts = splitParagraphsByBlankLine(textToSend);
  const sentenceLevel     = sentenceLevelToggle ? Boolean(sentenceLevelToggle.checked) : true;
  const topicPerParagraph = Boolean(topicPerParagraphToggle?.checked);
  // [FIX-JS-4] topicModel dihapus — backend selalu BERTopic

  setLoading(true);
  try {
    // [FIX-JS-3] Tidak kirim topicModel
    const payload = await callAnalyzeApi(textToSend, topicPerParagraph, sentenceLevel);
    lastPayload = payload;

    // Info bar: threshold + topic model
    if (analysisInfoBar && infoThreshold && infoTopicModel) {
      const meta = payload?.meta || {};
      const th = meta.threshold_used;

      if (th !== undefined && th !== null) {
        infoThreshold.textContent = `Threshold: ${Number(th).toFixed(2)} (kalibrasi val-set)`;
        infoThreshold.classList.remove("hidden");
      } else {
        infoThreshold.classList.add("hidden");
      }
      // [FIX-JS-6] Selalu tampilkan BERTopic
      infoTopicModel.textContent = "Metode topik: BERTopic";
      infoTopicModel.classList.remove("hidden");
      analysisInfoBar.classList.remove("hidden");
    }

    const backendParagraphCount = Array.isArray(lastPayload?.paragraphs)
      ? lastPayload.paragraphs.length : 0;
    const isFallback  = backendParagraphCount === 1 && inputParagraphTexts.length > 1;
    const paragraphs  = extractParagraphs(lastPayload, textToSend);
    const renderOptions = {
      isFallback,
      inputParagraphTexts,
      topicPerParagraph,
      sentenceLevel,
    };

    const rendered = renderOutputInlineWithPayload(lastPayload, paragraphs, renderOptions);
    renderConfidenceDetails(paragraphs, rendered?.globalTopic, {
      topicPerParagraph,
      sentenceLevel,
      summaryModel: rendered?.summaryModel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses.";
    showError(msg);
  } finally {
    setLoading(false);
  }
}

if (detectBtn) detectBtn.addEventListener("click", handleDetect);
if (resetBtn)  resetBtn.addEventListener("click", handleReset);

if (newsText) {
  newsText.addEventListener("input", updateInputStats);
  newsText.addEventListener("keydown", (e) => {
    if (e.ctrlKey && (e.key === "Enter" || e.key === "NumpadEnter")) {
      e.preventDefault();
      handleDetect();
    }
  });
}

updateInputStats();
