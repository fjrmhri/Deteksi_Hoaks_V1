import json
import os
import random
import re
from collections import defaultdict
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import AutoModelForSequenceClassification, AutoTokenizer

try:
    import joblib
except Exception:
    joblib = None

try:
    from huggingface_hub import snapshot_download
except Exception:
    snapshot_download = None

# =========================
# Konfigurasi & Load Model
# =========================

# Menggunakan repositori IndoBERT yang baru
MODEL_ID = os.getenv("MODEL_ID", "fjrmhri/deteksi_hoaks_indobert")
SUBFOLDER = os.getenv("MODEL_SUBFOLDER", "") or None
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))

THRESH_HIGH = float(os.getenv("HOAX_THRESH_HIGH", "0.98"))
THRESH_MED = float(os.getenv("HOAX_THRESH_MED", "0.60"))

PREDICT_BATCH_SIZE = int(os.getenv("PREDICT_BATCH_SIZE", "64"))
SENTENCE_BATCH_SIZE = int(os.getenv("SENTENCE_BATCH_SIZE", "64"))
SENTENCE_AMBER_CONF = float(os.getenv("SENTENCE_AMBER_CONF", "0.70"))

# Konfigurasi Topik: Hanya menggunakan BERTopic
DEFAULT_TOPIC_MODEL = "bertopic"
ALLOWED_TOPIC_MODELS = {"bertopic"}
TOPIC_KEYWORDS_TOPK = int(os.getenv("TOPIC_KEYWORDS_TOPK", "3"))
TOPIC_MAX_FEATURES = int(os.getenv("TOPIC_MAX_FEATURES", "1500"))
TOPIC_ARTIFACT_CACHE_DIR = os.getenv(
    "TOPIC_ARTIFACT_CACHE_DIR", "/tmp/deteksi_hoaks_topic_models"
)

# Menggunakan repositori BERTopic yang baru
TOPIC_BERTOPIC_MODEL_ID = os.getenv("TOPIC_BERTOPIC_MODEL_ID", "fjrmhri/deteksi_hoaks_bertopic").strip()
ENABLE_BERTOPIC_ENGINE = True  # Diwajibkan aktif
TOPIC_BERTOPIC_EMBED_BATCH = int(os.getenv("TOPIC_BERTOPIC_EMBED_BATCH", "32"))

ENABLE_LOGGING = os.getenv("ENABLE_HOAX_LOGGING", "0") == "1"
LOG_SAMPLE_RATE = float(os.getenv("HOAX_LOG_SAMPLE_RATE", "0.2"))

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
if torch.cuda.is_available():
    torch.set_float32_matmul_precision("high")

print("======================================")
print(f"Loading model from Hub: {MODEL_ID}")
print(f"Using subfolder: {SUBFOLDER}")
print(f"Running on device: {DEVICE}")
print(f"MAX_LENGTH = {MAX_LENGTH} | SENTENCE_BATCH_SIZE = {SENTENCE_BATCH_SIZE}")
print(f"THRESH_HIGH = {THRESH_HIGH}, THRESH_MED = {THRESH_MED}")
print(f"ENABLE_LOGGING = {ENABLE_LOGGING}, LOG_SAMPLE_RATE = {LOG_SAMPLE_RATE}")
print("======================================")

def _load_model_artifacts():
    load_kwargs = {}
    if SUBFOLDER:
        load_kwargs["subfolder"] = SUBFOLDER

    try:
        tok = AutoTokenizer.from_pretrained(MODEL_ID, **load_kwargs)
        mdl = AutoModelForSequenceClassification.from_pretrained(
            MODEL_ID, **load_kwargs
        )
        return tok, mdl
    except Exception as e:
        if SUBFOLDER:
            print(
                f"[WARN] Gagal load dengan subfolder='{SUBFOLDER}'. Retry tanpa subfolder. "
                f"Detail: {e}"
            )
            tok = AutoTokenizer.from_pretrained(MODEL_ID)
            mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
            return tok, mdl
        raise


tokenizer, model = _load_model_artifacts()
model.to(DEVICE)
model.eval()

# Mapping id → label
if getattr(model.config, "id2label", None):
    ID2LABEL: Dict[int, str] = {int(k): v for k, v in model.config.id2label.items()}
