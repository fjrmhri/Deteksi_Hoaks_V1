const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;
const CONFIDENCE_CUTOFF = 0.65;
const DETAIL_TEXT_MAX_LEN = 190;

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
  "mana","kapan","mengapa","bagaimana","dll","dsb",
]);

function normalizeApiBaseUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  const m = raw.match(/^https?:\/\/huggingface\.co\/spaces\/([^/?#]+)\/([^/?#]+)$/i);
  if (m) return `https://${m[1].toLowerCase()}-${m[2].toLowerCase()}.hf.space`;
  return raw.replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("api") : null;
  const r = typeof window !== "undefined" ? window.__HOAX_API_BASE_URL__ : null;
  return normalizeApiBaseUrl(q) || normalizeApiBaseUrl(r) || normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
}

const apiBaseUrl = resolveApiBaseUrl();
let lastPayload = null;

const detectBtn           = document.getElementById("detectBtn");
const detectLabel         = document.getElementById("detectLabel");
const detectSpinner       = document.getElementById("detectSpinner");
const resetBtn            = document.getElementById("resetBtn");
const newsText            = document.getElementById("newsText");
const sentenceLevelToggle = document.getElementById("sentenceLevelToggle");
const topicToggle         = document.getElementById("topicToggle"); // hidden, always false

const statParagraphs = document.getElementById("statParagraphs");
const statSentences  = document.getElementById("statSentences");
const statWords      = document.getElementById("statWords");

const errorBox          = document.getElementById("errorBox");
const errorText         = document.getElementById("errorText");
const outputSection     = document.getElementById("outputSection");
const verdictBanner     = document.getElementById("verdictBanner");
const verdictIcon       = document.getElementById("verdictIcon");
const verdictLabel      = document.getElementById("verdictLabel");
const verdictConf       = document.getElementById("verdictConf");
const verdictTopic      = document.getElementById("verdictTopic");
const globalSummary     = document.getElementById("globalSummary");
const outputParagraphs  = document.getElementById("outputParagraphs");
const confidenceDetails = document.getElementById("confidenceDetails");
const confidenceSummary = document.getElementById("confidenceSummary");
const confidenceList    = document.getElementById("confidenceList");

// ── Util ──────────────────────────────────────────────────────────

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function truncate(text, maxLen = DETAIL_TEXT_MAX_LEN) {
  const raw = String(text || "").trim();
  return raw.length <= maxLen ? raw : `${raw.slice(0, maxLen - 3)}...`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00%";
  return `${(n * 100).toFixed(2)}%`;
}

function normalizeTopicScore(score) {
  let p = score;
  if (typeof p === "string") { p = p.trim().replace(/%/g, ""); if (!p) return null; }
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return n / 100;
  return null;
}

function cleanTopicLabel(rawLabel) {
  const label = String(rawLabel ?? "").trim();
  return (!label || label === "-") ? null : label;
}

function normalizeNewlines(text) { return String(text || "").replace(/\r\n?/g, "\n"); }

function splitParagraphsByBlankLine(text) {
  return normalizeNewlines(text).split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 0);
}

function splitSentencesHeuristic(text) {
  const raw = String(text || "");
  const matches = raw.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
  const cleaned = matches.map(x => x.trim()).filter(x => x.length > 0);
  if (cleaned.length > 0) return cleaned;
  const fallback = raw.trim();
  return fallback ? [fallback] : [];
}

function countParagraphs(text) { return splitParagraphsByBlankLine(text).length; }
function countSentences(text)  { return splitSentencesHeuristic(text).length; }
function countWords(text)      { return String(text || "").trim().split(/\s+/).filter(Boolean).length; }

function updateInputStats() {
  const text = String(newsText?.value || "");
  if (statParagraphs) statParagraphs.textContent = `Paragraf: ${countParagraphs(text)}`;
  if (statSentences)  statSentences.textContent  = `Kalimat: ${countSentences(text)}`;
  if (statWords)      statWords.textContent      = `Kata: ${countWords(text)}`;
}

function normalizeParagraphBreaks(text) {
  const n = normalizeNewlines(text);
  if (!n.includes("\n")) return n;
  if (/\n\s*\n/.test(n)) return n;
  return n.replace(/\n+/g, "\n\n");
}

// ── Label normalization ───────────────────────────────────────────

function normalizeLabel(rawLabel) {
  const value = String(rawLabel || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!value) return "unknown";
  if (value.includes("hoax") && !value.includes("not") && !value.includes("non")) return "hoaks";
  if (value.includes("hoaks") && !value.includes("not") && !value.includes("non")) return "hoaks";
  if (value.includes("nothoax") || value.includes("nonhoax") || value.includes("fakta") || value.includes("valid")) return "fakta";
  return "unknown";
}

function labelText(n) {
  if (n === "hoaks") return "Hoaks";
  if (n === "fakta") return "Fakta";
  return "Tidak diketahui";
}

function kelasHighlight(label, confidence) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < CONFIDENCE_CUTOFF) return "hl--orange";
  const n = normalizeLabel(label);
  if (n === "hoaks") return "hl--red";
  if (n === "fakta") return "hl--green";
  return "hl--orange";
}

