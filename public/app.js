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

function getSentenceHoaxProbability(sentence) {
  if (Number.isFinite(Number(sentence?.hoax_probability))) {
    return Number(sentence.hoax_probability);
  }
  if (sentence?.probabilities && Number.isFinite(Number(sentence.probabilities.hoax))) {
    return Number(sentence.probabilities.hoax);
  }
  if (sentence?.probabilities && Number.isFinite(Number(sentence.probabilities.Hoax))) {
    return Number(sentence.probabilities.Hoax);
  }
  return 0;
}

function getSentenceFaktaProbability(sentence) {
  const probs = sentence?.probabilities || {};
  if (Number.isFinite(Number(probs.not_hoax))) {
    return Number(probs.not_hoax);
  }
  if (Number.isFinite(Number(probs.fakta))) {
    return Number(probs.fakta);
  }
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
  if (!outputSection || !outputParagraphs) return;

  outputParagraphs.innerHTML = "";

  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    outputParagraphs.innerHTML =
      '<p class="paragraph-meta">Tidak ada paragraf yang bisa ditampilkan.</p>';
    outputSection.classList.remove("hidden");
    return;
  }

  const sortedParagraphs = [...paragraphs].sort((a, b) => {
    const ai = Number.isFinite(Number(a?.paragraph_index)) ? Number(a.paragraph_index) : 0;
    const bi = Number.isFinite(Number(b?.paragraph_index)) ? Number(b.paragraph_index) : 0;
    return ai - bi;
  });

  const fragment = document.createDocumentFragment();

  sortedParagraphs.forEach((paragraph, index) => {
    const paragraphIndex = Number.isFinite(Number(paragraph?.paragraph_index))
      ? Number(paragraph.paragraph_index) + 1
      : index + 1;

    const topicLabelRaw = paragraph?.topic?.label;
    const topicLabel =
      typeof topicLabelRaw === "string" && topicLabelRaw.trim() ? topicLabelRaw.trim() : "-";
    const topicScore = Number(paragraph?.topic?.score);
    const topicScoreText = Number.isFinite(topicScore)
      ? ` (skor ${formatPercent(topicScore)})`
      : "";

    const sentences = Array.isArray(paragraph?.sentences) ? [...paragraph.sentences] : [];
    sentences.sort((a, b) => {
      const ai = Number.isFinite(Number(a?.sentence_index)) ? Number(a.sentence_index) : 0;
      const bi = Number.isFinite(Number(b?.sentence_index)) ? Number(b.sentence_index) : 0;
      return ai - bi;
    });

    const block = document.createElement("article");
    block.className = "paragraph-block";

    const meta = document.createElement("p");
    meta.className = "paragraph-meta";
    meta.textContent = `Paragraf ${paragraphIndex} • Topik: ${topicLabel}${topicScoreText}`;

    const text = document.createElement("p");
    text.className = "paragraph-text";

    if (sentences.length > 0) {
      const inlineHtml = sentences
        .map((sentence) => {
          const sentenceText = String(sentence?.text || "").trim();
          if (!sentenceText) return "";

          const normalized = normalizeLabel(sentence?.label);
          const conf = Number(sentence?.confidence);
          const hlClass = kelasHighlight(normalized, conf, 0.65);
          const title = `${labelText(normalized)} | confidence ${formatPercent(conf)}`;
          return `<span class="hl ${hlClass}" title="${escapeHtml(title)}">${escapeHtml(
            sentenceText
          )}</span>`;
        })
        .filter(Boolean)
        .join(" ");

      text.innerHTML = inlineHtml || escapeHtml(String(paragraph?.text || ""));
    } else {
      text.innerHTML = escapeHtml(String(paragraph?.text || ""));
    }

    block.appendChild(meta);
    block.appendChild(text);
    fragment.appendChild(block);
  });

  outputParagraphs.appendChild(fragment);
  outputSection.classList.remove("hidden");
}

function renderConfidenceDetails(paragraphs) {
  if (!confidenceDetails || !confidenceSummary || !confidenceList) return;

  const rows = [];
  let totalSentences = 0;
  let totalHoaks = 0;
  let totalFakta = 0;
  let totalRagu = 0;

  const safeParagraphs = Array.isArray(paragraphs) ? paragraphs : [];

  safeParagraphs.forEach((paragraph, pIdx) => {
    const paragraphNumber = Number.isFinite(Number(paragraph?.paragraph_index))
      ? Number(paragraph.paragraph_index) + 1
      : pIdx + 1;

    const sentences = Array.isArray(paragraph?.sentences) ? [...paragraph.sentences] : [];
    sentences.sort((a, b) => {
      const ai = Number.isFinite(Number(a?.sentence_index)) ? Number(a.sentence_index) : 0;
      const bi = Number.isFinite(Number(b?.sentence_index)) ? Number(b.sentence_index) : 0;
      return ai - bi;
    });

    sentences.forEach((sentence, sIdx) => {
      totalSentences += 1;

      const normalized = normalizeLabel(sentence?.label);
      const conf = Number(sentence?.confidence);
      const pHoax = getSentenceHoaxProbability(sentence);
      const pFakta = getSentenceFaktaProbability(sentence);

      if (normalized === "hoaks") totalHoaks += 1;
      if (normalized === "fakta") totalFakta += 1;
      if (Number.isFinite(conf) && conf < 0.65) totalRagu += 1;

      const sentenceNumber = Number.isFinite(Number(sentence?.sentence_index))
        ? Number(sentence.sentence_index) + 1
        : sIdx + 1;

      rows.push(
        `P${paragraphNumber} S${sentenceNumber} | ${labelText(normalized)} | confidence ${formatPercent(
          conf
        )} | P(hoaks) ${formatPercent(pHoax)} | P(fakta) ${formatPercent(pFakta)}`
      );
    });
  });

  confidenceSummary.textContent =
    `Rincian Keyakinan • ${safeParagraphs.length} paragraf • ${totalSentences} kalimat • ` +
    `Hoaks ${totalHoaks} • Fakta ${totalFakta} • Ragu ${totalRagu}`;

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

  const text = String(newsText?.value || "").trim();
  if (!text) {
    showError("Masukkan teks berita terlebih dahulu.");
    return;
  }

  setLoading(true);
  try {
    const payload = await callAnalyzeApi(text);
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