else:
    ID2LABEL = {0: "not_hoax", 1: "hoax"}


# =========================
# FastAPI setup
# =========================

app = FastAPI(
    title="Indo Hoax Detector API",
    description="API FastAPI untuk deteksi berita hoaks (model IndoBERT).",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# Schemas
# =========================

class PredictRequest(BaseModel):
    text: str


class BatchPredictRequest(BaseModel):
    texts: List[str]


class PredictResponse(BaseModel):
    label: str
    score: float
    probabilities: Dict[str, float]
    hoax_probability: float
    risk_level: str
    risk_explanation: str


class BatchPredictResponse(BaseModel):
    results: List[PredictResponse]


class AnalyzeRequest(BaseModel):
    text: str
    topic_per_paragraph: bool = False
    sentence_level: bool = True


class DocumentSummary(BaseModel):
    paragraph_count: int
    sentence_count: int
    hoax_sentence_count: int
    not_hoax_sentence_count: int


class DocumentAnalysis(BaseModel):
    label: str
    hoax_probability: float
    confidence: float
    risk_level: str
    risk_explanation: str
    sentence_aggregate_label: str
    summary: DocumentSummary


class TopicInfo(BaseModel):
    label: str
    score: float
    keywords: List[str]


class SentenceAnalysis(BaseModel):
    sentence_index: int
    text: str
    label: str
    probabilities: Dict[str, float]
    hoax_probability: float
    confidence: float
    color: str


class ParagraphAnalysis(BaseModel):
    paragraph_index: int
    text: str
    label: str
    hoax_probability: float
    confidence: float
    topic: TopicInfo
    sentences: List[SentenceAnalysis]


class SharedTopic(BaseModel):
    label: str
    paragraph_indices: List[int]


class AnalyzeMeta(BaseModel):
    model_id: str
    max_length: int
    sentence_batch_size: int


class AnalyzeResponse(BaseModel):
    document: DocumentAnalysis
    paragraphs: List[ParagraphAnalysis]
    shared_topics: List[SharedTopic]
    topics_global: Optional[TopicInfo] = None
    meta: AnalyzeMeta


# =========================
# Util inferensi
# =========================

PARAGRAPH_SPLIT_RE = re.compile(r"(?:\r?\n){2,}")
SENTENCE_SPLIT_RE = re.compile(r'[^.!?]+(?:[.!?]+(?:["\)\]]+)?)|[^.!?]+$')
WS_RE = re.compile(r"\s+")
TOKEN_RE = re.compile(r"[a-zA-Z]{3,}")

ID_STOPWORDS = {
    "yang", "dan", "atau", "di", "ke", "dari", "untuk", "dengan", "pada",
    "adalah", "itu", "ini", "dalam", "sebagai", "karena", "juga", "agar",
    "oleh", "saat", "akan", "telah", "sudah", "tidak", "iya", "ya", "kita",
    "mereka", "kami", "anda", "hingga", "lebih", "masih", "dapat", "bisa",
    "setelah", "sebelum", "tersebut", "terhadap", "disebut", "menurut", "para",
    "sebuah", "adanya", "yakni", "bahwa", "dari", "untuk", "the", "dan", "atau",
}


def _round6(v: float) -> float:
    return float(round(float(v), 6))


def _iter_chunks(items: List[str], chunk_size: int) -> Iterable[List[str]]:
    if chunk_size <= 0:
        chunk_size = 1
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]


def _normalize_unit_text(text: str) -> str:
    return WS_RE.sub(" ", str(text)).strip()


def _prepare_texts(texts: List[str]) -> List[str]:
    processed = []
    for t in texts:
        if t is None:
            t = ""
        t = _normalize_unit_text(t)
        processed.append(t if t else "[EMPTY]")
    return processed