function badgeClass(label, confidence) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < CONFIDENCE_CUTOFF) return "badge--orange";
  return normalizeLabel(label) === "hoaks" ? "badge--red" : "badge--green";
}

function badgeText(label, confidence) {
  const conf = Number(confidence);
  if (Number.isFinite(conf) && conf < CONFIDENCE_CUTOFF) return "Ragu";
  return normalizeLabel(label) === "hoaks" ? "Hoaks" : "Fakta";
}

function getSentenceHoaxProb(sentence) {
  if (Number.isFinite(Number(sentence?.hoax_probability))) return Number(sentence.hoax_probability);
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.hoax))) return Number(probs.hoax);
  return 0;
}

function getSentenceFaktaProb(sentence) {
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.not_hoax))) return Number(probs.not_hoax);
  return Math.max(0, Math.min(1, 1 - getSentenceHoaxProb(sentence)));
}

// ── Topic extraction ──────────────────────────────────────────────

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

function inferTopicLocal(paragraphText) {
  const raw = String(paragraphText || "").toLowerCase();
  if (!raw.trim()) return { label: null, score: null };
  const cleaned = raw.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { label: null, score: null };
  const tokens = cleaned.split(" ").map(t => t.trim()).filter(t => t.length > 2 && !ID_STOPWORDS.has(t));
  if (tokens.length === 0) return { label: null, score: null };
  const freq = new Map();
  tokens.forEach(t => freq.set(t, (freq.get(t) || 0) + 1));
  const ranked = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return { label: null, score: null };
  const top1 = ranked[0];
  const top2 = ranked[1];
  const label = top2 ? `${top1[0]} / ${top2[0]}` : top1[0];
  const score = Math.max(0, Math.min(1, top1[1] / tokens.length));
  return { label, score: Number.isFinite(score) && score > 0 ? score : null };
}

// ── UI state ──────────────────────────────────────────────────────

function showError(message) {
  if (!errorBox) return;
  if (errorText) errorText.textContent = message; else errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  if (!errorBox) return;
  if (errorText) errorText.textContent = ""; else errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

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

function resetOutput() {
  if (outputParagraphs) outputParagraphs.innerHTML = "";
  if (globalSummary)    globalSummary.textContent  = "";
  if (outputSection)    outputSection.classList.add("hidden");
  if (verdictBanner)    verdictBanner.classList.add("hidden");
  if (verdictTopic)     verdictTopic.classList.add("hidden");
  if (confidenceList)   confidenceList.innerHTML = "";
  if (confidenceSummary) confidenceSummary.textContent = "Rincian Keyakinan per Kalimat";
  if (confidenceDetails) {
    confidenceDetails.classList.add("hidden");
    confidenceDetails.open = false;
  }
}

// ── Verdict banner ────────────────────────────────────────────────

function renderVerdict(payload) {
  if (!verdictBanner || !verdictIcon || !verdictLabel || !verdictConf) return;

  const doc = payload?.document;
  if (!doc) return;

  const pHoax     = Number(doc.hoax_probability ?? 0);
  const confidence = Number(doc.confidence ?? Math.max(pHoax, 1 - pHoax));
  const normalized = normalizeLabel(doc.label);
  const isHoaks    = normalized === "hoaks";

  verdictBanner.className = `verdict-banner verdict-banner--${isHoaks ? "hoaks" : "fakta"}`;
  verdictIcon.textContent  = isHoaks ? "⚠" : "✓";
  verdictLabel.textContent = isHoaks ? "Terindikasi Hoaks" : "Terindikasi Fakta";
  verdictConf.textContent  = `Confidence: ${formatPercent(confidence)} · P(hoaks): ${formatPercent(pHoax)}`;

  if (verdictTopic) {
    const globalTopic = extractGlobalTopic(payload);
    const topicLabel  = cleanTopicLabel(globalTopic.label);
    if (topicLabel) {
      verdictTopic.textContent = `Topik: ${topicLabel}`;
      verdictTopic.classList.remove("hidden");
    } else {
      verdictTopic.classList.add("hidden");
    }
  }

  verdictBanner.classList.remove("hidden");
}

// ── API call ──────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnalyzeApi(text, sentenceLevel) {
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
        topic_per_paragraph: false,
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
      throw new Error("Tidak dapat terhubung ke backend. Periksa koneksi dan URL API.");
    }
    throw err;
  }
}

