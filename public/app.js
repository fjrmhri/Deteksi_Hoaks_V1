const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;
const CONFIDENCE_CUTOFF = 0.65;
const DETAIL_TEXT_MAX_LEN = 190;

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
const resetBtn = document.getElementById("resetBtn");
const newsText = document.getElementById("newsText");

const statParagraphs = document.getElementById("statParagraphs");
const statSentences = document.getElementById("statSentences");
const statWords = document.getElementById("statWords");

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

function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function splitParagraphsByBlankLine(text) {
  return normalizeNewlines(text)
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitSentencesHeuristic(text) {
  const raw = String(text || "");
  const matches = raw.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const cleaned = matches.map((x) => x.trim()).filter((x) => x.length > 0);
  if (cleaned.length > 0) return cleaned;
  const fallback = raw.trim();
  return fallback ? [fallback] : [];
}

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

function updateInputStats() {
  const text = String(newsText?.value || "");
  const p = countParagraphs(text);
  const s = countSentences(text);
  const w = countWords(text);

  if (statParagraphs) statParagraphs.textContent = `Paragraf: ${p}`;
  if (statSentences) statSentences.textContent = `Kalimat: ${s}`;
  if (statWords) statWords.textContent = `Kata: ${w}`;
}

function normalizeParagraphBreaks(text) {
  const normalized = normalizeNewlines(text);
  if (!normalized.includes("\n")) return normalized;

  if (/\n\s*\n/.test(normalized)) {
    return normalized;
  }

  return normalized.replace(/\n+/g, "\n\n");
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

function kelasHighlight(label, confidence, cutoff = CONFIDENCE_CUTOFF) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < cutoff) return "hl--orange";

  const normalized = normalizeLabel(label);
  if (normalized === "hoaks") return "hl--red";
  if (normalized === "fakta") return "hl--green";
  return "hl--orange";
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

function sortByParagraphIndex(paragraphs) {
  const safe = Array.isArray(paragraphs) ? [...paragraphs] : [];
  safe.sort((a, b) => {
    const ai = Number.isFinite(Number(a?.paragraph_index)) ? Number(a.paragraph_index) : 0;
    const bi = Number.isFinite(Number(b?.paragraph_index)) ? Number(b.paragraph_index) : 0;
    return ai - bi;
  });
  return safe;
}

function sortBySentenceIndex(sentences) {
  const safe = Array.isArray(sentences) ? [...sentences] : [];
  safe.sort((a, b) => {
    const ai = Number.isFinite(Number(a?.sentence_index)) ? Number(a.sentence_index) : 0;
    const bi = Number.isFinite(Number(b?.sentence_index)) ? Number(b.sentence_index) : 0;
    return ai - bi;
  });
  return safe;
}

function computeParagraphLabel(sentences) {
  const safe = Array.isArray(sentences) ? sentences : [];
  const hasHoaks = safe.some((sentence) => normalizeLabel(sentence?.label) === "hoaks");
  return hasHoaks ? "hoaks" : "fakta";
}

function computeOverallLabel(paragraphs) {
  const safe = Array.isArray(paragraphs) ? paragraphs : [];
  const hasHoaks = safe.some((paragraph) => normalizeLabel(paragraph?.paragraphLabel) === "hoaks");
  return hasHoaks ? "hoaks" : "fakta";
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
      html: `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(
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

function buildFallbackParagraphs(paragraphsFromBackend, inputTextUsed) {
  const inputParagraphs = splitParagraphsByBlankLine(inputTextUsed);
  const backendParagraphs = sortByParagraphIndex(paragraphsFromBackend);

  if (inputParagraphs.length <= 1 || backendParagraphs.length !== 1) {
    return backendParagraphs;
  }

  const sourceParagraph = backendParagraphs[0] || {};
  const sourceSentences = sortBySentenceIndex(sourceParagraph.sentences);
  const estimatedPerParagraph = inputParagraphs.map((paragraphText) =>
    splitSentencesHeuristic(paragraphText).length
  );

  const rebuilt = [];
  let cursor = 0;

  for (let i = 0; i < inputParagraphs.length; i += 1) {
    const remainingParagraphs = inputParagraphs.length - i;
    const remainingSentences = sourceSentences.length - cursor;

    let takeCount = estimatedPerParagraph[i] || 0;
    if (i === inputParagraphs.length - 1) {
      takeCount = Math.max(0, remainingSentences);
    } else {
      const minReserve = Math.max(0, remainingParagraphs - 1);
      const maxAllowed = Math.max(0, remainingSentences - minReserve);
      if (takeCount > maxAllowed) takeCount = maxAllowed;
      if (takeCount <= 0 && maxAllowed > 0) takeCount = 1;
    }

    const slice = sourceSentences.slice(cursor, cursor + takeCount).map((sentence, localIdx) => ({
      ...sentence,
      sentence_index: localIdx,
    }));
    cursor += takeCount;

    rebuilt.push({
      paragraph_index: i,
      text: inputParagraphs[i],
      topic: { label: "-", score: null, keywords: [] },
      sentences: slice,
    });
  }

  if (cursor < sourceSentences.length && rebuilt.length > 0) {
    const leftovers = sourceSentences.slice(cursor);
    const lastParagraph = rebuilt[rebuilt.length - 1];
    lastParagraph.sentences = [...lastParagraph.sentences, ...leftovers].map((sentence, idx) => ({
      ...sentence,
      sentence_index: idx,
    }));
  }

  return rebuilt;
}

function extractParagraphs(payload, inputTextUsed) {
  if (!payload || typeof payload !== "object") return [];
  if (!Array.isArray(payload.paragraphs)) return [];

  const sorted = sortByParagraphIndex(payload.paragraphs);
  return buildFallbackParagraphs(sorted, inputTextUsed);
}

function prepareParagraphModel(paragraphs) {
  const sorted = sortByParagraphIndex(paragraphs);
  const items = [];

  let sentenceCount = 0;
  let sentenceHoaksCount = 0;
  let sentenceFaktaCount = 0;
  let sentenceRaguCount = 0;
  let paragraphHoaksCount = 0;

  sorted.forEach((paragraph, index) => {
    const paragraphNumber = Number.isFinite(Number(paragraph?.paragraph_index))
      ? Number(paragraph.paragraph_index) + 1
      : index + 1;

    const sentences = sortBySentenceIndex(paragraph?.sentences);
    const paragraphLabel = computeParagraphLabel(sentences);
    if (paragraphLabel === "hoaks") paragraphHoaksCount += 1;

    sentences.forEach((sentence) => {
      sentenceCount += 1;
      const normalized = normalizeLabel(sentence?.label);
      if (normalized === "hoaks") sentenceHoaksCount += 1;
      else sentenceFaktaCount += 1;

      const confidence = Number(sentence?.confidence);
      if (Number.isFinite(confidence) && confidence < CONFIDENCE_CUTOFF) {
        sentenceRaguCount += 1;
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
    overallLabel,
    counts: {
      paragraphCount: items.length,
      sentenceCount,
      sentenceHoaksCount,
      sentenceFaktaCount,
      sentenceRaguCount,
      paragraphHoaksCount,
    },
  };
}

function renderOutputInline(paragraphs) {
  if (!outputSection || !outputParagraphs || !globalSummary) return null;

  outputParagraphs.innerHTML = "";

  const model = prepareParagraphModel(paragraphs);

  globalSummary.textContent =
    `Ringkasan: ${labelText(model.overallLabel)} • ${model.counts.paragraphCount} paragraf • ` +
    `${model.counts.sentenceCount} kalimat • Hoaks ${model.counts.sentenceHoaksCount} • ` +
    `Fakta ${model.counts.sentenceFaktaCount} • Ragu ${model.counts.sentenceRaguCount} • ` +
    `Paragraf Hoaks ${model.counts.paragraphHoaksCount}`;

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
    meta.textContent = `Paragraf ${item.paragraphNumber} • Topik: ${item.topicLabel}${topicScoreText}`;

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

  confidenceSummary.textContent =
    `Rincian Keyakinan • ${model.counts.paragraphCount} paragraf • ${model.counts.sentenceCount} kalimat • ` +
    `Hoaks ${model.counts.sentenceHoaksCount} • Fakta ${model.counts.sentenceFaktaCount} • ` +
    `Ragu ${model.counts.sentenceRaguCount} • Paragraf Hoaks ${model.counts.paragraphHoaksCount}`;

  confidenceList.innerHTML = "";

  if (model.items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tidak ada rincian confidence yang tersedia.";
    confidenceList.appendChild(li);
    confidenceDetails.classList.remove("hidden");
    return;
  }

  const fragment = document.createDocumentFragment();

  model.items.forEach((item) => {
    item.sentences.forEach((sentence, sIdx) => {
      const sentenceNumber = Number.isFinite(Number(sentence?.sentence_index))
        ? Number(sentence.sentence_index) + 1
        : sIdx + 1;

      const normalized = normalizeLabel(sentence?.label);
      const label = labelText(normalized);
      const confidence = Number(sentence?.confidence);
      const pHoax = getSentenceHoaxProbability(sentence);
      const pFakta = getSentenceFaktaProbability(sentence);

      const fullText = String(sentence?.text ?? "").trim();
      const shortText = truncate(fullText, DETAIL_TEXT_MAX_LEN);

      const li = document.createElement("li");
      li.title = fullText || "(teks kosong)";
      li.textContent =
        `P${item.paragraphNumber} S${sentenceNumber} | "${shortText}" | ${label} | ` +
        `confidence ${formatPercent(confidence)} | P(hoaks) ${formatPercent(pHoax)} | ` +
        `P(fakta) ${formatPercent(pFakta)}`;
      fragment.appendChild(li);
    });
  });

  if (fragment.childNodes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tidak ada rincian confidence yang tersedia.";
    fragment.appendChild(li);
  }

  confidenceList.appendChild(fragment);
  confidenceDetails.classList.remove("hidden");
}

function handleReset() {
  if (newsText) newsText.value = "";
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

  setLoading(true);
  try {
    const payload = await callAnalyzeApi(textToSend);
    const paragraphs = extractParagraphs(payload, textToSend);

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

updateInputStats();