def _predict_proba(texts: List[str], batch_size: int = SENTENCE_BATCH_SIZE) -> List[Dict[str, float]]:
    if not texts:
        return []

    prepared_texts = _prepare_texts(texts)

    # Dedup teks agar komputasi lebih hemat saat ada kalimat berulang.
    unique_texts: List[str] = []
    text_to_unique_idx: Dict[str, int] = {}
    inverse_indices: List[int] = []
    for t in prepared_texts:
        if t not in text_to_unique_idx:
            text_to_unique_idx[t] = len(unique_texts)
            unique_texts.append(t)
        inverse_indices.append(text_to_unique_idx[t])

    unique_results: List[Dict[str, float]] = []
    for chunk in _iter_chunks(unique_texts, batch_size):
        encodings = tokenizer(
            chunk,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        encodings = {k: v.to(DEVICE) for k, v in encodings.items()}

        with torch.inference_mode():
            outputs = model(**encodings)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1).cpu().numpy()

        for row in probs:
            prob_dict: Dict[str, float] = {}
            for idx, p in enumerate(row):
                label_name = ID2LABEL.get(idx, str(idx))
                prob_dict[label_name] = float(p)
            unique_results.append(prob_dict)

    return [dict(unique_results[i]) for i in inverse_indices]


def _normalize_label_key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(label).lower()).strip("_")


def _extract_hoax_probability(prob_dict: Dict[str, float]) -> float:
    if not prob_dict:
        return 0.0

    normalized = {k: _normalize_label_key(k) for k in prob_dict.keys()}

    for k, nk in normalized.items():
        if nk in {"hoax", "hoaks"}:
            return float(prob_dict[k])

    for k, nk in normalized.items():
        if "hoax" in nk and "not" not in nk and "non" not in nk:
            return float(prob_dict[k])

    if len(prob_dict) == 2:
        for k, nk in normalized.items():
            if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
                return float(1.0 - float(prob_dict[k]))

    return 0.0


def _extract_not_hoax_probability(prob_dict: Dict[str, float], p_hoax: float) -> float:
    if not prob_dict:
        return float(1.0 - p_hoax)

    normalized = {k: _normalize_label_key(k) for k in prob_dict.keys()}
    for k, nk in normalized.items():
        if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
            return float(prob_dict[k])

    return float(max(0.0, min(1.0, 1.0 - p_hoax)))


def analyze_risk(prob_dict: Dict[str, float], original_text: Optional[str] = None) -> Tuple[float, str, str]:
    """
    Dari prob_dict + teks asli → (p_hoax, risk_level, risk_explanation)
    Threshold:
      - p_hoax > THRESH_HIGH         → high   (Hoaks – tingkat tinggi)
      - THRESH_MED < p_hoax ≤ HIGH   → medium (Perlu dicek / curiga)
      - p_hoax ≤ THRESH_MED          → low    (Cenderung bukan hoaks)
    Teks sangat pendek (< 5 kata) → minimal 'medium'
    """
    p_hoax = _extract_hoax_probability(prob_dict)

    if p_hoax > THRESH_HIGH:
        level = "high"
        explanation = (
            f"Model sangat yakin teks ini hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Sebaiknya jangan dipercaya sebelum ada klarifikasi resmi atau sumber tepercaya."
        )
    elif p_hoax > THRESH_MED:
        level = "medium"
        explanation = (
            f"Model menilai teks ini berpotensi hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Disarankan untuk mengecek ulang ke sumber resmi sebelum menyebarkan."
        )
    else:
        level = "low"
        explanation = (
            f"Model menilai teks ini cenderung bukan hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Meski demikian, tetap gunakan literasi dan bandingkan dengan sumber lain."
        )

    if original_text is not None:
        word_count = len(str(original_text).strip().split())
        if word_count < 5:
            if level == "low":
                level = "medium"
            explanation += (
                " Catatan: teks ini sangat pendek (< 5 kata), sehingga prediksi model "
                "bisa kurang stabil. Gunakan hasil ini dengan ekstra hati-hati."
            )

    return p_hoax, level, explanation


def _split_paragraphs(text: str) -> List[str]:
    raw = str(text).strip()
    if not raw:
        return []

    paragraphs = [p.strip() for p in PARAGRAPH_SPLIT_RE.split(raw) if p.strip()]
    if len(paragraphs) <= 1 and "\n" in raw:
        line_based = [p.strip() for p in raw.splitlines() if p.strip()]
        if len(line_based) > 1:
            return line_based
    return paragraphs if paragraphs else [raw]


