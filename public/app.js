const DEFAULT_API_BASE_URL = "https://fjrmhri-ta-final-space.hf.space";
const API_TIMEOUT_MS = 25000;
const CONFIDENCE_CUTOFF = 0.65;
const DETAIL_TEXT_MAX_LEN = 190;
const isDebug =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "1";
const ID_STOPWORDS = new Set([
  "yang",
  "dan",
  "di",
  "ke",
  "dari",
  "untuk",
  "dengan",
  "pada",
  "adalah",
  "itu",
  "ini",
  "tersebut",
  "atau",
  "karena",
  "agar",
  "juga",
  "dalam",
  "sebagai",
  "oleh",
  "bahwa",
  "namun",
  "tetapi",
  "saat",
  "ketika",
  "setelah",
  "sebelum",
  "tanpa",
  "sudah",
  "belum",
  "masih",
  "akan",
  "bisa",
  "dapat",
  "harus",
  "lebih",
  "kurang",
  "hanya",
  "hingga",
  "sampai",
  "jadi",
  "yakni",
  "yaitu",
  "ialah",
  "para",
  "kami",
  "kita",
  "saya",
  "aku",
  "anda",
  "mereka",
  "dia",
  "ia",
  "maka",
  "pun",
  "lah",
  "kah",
  "nya",
  "sebuah",
  "seorang",
  "beberapa",
  "banyak",
  "semua",
  "tiap",
  "setiap",
  "antara",
  "hingga",
  "tentang",
  "dalamnya",
  "atas",
  "bawah",
  "secara",
  "langsung",
  "tidak",
  "bukan",
  "ya",
  "iya",
  "nah",
  "si",
  "sang",
  "sehingga",
  "supaya",
  "serta",
  "lagi",
  "pula",
  "telah",
  "sedang",
  "menjadi",
  "terjadi",
  "terhadap",
  "menurut",
  "seperti",
  "bagi",
  "guna",
  "demi",
  "apa",
  "siapa",
  "mana",
  "kapan",
  "mengapa",
  "bagaimana",
  "atau",
  "dll",
  "dsb",
  "yak",
  "oke",
  "ok",
]);

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
let lastPayload = null;

const detectBtn = document.getElementById("detectBtn");
const detectLabel = document.getElementById("detectLabel");
const detectSpinner = document.getElementById("detectSpinner");
const resetBtn = document.getElementById("resetBtn");
const newsText = document.getElementById("newsText");
const sentenceLevelToggle = document.getElementById("sentenceLevelToggle");
const topicPerParagraphToggle = document.getElementById("topicToggle");

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
    topicLike.label,
    topicLike.topic_label,
    topicLike.topic,
    topicLike.name,
    topicLike.topicName,
    topicLike.topicLabel
  );

  if (!label) return { label: null, score: null };

  const score = firstTopicScore(
    topicLike.score,
    topicLike.probability,
    topicLike.topic_score,
    topicLike.topic_probability,
    topicLike.topicScore,
    topicLike.topicProbability,
    topicLike.confidence,
    topicLike.conf,
    topicLike.prob,
    topicLike.pct,
    topicLike.topicProb
  );

  return { label, score };
}