// ── Paragraph/sentence model ──────────────────────────────────────

function sortByIndex(arr, key) {
  return [...(Array.isArray(arr) ? arr : [])].sort((a, b) => {
    const ai = Number.isFinite(Number(a?.[key])) ? Number(a[key]) : 0;
    const bi = Number.isFinite(Number(b?.[key])) ? Number(b[key]) : 0;
    return ai - bi;
  });
}

function computeParagraphLabel(sentences) {
  const safe = Array.isArray(sentences) ? sentences : [];
  const hoaxCount = safe.filter(s => normalizeLabel(s?.label) === "hoaks").length;
  return hoaxCount > safe.length / 2 ? "hoaks" : "fakta";
}

function buildSummaryModel(paragraphs, mode) {
  const items = Array.isArray(paragraphs) ? paragraphs : [];
  const sc = { hoaks: 0, fakta: 0, ragu: 0 };
  const pc = { hoaks: 0, fakta: 0, ragu: 0 };

  if (mode === "sentence") {
    items.forEach(item => {
      const sents = Array.isArray(item?.sentences) ? item.sentences : [];
      let hasH = false, hasF = false;
      sents.forEach(s => {
        const conf = Number(s?.confidence);
        const cat  = (!Number.isFinite(conf) || conf < CONFIDENCE_CUTOFF) ? "ragu"
          : normalizeLabel(s?.label) === "hoaks" ? "hoaks" : "fakta";
        sc[cat]++;
        if (cat === "hoaks") hasH = true;
        if (cat === "fakta") hasF = true;
      });
      pc[hasH ? "hoaks" : hasF ? "fakta" : "ragu"]++;
    });
  } else {
    items.forEach(item => {
      const s    = Array.isArray(item?.sentences) && item.sentences.length > 0 ? item.sentences[0] : null;
      const conf = Number(s?.confidence);
      const cat  = (!Number.isFinite(conf) || conf < CONFIDENCE_CUTOFF) ? "ragu"
        : normalizeLabel(s?.label) === "hoaks" ? "hoaks" : "fakta";
      pc[cat]++;
    });
  }

  return { mode, sc, pc, total_s: sc.hoaks + sc.fakta + sc.ragu, total_p: items.length };
}

function buildSummaryMarkup(sm) {
  const lines = [];
  if (sm.mode === "sentence") {
    lines.push(`Kalimat: ${sm.total_s} total · ${sm.sc.hoaks} hoaks · ${sm.sc.fakta} fakta · ${sm.sc.ragu} ragu`);
    lines.push(`Paragraf: ${sm.total_p} total · ${sm.pc.hoaks} hoaks · ${sm.pc.fakta} fakta · ${sm.pc.ragu} ragu`);
  } else {
    lines.push(`Paragraf: ${sm.total_p} total · ${sm.pc.hoaks} hoaks · ${sm.pc.fakta} fakta · ${sm.pc.ragu} ragu`);
  }
  return lines.map(l => escapeHtml(l)).join("<br>");
}