def _split_sentences(paragraph: str) -> List[str]:
    normalized = _normalize_unit_text(paragraph)
    if not normalized:
        return []
    sentences = [m.group(0).strip() for m in SENTENCE_SPLIT_RE.finditer(normalized)]
    return [s for s in sentences if s] or [normalized]


def _sentence_color(label: str, confidence: float) -> str:
    if label == "hoax":
        return "red"
    if confidence < SENTENCE_AMBER_CONF:
        return "amber"
    return "green"


def _extract_topics(paragraph_texts: List[str]) -> List[TopicInfo]:
    if not paragraph_texts:
        return []

    topics: List[TopicInfo] = []
    try:
        vectorizer = TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            max_features=TOPIC_MAX_FEATURES,
            token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b",
            stop_words=list(ID_STOPWORDS),
        )
        matrix = vectorizer.fit_transform(paragraph_texts)
        features = vectorizer.get_feature_names_out()

        for i in range(matrix.shape[0]):
            row = matrix.getrow(i)
            if row.nnz == 0:
                tokens = [
                    t for t in TOKEN_RE.findall(paragraph_texts[i].lower())
                    if t not in ID_STOPWORDS
                ]
                uniq_tokens: List[str] = []
                for tok in tokens:
                    if tok not in uniq_tokens:
                        uniq_tokens.append(tok)
                keywords = uniq_tokens[:TOPIC_KEYWORDS_TOPK] if uniq_tokens else ["topik_umum"]
                score = 0.0
            else:
                pairs = sorted(
                    zip(row.indices, row.data),
                    key=lambda x: (-x[1], features[x[0]]),
                )[:TOPIC_KEYWORDS_TOPK]
                keywords = [features[idx] for idx, _ in pairs] or ["topik_umum"]
                score = float(np.mean([float(v) for _, v in pairs])) if pairs else 0.0

            topic_label = " / ".join(keywords[:2]) if keywords else "topik_umum"
            topics.append(
                TopicInfo(
                    label=topic_label,
                    score=_round6(score),
                    keywords=keywords[:TOPIC_KEYWORDS_TOPK],
                )
            )
    except Exception:
        for text in paragraph_texts:
            tokens = [t for t in TOKEN_RE.findall(text.lower()) if t not in ID_STOPWORDS]
            uniq_tokens: List[str] = []
            for tok in tokens:
                if tok not in uniq_tokens:
                    uniq_tokens.append(tok)
            keywords = uniq_tokens[:TOPIC_KEYWORDS_TOPK] if uniq_tokens else ["topik_umum"]
            topics.append(
                TopicInfo(
                    label=" / ".join(keywords[:2]) if keywords else "topik_umum",
                    score=0.0,
                    keywords=keywords[:TOPIC_KEYWORDS_TOPK],
                )
            )

    return topics


def _to_canonical_label(p_hoax: float) -> str:
    return "hoax" if p_hoax >= 0.5 else "not_hoax"


def _build_predict_response(prob_dict: Dict[str, float], original_text: str) -> PredictResponse:
    label = max(prob_dict, key=prob_dict.get)
    score = float(prob_dict[label])
    p_hoax, risk_level, risk_explanation = analyze_risk(prob_dict, original_text=original_text)

    return PredictResponse(
        label=label,
        score=score,
        probabilities=prob_dict,
        hoax_probability=float(p_hoax),
        risk_level=risk_level,
        risk_explanation=risk_explanation,
    )


def _maybe_log(sample_info: Dict):
    if not ENABLE_LOGGING:
        return
    if random.random() > LOG_SAMPLE_RATE:
        return
    print("[HOAX_LOG]", sample_info)


# =========================
# Routes
# =========================