function extractTopicFromParagraph(paragraph) {
  const safe = paragraph && typeof paragraph === "object" ? paragraph : {};

  // 0) compatibility path (legacy): paragraph.topic.label + paragraph.topic.score
  if (safe.topic && typeof safe.topic === "object") {
    const rawLabel = typeof safe.topic.label === "string" ? safe.topic.label.trim() : "";
    if (rawLabel) {
      return {
        label: rawLabel,
        score: normalizeTopicScore(safe.topic.score),
      };
    }
  }

  // 1) paragraph.topic.label + paragraph.topic.score (generic)
  if (safe.topic && typeof safe.topic === "object") {
    const topicObject = extractTopicFromObject({
      label: safe.topic.label,
      score: safe.topic.score,
      probability: safe.topic.probability,
    });
    if (topicObject.label) return topicObject;
  } else if (typeof safe.topic === "string") {
    const label = cleanTopicLabel(safe.topic);
    if (label) return { label, score: null };
  }

  // 2) paragraph.topics.items[0].topic_label + probability/score
  let firstTopicItem = null;
  if (safe.topics && typeof safe.topics === "object" && Array.isArray(safe.topics.items)) {
    firstTopicItem = safe.topics.items[0];
  } else if (
    safe.topics &&
    typeof safe.topics === "object" &&
    Array.isArray(safe.topics.predictions)
  ) {
    firstTopicItem = safe.topics.predictions[0];
  } else if (Array.isArray(safe.topics)) {
    firstTopicItem = safe.topics[0];
  }
  if (firstTopicItem && typeof firstTopicItem === "object") {
    const itemTopic = extractTopicFromObject({
      topic_label: firstTopicItem.topic_label,
      label: firstTopicItem.label,
      topic: firstTopicItem.topic,
      name: firstTopicItem.name,
      probability: firstTopicItem.probability,
      score: firstTopicItem.score,
      topic_score: firstTopicItem.topic_score,
      topic_probability: firstTopicItem.topic_probability,
      confidence: firstTopicItem.confidence,
      conf: firstTopicItem.conf,
      prob: firstTopicItem.prob,
      pct: firstTopicItem.pct,
      topicLabel: firstTopicItem.topicLabel,
      topicProb: firstTopicItem.topicProb,
    });
    if (itemTopic.label) return itemTopic;
  }

  // additional object variants
  const extraTopicObjects = [
    safe.topic_info,
    safe.topic_prediction,
    safe.topicResult,
    safe.topic_result,
  ];
  for (const topicObj of extraTopicObjects) {
    const extracted = extractTopicFromObject(topicObj);
    if (extracted.label) return extracted;
  }

  // 3) paragraph.topic_label + paragraph.topic_score/topic_probability
  const flatLabel = firstTopicLabel(safe.topic_label, safe.topicLabel);
  if (flatLabel) {
    return {
      label: flatLabel,
      score: firstTopicScore(
        safe.topic_score,
        safe.topic_probability,
        safe.topicProb,
        safe.confidence,
        safe.conf,
        safe.prob,
        safe.pct
      ),
    };
  }

  // 4) paragraph.topicName / paragraph.topicScore
  const camelLabel = firstTopicLabel(safe.topicName);
  if (camelLabel) {
    return {
      label: camelLabel,
      score: firstTopicScore(
        safe.topicScore,
        safe.topicProb,
        safe.confidence,
        safe.conf,
        safe.prob,
        safe.pct
      ),
    };
  }

  return { label: null, score: null };
}