function buildFallbackParagraphs(backendParagraphs, inputText) {
  const inputPars = splitParagraphsByBlankLine(inputText);
  const sorted    = sortByIndex(backendParagraphs, "paragraph_index");
  if (inputPars.length <= 1 || sorted.length !== 1) return sorted;

  const src  = sorted[0] || {};
  const sents = sortByIndex(src.sentences, "sentence_index");
  const est   = inputPars.map(pt => splitSentencesHeuristic(pt).length);
  const rebuilt = [];
  let cursor = 0;

  for (let i = 0; i < inputPars.length; i++) {
    const remaining = inputPars.length - i;
    const remSents  = sents.length - cursor;
    let take = est[i] || 0;
    if (i === inputPars.length - 1) {
      take = Math.max(0, remSents);
    } else {
      const reserve  = Math.max(0, remaining - 1);
      const maxAllow = Math.max(0, remSents - reserve);
      if (take > maxAllow) take = maxAllow;
      if (take <= 0 && maxAllow > 0) take = 1;
    }
    const slice = sents.slice(cursor, cursor + take).map((s, li) => ({ ...s, sentence_index: li }));
    cursor += take;
    rebuilt.push({ paragraph_index: i, text: inputPars[i], topic: null, sentences: slice });
  }
  if (cursor < sents.length && rebuilt.length > 0) {
    const leftovers = sents.slice(cursor);
    const last = rebuilt[rebuilt.length - 1];
    last.sentences = [...last.sentences, ...leftovers].map((s, i) => ({ ...s, sentence_index: i }));
  }
  return rebuilt;
}

function extractParagraphs(payload, inputText) {
  if (!payload || !Array.isArray(payload.paragraphs)) return [];
  return buildFallbackParagraphs(payload.paragraphs, inputText);
}

// ── Sentence highlighting ─────────────────────────────────────────

function needsSoftSpace(prev, curr) {
  if (!prev || !curr) return false;
  if (/\s$/.test(prev) || /^\s/.test(curr)) return false;
  if (/^[,.;:!?)]/.test(curr)) return false;
  return true;
}

function joinHighlighted(sentences) {
  const ordered = sortByIndex(sentences, "sentence_index");
  const chunks  = [];
  ordered.forEach(sentence => {
    const raw = String(sentence?.text ?? "");
    if (!raw) return;
    const normalized = normalizeLabel(sentence?.label);
    const confidence = Number(sentence?.confidence);
    const hlClass    = kelasHighlight(normalized, confidence);
    const title      = `${labelText(normalized)} · confidence ${formatPercent(confidence)}`;
    chunks.push({ rawText: raw, html: `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(raw)}</span>` });
  });
  if (chunks.length === 0) return "";
  let html = "";
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0 && needsSoftSpace(chunks[i - 1].rawText, chunks[i].rawText)) html += " ";
    html += chunks[i].html;
  }
  return html;
}

// ── Render output ─────────────────────────────────────────────────

function renderOutput(payload, paragraphs, sentenceLevel) {
  if (!outputSection || !outputParagraphs || !globalSummary) return null;
  outputParagraphs.innerHTML = "";

  const mode    = sentenceLevel ? "sentence" : "paragraph";
  const sm      = buildSummaryModel(paragraphs, mode);

  globalSummary.innerHTML = buildSummaryMarkup(sm);

  if (paragraphs.length === 0) {
    outputParagraphs.innerHTML = '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    outputSection.classList.remove("hidden");
    return sm;
  }

  const sorted   = sortByIndex(paragraphs, "paragraph_index");
  const fragment = document.createDocumentFragment();

  sorted.forEach((paragraph, index) => {
    const pNum  = Number.isFinite(Number(paragraph?.paragraph_index)) ? Number(paragraph.paragraph_index) + 1 : index + 1;
    const sents = sortByIndex(paragraph?.sentences, "sentence_index");
    const pText = String(paragraph?.text ?? "");

    const block = document.createElement("article");
    block.className = "paragraph-block";

    const meta = document.createElement("p");
    meta.className = "paragraph-meta";
    meta.textContent = `Paragraf ${pNum}`;

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
        const title   = `${labelText(norm)} · confidence ${formatPercent(conf)}`;
        text.innerHTML = `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(pText)}</span>`;
      } else {
        text.innerHTML = escapeHtml(pText);
      }
    }

    block.appendChild(meta);
    block.appendChild(text);
    fragment.appendChild(block);
  });

  outputParagraphs.appendChild(fragment);
  outputSection.classList.remove("hidden");
  return sm;
}