@app.get("/")
def read_root():
    return {
        "message": "Indo Hoax Detector API is running.",
        "model_id": MODEL_ID,
        "subfolder": SUBFOLDER,
        "labels": ID2LABEL,
        "max_length": MAX_LENGTH,
        "device": str(DEVICE),
        "predict_batch_size": PREDICT_BATCH_SIZE,
        "sentence_batch_size": SENTENCE_BATCH_SIZE,
        "risk_thresholds": {
            "high": f"P(hoaks) > {THRESH_HIGH}",
            "medium": f"{THRESH_MED} < P(hoaks) ≤ {THRESH_HIGH}",
            "low": f"P(hoaks) ≤ {THRESH_MED}",
        },
        "logging": {
            "enabled": ENABLE_LOGGING,
            "sample_rate": LOG_SAMPLE_RATE,
        },
        "endpoints": ["/predict", "/predict-batch", "/analyze"],
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    original_text = request.text
    prob_list = _predict_proba([original_text], batch_size=1)

    if not prob_list:
        return PredictResponse(
            label="unknown",
            score=0.0,
            probabilities={},
            hoax_probability=0.0,
            risk_level="low",
            risk_explanation="Teks kosong, tidak dapat dievaluasi.",
        )

    response = _build_predict_response(prob_list[0], original_text=str(original_text))

    _maybe_log({
        "route": "/predict",
        "text_len": len(str(original_text)),
        "word_count": len(str(original_text).split()),
        "label": response.label,
        "p_hoax": response.hoax_probability,
        "risk_level": response.risk_level,
    })

    return response


@app.post("/predict-batch", response_model=BatchPredictResponse)
def predict_batch(request: BatchPredictRequest):
    texts = request.texts or []
    prob_list = _predict_proba(texts, batch_size=PREDICT_BATCH_SIZE)
    results: List[PredictResponse] = []

    for original_text, prob_dict in zip(texts, prob_list):
        response = _build_predict_response(prob_dict, original_text=str(original_text))
        _maybe_log({
            "route": "/predict-batch",
            "text_len": len(str(original_text)),
            "word_count": len(str(original_text).split()),
            "label": response.label,
            "p_hoax": response.hoax_probability,
            "risk_level": response.risk_level,
        })
        results.append(response)

    return BatchPredictResponse(results=results)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    original_text = _normalize_unit_text(request.text)

    if not original_text:
        empty_summary = DocumentSummary(
            paragraph_count=0,
            sentence_count=0,
            hoax_sentence_count=0,
            not_hoax_sentence_count=0,
        )
        return AnalyzeResponse(
            document=DocumentAnalysis(
                label="not_hoax",
                hoax_probability=0.0,
                confidence=0.0,
                risk_level="low",
                risk_explanation="Teks kosong, tidak dapat dievaluasi.",
                sentence_aggregate_label="not_hoax",
                summary=empty_summary,
            ),
            paragraphs=[],
            shared_topics=[],
            topics_global=None,
            meta=AnalyzeMeta(
                model_id=MODEL_ID,
                max_length=MAX_LENGTH,
                sentence_batch_size=SENTENCE_BATCH_SIZE,
            ),
        )

    # Dokumen utama tetap dari baseline doc-level inferensi.
    doc_prob_list = _predict_proba([original_text], batch_size=1)
    doc_prob_dict = doc_prob_list[0] if doc_prob_list else {"not_hoax": 1.0, "hoax": 0.0}

    p_hoax_doc = _extract_hoax_probability(doc_prob_dict)
    p_not_hoax_doc = _extract_not_hoax_probability(doc_prob_dict, p_hoax_doc)
    doc_label = _to_canonical_label(p_hoax_doc)
    doc_conf = max(p_hoax_doc, p_not_hoax_doc)

    _, risk_level, risk_explanation = analyze_risk(
        {"not_hoax": p_not_hoax_doc, "hoax": p_hoax_doc},
        original_text=original_text,
    )

    paragraph_texts = _split_paragraphs(original_text)

    sentence_texts: List[str] = []
    sentence_map: List[Tuple[int, int]] = []

    for p_idx, paragraph in enumerate(paragraph_texts):
        for s_idx, sentence in enumerate(_split_sentences(paragraph)):
            sentence_texts.append(sentence)
            sentence_map.append((p_idx, s_idx))

    sentence_prob_list = _predict_proba(sentence_texts, batch_size=SENTENCE_BATCH_SIZE)

    paragraph_sentences: List[List[SentenceAnalysis]] = [[] for _ in paragraph_texts]

    for (p_idx, s_idx), sent_text, sent_prob_dict in zip(sentence_map, sentence_texts, sentence_prob_list):
        p_hoax = _extract_hoax_probability(sent_prob_dict)
        p_not_hoax = _extract_not_hoax_probability(sent_prob_dict, p_hoax)
        sent_label = _to_canonical_label(p_hoax)
        sent_conf = max(p_hoax, p_not_hoax)

        paragraph_sentences[p_idx].append(
            SentenceAnalysis(
                sentence_index=int(s_idx),
                text=sent_text,
                label=sent_label,
                probabilities={
                    "not_hoax": _round6(p_not_hoax),
                    "hoax": _round6(p_hoax),
                },
                hoax_probability=_round6(p_hoax),
                confidence=_round6(sent_conf),
                color=_sentence_color(sent_label, sent_conf),
            )
        )

    fallback_topic = TopicInfo(
        label="topik_umum",
        score=0.0,
        keywords=["topik_umum"],
    )

    topics_global: Optional[TopicInfo] = None
    if request.topic_per_paragraph:
        topics = _extract_topics(paragraph_texts)
    else:
        doc_for_topic = "\n\n".join(paragraph_texts)
        global_topics = _extract_topics([doc_for_topic]) if doc_for_topic else []
        global_topic = global_topics[0] if global_topics else fallback_topic
        topics_global = global_topic
        topics = [global_topic for _ in paragraph_texts]

    paragraphs: List[ParagraphAnalysis] = []
    hoax_sentence_count = 0
    not_hoax_sentence_count = 0

    for p_idx, p_text in enumerate(paragraph_texts):
        sents = sorted(paragraph_sentences[p_idx], key=lambda x: x.sentence_index)

        n_hoax = sum(1 for s in sents if s.label == "hoax")
        n_not_hoax = sum(1 for s in sents if s.label == "not_hoax")
        hoax_sentence_count += n_hoax
        not_hoax_sentence_count += n_not_hoax

        if sents:
            p_hoax = max(s.hoax_probability for s in sents)
            p_label = "hoax" if n_hoax > 0 else "not_hoax"
            p_conf = max(p_hoax, 1.0 - p_hoax)
        else:
            p_hoax = 0.0
            p_label = "not_hoax"
            p_conf = 0.0

        topic_info = topics[p_idx] if p_idx < len(topics) else fallback_topic

        paragraphs.append(
            ParagraphAnalysis(
                paragraph_index=int(p_idx),
                text=p_text,
                label=p_label,
                hoax_probability=_round6(p_hoax),
                confidence=_round6(p_conf),
                topic=topic_info,
                sentences=sents,
            )
        )

    sentence_aggregate_label = "hoax" if hoax_sentence_count > 0 else "not_hoax"

    shared_topic_map: Dict[str, List[int]] = defaultdict(list)
    for p in paragraphs:
        shared_topic_map[p.topic.label].append(int(p.paragraph_index))

    shared_topics: List[SharedTopic] = []
    for label, indices in shared_topic_map.items():
        if len(indices) > 1:
            shared_topics.append(SharedTopic(label=label, paragraph_indices=indices))

    shared_topics = sorted(shared_topics, key=lambda x: (x.paragraph_indices[0], x.label))

    summary = DocumentSummary(
        paragraph_count=len(paragraphs),
        sentence_count=hoax_sentence_count + not_hoax_sentence_count,
        hoax_sentence_count=hoax_sentence_count,
        not_hoax_sentence_count=not_hoax_sentence_count,
    )

    response = AnalyzeResponse(
        document=DocumentAnalysis(
            label=doc_label,
            hoax_probability=_round6(p_hoax_doc),
            confidence=_round6(doc_conf),
            risk_level=risk_level,
            risk_explanation=risk_explanation,
            sentence_aggregate_label=sentence_aggregate_label,
            summary=summary,
        ),
        paragraphs=paragraphs,
        shared_topics=shared_topics,
        topics_global=topics_global,
        meta=AnalyzeMeta(
            model_id=MODEL_ID,
            max_length=MAX_LENGTH,
            sentence_batch_size=SENTENCE_BATCH_SIZE,
        ),
    )

    _maybe_log({
        "route": "/analyze",
        "text_len": len(original_text),
        "word_count": len(original_text.split()),
        "doc_label": response.document.label,
        "doc_p_hoax": response.document.hoax_probability,
        "paragraph_count": response.document.summary.paragraph_count,
        "sentence_count": response.document.summary.sentence_count,
    })

    return response


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "7860"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