function extractGlobalTopic(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};

  // 1) payload.topics_global
  const topicsGlobal = safe.topics_global;
  if (typeof topicsGlobal === "string") {
    const label = cleanTopicLabel(topicsGlobal);
    if (label) {
      return {
        label,
        score: firstTopicScore(safe.topics_global_score, safe.topics_global_probability),
      };
    }
  }
  if (topicsGlobal && typeof topicsGlobal === "object") {
    const direct = extractTopicFromObject(topicsGlobal);
    if (direct.label) return direct;

    if (Array.isArray(topicsGlobal.items) && topicsGlobal.items.length > 0) {
      const fromItems = extractTopicFromObject(topicsGlobal.items[0]);
      if (fromItems.label) return fromItems;
    }
    if (Array.isArray(topicsGlobal.predictions) && topicsGlobal.predictions.length > 0) {
      const fromPredictions = extractTopicFromObject(topicsGlobal.predictions[0]);
      if (fromPredictions.label) return fromPredictions;
    }
  }
  if (Array.isArray(topicsGlobal) && topicsGlobal.length > 0) {
    const fromArray = extractTopicFromObject(topicsGlobal[0]);
    if (fromArray.label) return fromArray;
  }

  // 2) payload.topics (enabled + items[0])
  const topics = safe.topics;
  if (topics && typeof topics === "object") {
    if (Array.isArray(topics.items) && topics.items.length > 0) {
      const fromItems = extractTopicFromObject(topics.items[0]);
      if (fromItems.label) return fromItems;
    }
    if (Array.isArray(topics.predictions) && topics.predictions.length > 0) {
      const fromPredictions = extractTopicFromObject(topics.predictions[0]);
      if (fromPredictions.label) return fromPredictions;
    }
    const direct = extractTopicFromObject(topics);
    if (direct.label) return direct;
  } else if (Array.isArray(topics) && topics.length > 0) {
    const fromArray = extractTopicFromObject(topics[0]);
    if (fromArray.label) return fromArray;
  }

  // 3) payload.topic / payload.topic_label
  if (typeof safe.topic === "string") {
    const label = cleanTopicLabel(safe.topic);
    if (label) {
      return {
        label,
        score: firstTopicScore(
          safe.topic_score,
          safe.topic_probability,
          safe.topicScore,
          safe.topicProb,
          safe.confidence,
          safe.conf,
          safe.prob,
          safe.pct
        ),
      };
    }
  }
  if (safe.topic && typeof safe.topic === "object") {
    const fromTopicObject = extractTopicFromObject(safe.topic);
    if (fromTopicObject.label) return fromTopicObject;
  }

  const additionalObjects = [safe.topic_info, safe.topic_prediction, safe.topicResult, safe.topic_result];
  for (const candidate of additionalObjects) {
    const extracted = extractTopicFromObject(candidate);
    if (extracted.label) return extracted;
  }

  const topicLabel = firstTopicLabel(safe.topic_label, safe.topicLabel);
  if (topicLabel) {
    return {
      label: topicLabel,
      score: firstTopicScore(
        safe.topic_score,
        safe.topic_probability,
        safe.topicScore,
        safe.topicProb,
        safe.confidence,
        safe.conf,
        safe.prob,
        safe.pct
      ),
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

  const tokens = cleaned
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !ID_STOPWORDS.has(token));
  if (tokens.length === 0) return { label: null, score: null };

  const freq = new Map();
  tokens.forEach((token) => {
    freq.set(token, (freq.get(token) || 0) + 1);
  });

  const ranked = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
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
    return {
      label: backendLabel,
      score: normalizeTopicScore(backendTopic?.score),
    };
  }

  if (isFallback) {
    const localTopic = inferTopicLocal(paragraphText);
    const localLabel = cleanTopicLabel(localTopic?.label);
    if (localLabel) {
      return {
        label: localLabel,
        score: normalizeTopicScore(localTopic?.score),
      };
    }
  }

  const globalLabel = cleanTopicLabel(globalTopic?.label);
  if (globalLabel) {
    return {
      label: globalLabel,
      score: normalizeTopicScore(globalTopic?.score),
    };
  }

  return { label: null, score: null };
}