// ── Render confidence details ─────────────────────────────────────

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
  const sorted   = sortByIndex(paragraphs, "paragraph_index");
  const fragment = document.createDocumentFragment();

  if (sentenceLevel) {
    sorted.forEach((item, idx) => {
      const pNum  = Number.isFinite(Number(item?.paragraph_index)) ? Number(item.paragraph_index) + 1 : idx + 1;
      sortByIndex(item?.sentences, "sentence_index").forEach((sentence, sIdx) => {
        const sNum    = Number.isFinite(Number(sentence?.sentence_index)) ? Number(sentence.sentence_index) + 1 : sIdx + 1;
        const conf    = Number(sentence?.confidence);
        const pHoax   = getSentenceHoaxProb(sentence);
        const pFakta  = getSentenceFaktaProb(sentence);
        const fullText  = String(sentence?.text ?? "").trim();
        const shortText = truncate(fullText);

        const li = document.createElement("li");
        li.className = "confidence-item";
        li.title = fullText || "(teks kosong)";

        const head  = document.createElement("div");
        head.className = "confidence-head";
        const pos   = document.createElement("span");
        pos.className = "confidence-pos";
        pos.textContent = `P${pNum} S${sNum}`;
        const badge = document.createElement("span");
        badge.className = `confidence-badge ${badgeClass(sentence?.label, conf)}`;
        badge.textContent = badgeText(sentence?.label, conf);
        head.appendChild(pos);
        head.appendChild(badge);

        const metrics = document.createElement("div");
        metrics.className = "confidence-metrics";
        [[`Conf ${formatPercent(conf)}`, ""], [`P(hoaks) ${formatPercent(pHoax)}`, "--red"], [`P(fakta) ${formatPercent(pFakta)}`, "--green"]].forEach(([text]) => {
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
      });
    });
  } else {
    sorted.forEach((item, idx) => {
      const pNum   = Number.isFinite(Number(item?.paragraph_index)) ? Number(item.paragraph_index) + 1 : idx + 1;
      const s      = (Array.isArray(item?.sentences) && item.sentences.length > 0) ? item.sentences[0] : {};
      const conf   = Number(s?.confidence);
      const pHoax  = getSentenceHoaxProb(s);
      const pFakta = getSentenceFaktaProb(s);
      const fullText  = String(item?.text || s?.text || "").trim();
      const shortText = truncate(fullText);

      const li = document.createElement("li");
      li.className = "confidence-item";
      li.title = fullText || "(teks kosong)";

      const head  = document.createElement("div");
      head.className = "confidence-head";
      const pos   = document.createElement("span");
      pos.className = "confidence-pos";
      pos.textContent = `P${pNum}`;
      const badge = document.createElement("span");
      badge.className = `confidence-badge ${badgeClass(s?.label, conf)}`;
      badge.textContent = badgeText(s?.label, conf);
      head.appendChild(pos);
      head.appendChild(badge);

      const metrics = document.createElement("div");
      metrics.className = "confidence-metrics";
      [`Conf ${formatPercent(conf)}`, `P(hoaks) ${formatPercent(pHoax)}`, `P(fakta) ${formatPercent(pFakta)}`].forEach(t => {
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

// ── Handlers ──────────────────────────────────────────────────────

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

  const textToSend    = normalizeParagraphBreaks(text);
  const sentenceLevel = sentenceLevelToggle ? Boolean(sentenceLevelToggle.checked) : true;

  setLoading(true);
  try {
    const payload = await callAnalyzeApi(textToSend, sentenceLevel);
    lastPayload = payload;

    renderVerdict(payload);

    const paragraphs = extractParagraphs(payload, textToSend);
    const sm         = renderOutput(payload, paragraphs, sentenceLevel);
    renderConfidence(paragraphs, sentenceLevel, sm);
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