function debugTopicSnippet(payload) {
  const paragraph0 =
    payload && Array.isArray(payload.paragraphs) && payload.paragraphs.length > 0
      ? payload.paragraphs[0]
      : null;

  const candidate =
    payload?.topic ||
    payload?.topics ||
    payload?.topics_global ||
    payload?.topic_info ||
    payload?.topic_prediction ||
    payload?.topicResult ||
    payload?.topic_result ||
    paragraph0?.topic ||
    paragraph0?.topics ||
    paragraph0?.topic_label ||
    paragraph0?.topicLabel ||
    paragraph0?.topic_info ||
    paragraph0?.topic_prediction ||
    paragraph0?.topicResult ||
    paragraph0?.topic_result ||
    null;

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
  if (!isDebug) {
    clearDebugBox();
    return;
  }

  const box = getDebugBox();
  if (!box) return;

  const topKeys =
    payload && typeof payload === "object" ? Object.keys(payload).sort().slice(0, 80) : [];
  const paragraph0 =
    payload && Array.isArray(payload.paragraphs) && payload.paragraphs.length > 0
      ? payload.paragraphs[0]
      : null;
  const paragraph0Keys =
    paragraph0 && typeof paragraph0 === "object" ? Object.keys(paragraph0).sort().slice(0, 80) : [];

  const hasGlobalTopic = Boolean(cleanTopicLabel(globalTopic?.label));
  const hasParagraphTopic = Array.isArray(model?.items)
    ? model.items.some((item) => item.hasTopicLabel)
    : false;
  const hasPayload = payload && typeof payload === "object";
  const paragraphs = hasPayload && Array.isArray(payload.paragraphs) ? payload.paragraphs : [];
  const globalPresence = hasPayload
    ? {
        topics: Object.prototype.hasOwnProperty.call(payload, "topics"),
        topics_global: Object.prototype.hasOwnProperty.call(payload, "topics_global"),
        topic: Object.prototype.hasOwnProperty.call(payload, "topic"),
        topic_label: Object.prototype.hasOwnProperty.call(payload, "topic_label"),
        topic_info: Object.prototype.hasOwnProperty.call(payload, "topic_info"),
        topic_prediction: Object.prototype.hasOwnProperty.call(payload, "topic_prediction"),
      }
    : {
        topics: false,
        topics_global: false,
        topic: false,
        topic_label: false,
        topic_info: false,
        topic_prediction: false,
      };

  const paragraphPresenceLines = [];
  for (let i = 0; i < Math.min(paragraphs.length, 6); i += 1) {
    const p = paragraphs[i] && typeof paragraphs[i] === "object" ? paragraphs[i] : {};
    const hasTopic = Object.prototype.hasOwnProperty.call(p, "topic");
    const hasTopics = Object.prototype.hasOwnProperty.call(p, "topics");
    const hasTopicLabel = Object.prototype.hasOwnProperty.call(p, "topic_label");
    const hasTopicLabelCamel = Object.prototype.hasOwnProperty.call(p, "topicLabel");

    paragraphPresenceLines.push(
      `P${i + 1} keysHas: topic=${hasTopic} topics=${hasTopics} topic_label=${hasTopicLabel} topicLabel=${hasTopicLabelCamel}`
    );

    if (hasTopic) {
      let preview = "null";
      try {
        preview = JSON.stringify(p.topic);
      } catch (_err) {
        preview = "[topicPreview tidak bisa di-serialize]";
      }
      if (typeof preview === "string" && preview.length > 200) {
        preview = `${preview.slice(0, 200)}...`;
      }
      paragraphPresenceLines.push(`P${i + 1} topicPreview: ${preview}`);
    }
  }

  const debugNote =
    !hasGlobalTopic && !hasParagraphTopic
      ? "Backend tidak mengirim data topik. UI tidak dapat menampilkan topik."
      : "Topik terdeteksi dari payload.";
  const fallbackLine = `isFallback=${Boolean(options?.isFallback)}`;

  box.textContent = [
    "[DEBUG topic]",
    fallbackLine,
    `payload keys: ${topKeys.join(", ") || "-"}`,
    `paragraph[0] keys: ${paragraph0Keys.join(", ") || "-"}`,
    `global keysHas: topics=${globalPresence.topics} topics_global=${globalPresence.topics_global} topic=${globalPresence.topic} topic_label=${globalPresence.topic_label} topic_info=${globalPresence.topic_info} topic_prediction=${globalPresence.topic_prediction}`,
    ...paragraphPresenceLines,
    "topic snippet:",
    debugTopicSnippet(payload),
    `note: ${debugNote}`,
  ].join("\n");
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
  clearDebugBox();

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

async function callAnalyzeApi(text, topicPerParagraph, sentenceLevel) {
  if (!apiBaseUrl) throw new Error("API base URL kosong.");

  const endpoint = `${apiBaseUrl}/analyze`;
  const parsePayload = async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      const detail = payload && payload.detail ? payload.detail : response.statusText;
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

    // Kompatibilitas backend lama: retry sekali jika field baru ditolak.
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
      topic: null,
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

function prepareParagraphModel(
  paragraphs,
  globalTopic = { label: null, score: null },
  options = {}
) {
  const sorted = sortByParagraphIndex(paragraphs);
  const items = [];
  const isFallback = Boolean(options?.isFallback);
  const topicPerParagraph = Boolean(options?.topicPerParagraph);
  const inputParagraphTexts = Array.isArray(options?.inputParagraphTexts)
    ? options.inputParagraphTexts
    : [];

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

    const paragraphTextForTopic = String(
      paragraph?.text ?? inputParagraphTexts[index] ?? ""
    );
    let normalizedTopicLabel = null;
    let resolvedTopicScore = null;
    let hasTopicLabel = false;
    let hasTopicScore = false;

    if (topicPerParagraph) {
      const resolvedTopic = resolveParagraphTopic(
        paragraph,
        globalTopic,
        paragraphTextForTopic,
        isFallback
      );
      normalizedTopicLabel = cleanTopicLabel(resolvedTopic?.label);
      resolvedTopicScore = normalizeTopicScore(resolvedTopic?.score);
      hasTopicLabel = Boolean(normalizedTopicLabel);
      hasTopicScore =
        hasTopicLabel &&
        Number.isFinite(Number(resolvedTopicScore)) &&
        Number(resolvedTopicScore) > 0;
    }

    items.push({
      paragraphNumber,
      paragraphLabel,
      topicLabel: normalizedTopicLabel || "-",
      topicScore: resolvedTopicScore,
      hasTopicLabel,
      hasTopicScore,
      paragraphText: paragraphTextForTopic,
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

function renderOutputInlineWithPayload(payload, paragraphs, options = {}) {
  if (!outputSection || !outputParagraphs || !globalSummary) return null;

  outputParagraphs.innerHTML = "";
  const globalTopic = extractGlobalTopic(payload);
  const topicPerParagraph = Boolean(options?.topicPerParagraph);
  const sentenceLevel = options?.sentenceLevel !== false;
  const model = prepareParagraphModel(paragraphs, globalTopic, options);

  let summaryText =
    `Ringkasan: ${labelText(model.overallLabel)} • ${model.counts.paragraphCount} paragraf • ` +
    `${model.counts.sentenceCount} kalimat • Hoaks ${model.counts.sentenceHoaksCount} • ` +
    `Fakta ${model.counts.sentenceFaktaCount} • Ragu ${model.counts.sentenceRaguCount} • ` +
    `Paragraf Hoaks ${model.counts.paragraphHoaksCount}`;
  const globalTopicLabel = cleanTopicLabel(globalTopic.label);
  if (!topicPerParagraph && globalTopicLabel) {
    const globalTopicScore = normalizeTopicScore(globalTopic.score);
    const globalTopicText =
      globalTopicScore !== null && globalTopicScore > 0
        ? `${globalTopicLabel} (${formatPercent(globalTopicScore)})`
        : globalTopicLabel;
    summaryText += ` • Topik Global: ${globalTopicText}`;
  }
  globalSummary.textContent = summaryText;

  if (model.items.length === 0) {
    outputParagraphs.innerHTML =
      '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    outputSection.classList.remove("hidden");
    renderTopicDebug(payload, globalTopic, model, options);
    return { model, globalTopic };
  }

  const fragment = document.createDocumentFragment();

  model.items.forEach((item) => {
    const block = document.createElement("article");
    block.className = "paragraph-block";

    const meta = document.createElement("p");
    meta.className = "paragraph-meta";
    if (topicPerParagraph) {
      const topicMetaText = formatTopicMeta(item.topicLabel, item.topicScore);
      meta.textContent = `Paragraf ${item.paragraphNumber} • ${topicMetaText}`;
    } else {
      meta.textContent = `Paragraf ${item.paragraphNumber}`;
    }

    const text = document.createElement("p");
    text.className = "paragraph-text";

    if (sentenceLevel) {
      const highlighted = joinHighlightedSentences(item.sentences);
      if (highlighted) {
        text.innerHTML = highlighted;
      } else {
        text.innerHTML = escapeHtml(item.paragraphText);
      }
    } else {
      const paraPrediction = item.sentences[0] || null;
      if (paraPrediction) {
        const normalized = normalizeLabel(paraPrediction?.label);
        const confidence = Number(paraPrediction?.confidence);
        const hlClass = kelasHighlight(normalized, confidence, CONFIDENCE_CUTOFF);
        const title = `${labelText(normalized)} | confidence ${formatPercent(confidence)}`;
        text.innerHTML = `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(
          item.paragraphText
        )}</span>`;
      } else {
        text.innerHTML = escapeHtml(item.paragraphText);
      }
    }

    block.appendChild(meta);
    block.appendChild(text);
    fragment.appendChild(block);
  });

  outputParagraphs.appendChild(fragment);
  outputSection.classList.remove("hidden");
  renderTopicDebug(payload, globalTopic, model, options);

  return { model, globalTopic };
}

function renderOutputInline(paragraphs) {
  return renderOutputInlineWithPayload(null, paragraphs, {
    topicPerParagraph: true,
    sentenceLevel: true,
  });
}

function renderConfidenceDetails(
  paragraphs,
  globalTopic = { label: null, score: null },
  options = {}
) {
  if (!confidenceDetails || !confidenceSummary || !confidenceList) return;

  const model = prepareParagraphModel(paragraphs, globalTopic, options);
  const sentenceLevel = options?.sentenceLevel !== false;

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

  if (sentenceLevel) {
    model.items.forEach((item) => {
      item.sentences.forEach((sentence, sIdx) => {
        const sentenceNumber = Number.isFinite(Number(sentence?.sentence_index))
          ? Number(sentence.sentence_index) + 1
          : sIdx + 1;

        const confidence = Number(sentence?.confidence);
        const pHoax = getSentenceHoaxProbability(sentence);
        const pFakta = getSentenceFaktaProbability(sentence);

        const fullText = String(sentence?.text ?? "").trim();
        const shortText = truncate(fullText, DETAIL_TEXT_MAX_LEN);

        const li = document.createElement("li");
        li.className = "confidence-item";
        li.title = fullText || "(teks kosong)";

        const head = document.createElement("div");
        head.className = "confidence-head";

        const pos = document.createElement("span");
        pos.className = "confidence-pos";
        pos.textContent = `P${item.paragraphNumber} S${sentenceNumber}`;

        const badge = document.createElement("span");
        badge.className = `confidence-badge ${badgeClass(sentence?.label, confidence)}`;
        badge.textContent = badgeText(sentence?.label, confidence);

        head.appendChild(pos);
        head.appendChild(badge);

        const metrics = document.createElement("div");
        metrics.className = "confidence-metrics";

        const metricConfidence = document.createElement("span");
        metricConfidence.className = "confidence-metric";
        metricConfidence.textContent = `Confidence ${formatPercent(confidence)}`;

        const metricHoax = document.createElement("span");
        metricHoax.className = "confidence-metric";
        metricHoax.textContent = `P(hoaks) ${formatPercent(pHoax)}`;

        const metricFakta = document.createElement("span");
        metricFakta.className = "confidence-metric";
        metricFakta.textContent = `P(fakta) ${formatPercent(pFakta)}`;

        metrics.appendChild(metricConfidence);
        metrics.appendChild(metricHoax);
        metrics.appendChild(metricFakta);

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
      const sentence = item.sentences[0] || {};
      const confidence = Number(sentence?.confidence);
      const pHoax = getSentenceHoaxProbability(sentence);
      const pFakta = getSentenceFaktaProbability(sentence);

      const fullText = String(item.paragraphText || sentence?.text || "").trim();
      const shortText = truncate(fullText, DETAIL_TEXT_MAX_LEN);

      const li = document.createElement("li");
      li.className = "confidence-item";
      li.title = fullText || "(teks kosong)";

      const head = document.createElement("div");
      head.className = "confidence-head";

      const pos = document.createElement("span");
      pos.className = "confidence-pos";
      pos.textContent = `P${item.paragraphNumber}`;

      const badge = document.createElement("span");
      badge.className = `confidence-badge ${badgeClass(sentence?.label, confidence)}`;
      badge.textContent = badgeText(sentence?.label, confidence);

      head.appendChild(pos);
      head.appendChild(badge);

      const metrics = document.createElement("div");
      metrics.className = "confidence-metrics";

      const metricConfidence = document.createElement("span");
      metricConfidence.className = "confidence-metric";
      metricConfidence.textContent = `Confidence ${formatPercent(confidence)}`;

      const metricHoax = document.createElement("span");
      metricHoax.className = "confidence-metric";
      metricHoax.textContent = `P(hoaks) ${formatPercent(pHoax)}`;

      const metricFakta = document.createElement("span");
      metricFakta.className = "confidence-metric";
      metricFakta.textContent = `P(fakta) ${formatPercent(pFakta)}`;

      metrics.appendChild(metricConfidence);
      metrics.appendChild(metricHoax);
      metrics.appendChild(metricFakta);

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
  const sentenceLevel = sentenceLevelToggle ? Boolean(sentenceLevelToggle.checked) : true;
  const topicPerParagraph = Boolean(topicPerParagraphToggle?.checked);

  setLoading(true);
  try {
    const payload = await callAnalyzeApi(textToSend, topicPerParagraph, sentenceLevel);
    lastPayload = payload;
    const backendParagraphCount = Array.isArray(lastPayload?.paragraphs)
      ? lastPayload.paragraphs.length
      : 0;
    const isFallback = backendParagraphCount === 1 && inputParagraphTexts.length > 1;
    const paragraphs = extractParagraphs(lastPayload, textToSend);
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
    });
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
