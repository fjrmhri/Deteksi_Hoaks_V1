"""
Indo Hoax Detector API — v2.0.0
Changelog v2.0.0:
  [FIX-MAJOR-1] Paragraph label aggregation: majority vote (n_hoax > n_not_hoax),
                 bukan "any hoax → hoaks". Ini adalah root cause "selalu hoaks".
  [FIX-MAJOR-2] sentence_aggregate_label: majority vote, bukan "any hoax".
  [FIX-MAJOR-3] BERTopic.transform kini menerima IndoBERT CLS embeddings secara
                 eksplisit — model dilatih tanpa embedding_model, transform tanpa
                 embeddings akan error/salah.
  [FIX-4]       Hapus seluruh TF-IDF fallback. Backend hanya BERTopic.
  [FIX-5]       topic_model_used selalu "bertopic" di meta response.
  [FIX-6]       Hardcode ID2LABEL sesuai training (0=not_hoax, 1=hoax).
  [FIX-7]       Debug logging logits + probabilities aktif via ENABLE_HOAX_LOGGING=1.
"""

import json
import os
import random
import re
import threading
from collections import defaultdict
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# =========================
# Konfigurasi
# =========================

MODEL_ID         = os.getenv("MODEL_ID", "fjrmhri/deteksi_hoaks_indobert")
SUBFOLDER        = os.getenv("MODEL_SUBFOLDER", "") or None
MAX_LENGTH       = int(os.getenv("MAX_LENGTH", "256"))

THRESH_HIGH      = float(os.getenv("HOAX_THRESH_HIGH", "0.80"))
THRESH_MED       = float(os.getenv("HOAX_THRESH_MED",  "0.50"))

PREDICT_BATCH_SIZE    = int(os.getenv("PREDICT_BATCH_SIZE", "64"))
SENTENCE_BATCH_SIZE   = int(os.getenv("SENTENCE_BATCH_SIZE", "64"))
SENTENCE_AMBER_CONF   = float(os.getenv("SENTENCE_AMBER_CONF", "0.70"))
BERTOPIC_EMBED_BATCH  = int(os.getenv("BERTOPIC_EMBED_BATCH", "32"))

TOPIC_KEYWORDS_TOPK      = int(os.getenv("TOPIC_KEYWORDS_TOPK", "3"))
TOPIC_BERTOPIC_MODEL_ID  = os.getenv(
    "TOPIC_BERTOPIC_MODEL_ID", "fjrmhri/deteksi_hoaks_bertopic"
).strip()

ENABLE_LOGGING   = os.getenv("ENABLE_HOAX_LOGGING", "0") == "1"
LOG_SAMPLE_RATE  = float(os.getenv("HOAX_LOG_SAMPLE_RATE", "0.2"))

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
if torch.cuda.is_available():
    torch.set_float32_matmul_precision("high")

print("======================================")
print(f"Loading IndoBERT dari Hub: {MODEL_ID}")
print(f"Device              : {DEVICE}")
print(f"MAX_LENGTH          : {MAX_LENGTH}")
print(f"THRESH_HIGH/MED     : {THRESH_HIGH} / {THRESH_MED}")
print("======================================")


# =========================
# Load IndoBERT (singleton)
# =========================

def _load_model_artifacts():
    load_kwargs = {}
    if SUBFOLDER:
        load_kwargs["subfolder"] = SUBFOLDER
    try:
        tok = AutoTokenizer.from_pretrained(MODEL_ID, **load_kwargs)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, **load_kwargs)
        return tok, mdl
    except Exception as e:
        if SUBFOLDER:
            print(f"[WARN] Gagal load subfolder='{SUBFOLDER}', retry tanpa subfolder: {e}")
            tok = AutoTokenizer.from_pretrained(MODEL_ID)
            mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
            return tok, mdl
        raise


tokenizer, model = _load_model_artifacts()
model.to(DEVICE)
model.eval()

# [FIX-6] Hardcode ID2LABEL sesuai training:
#   label_ke_id = {"not_hoax": 0, "hoax": 1} → ID2LABEL = {0: "not_hoax", 1: "hoax"}
ID2LABEL: Dict[int, str] = {0: "not_hoax", 1: "hoax"}

_config_id2label = {}
if getattr(model.config, "id2label", None):
    _config_id2label = {int(k): v for k, v in model.config.id2label.items()}
if _config_id2label and _config_id2label != ID2LABEL:
    print(f"[WARN] model.config.id2label={_config_id2label} != hardcoded {ID2LABEL}")
    print("[WARN] Menggunakan hardcoded ID2LABEL.")
else:
    print(f"[INFO] ID2LABEL: {ID2LABEL}")

# Baca threshold_optimal dari inference_config.json (opsional)
_THRESHOLD_OPTIMAL: float = 0.5
try:
    from huggingface_hub import hf_hub_download
    _cfg_path = hf_hub_download(MODEL_ID, "inference_config.json")
    with open(_cfg_path, encoding="utf-8") as _f:
        _inf_cfg = json.load(_f)
    _THRESHOLD_OPTIMAL = float(_inf_cfg.get("threshold_optimal", 0.5))
    print(f"[INFO] threshold_optimal dari inference_config.json: {_THRESHOLD_OPTIMAL}")
except Exception as _e:
    print(f"[INFO] inference_config.json tidak tersedia ({_e}). Pakai 0.5")


# =========================
# BERTopic Singleton
# =========================

_bertopic_model = None
_bertopic_lock  = Lock()
_bertopic_ready = False


def _load_bertopic_background():
    global _bertopic_model, _bertopic_ready
    with _bertopic_lock:
        if _bertopic_ready:
            return
        try:
            from bertopic import BERTopic
            print(f"[INFO] Loading BERTopic dari: {TOPIC_BERTOPIC_MODEL_ID}")
            _bertopic_model = BERTopic.load(TOPIC_BERTOPIC_MODEL_ID)
            print("[INFO] BERTopic berhasil dimuat.")
        except Exception as e:
            print(f"[WARN] Gagal load BERTopic: {e}. Topic inference tidak tersedia.")
            _bertopic_model = None
        finally:
            _bertopic_ready = True


threading.Thread(target=_load_bertopic_background, daemon=True).start()


def _get_bertopic() -> Optional[Any]:
    with _bertopic_lock:
        return _bertopic_model if _bertopic_ready else None


# =========================
# FastAPI setup
# =========================

app = FastAPI(
    title="Indo Hoax Detector API",
    description="API FastAPI untuk deteksi berita hoaks (IndoBERT + BERTopic).",
    version="2.0.0",
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
    threshold_used: Optional[float] = None
    topic_model_used: str = "bertopic"


class AnalyzeResponse(BaseModel):
    document: DocumentAnalysis
    paragraphs: List[ParagraphAnalysis]
    shared_topics: List[SharedTopic]
    topics_global: Optional[TopicInfo] = None
    meta: AnalyzeMeta


# =========================
# Util
# =========================

PARAGRAPH_SPLIT_RE = re.compile(r"(?:\r?\n){2,}")
SENTENCE_SPLIT_RE  = re.compile(r'[^.!?]+(?:[.!?]+(?:[")\]]+)?)|[^.!?]+$')
WS_RE              = re.compile(r"\s+")


def _round6(v: float) -> float:
    return float(round(float(v), 6))


def _iter_chunks(items: List[str], chunk_size: int) -> Iterable[List[str]]:
    chunk_size = max(1, chunk_size)
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]


def _normalize_unit_text(text: str) -> str:
    return WS_RE.sub(" ", str(text)).strip()


def _prepare_texts(texts: List[str]) -> List[str]:
    return [_normalize_unit_text(t) if t else "[EMPTY]" for t in texts]


# =========================
# IndoBERT inference
# =========================

def _predict_proba(texts: List[str], batch_size: int = SENTENCE_BATCH_SIZE) -> List[Dict[str, float]]:
    if not texts:
        return []

    prepared = _prepare_texts(texts)

    # Dedup
    unique_texts: List[str] = []
    text_to_idx: Dict[str, int] = {}
    inverse: List[int] = []
    for t in prepared:
        if t not in text_to_idx:
            text_to_idx[t] = len(unique_texts)
            unique_texts.append(t)
        inverse.append(text_to_idx[t])

    unique_results: List[Dict[str, float]] = []
    first_batch = True

    for chunk in _iter_chunks(unique_texts, batch_size):
        enc = tokenizer(
            chunk,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        enc = {k: v.to(DEVICE) for k, v in enc.items()}

        with torch.inference_mode():
            outputs = model(**enc)
            logits  = outputs.logits

            if first_batch or ENABLE_LOGGING:
                print(f"[DEBUG] logits       : {logits.cpu().tolist()}")

            probs = torch.softmax(logits, dim=-1).cpu().numpy()

            if first_batch or ENABLE_LOGGING:
                print(f"[DEBUG] probabilities: {probs.tolist()}")
                print(f"[DEBUG] ID2LABEL     : {ID2LABEL}")
                first_batch = False

        for row in probs:
            prob_dict: Dict[str, float] = {
                ID2LABEL.get(idx, str(idx)): float(p)
                for idx, p in enumerate(row)
            }
            unique_results.append(prob_dict)

    return [dict(unique_results[i]) for i in inverse]


def _extract_cls_embeddings(texts: List[str], batch_size: int = BERTOPIC_EMBED_BATCH) -> np.ndarray:
    """
    Ekstrak CLS embedding dari IndoBERT untuk BERTopic.transform.
    Konsisten dengan training — model dilatih dengan embedding yang sama.
    """
    all_emb = []
    for chunk in _iter_chunks(texts, batch_size):
        enc = tokenizer(
            chunk,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        enc = {k: v.to(DEVICE) for k, v in enc.items()}
        with torch.inference_mode():
            out = model(**enc, output_hidden_states=True)
        # last hidden state, posisi [CLS] = indeks 0
        cls = out.hidden_states[-1][:, 0, :].cpu().float().numpy()
        all_emb.append(cls)
    return np.vstack(all_emb)


def _normalize_label_key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(label).lower()).strip("_")


def _extract_hoax_probability(prob_dict: Dict[str, float]) -> float:
    if not prob_dict:
        return 0.0
    normalized = {k: _normalize_label_key(k) for k in prob_dict}
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
    normalized = {k: _normalize_label_key(k) for k in prob_dict}
    for k, nk in normalized.items():
        if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
            return float(prob_dict[k])
    return float(max(0.0, min(1.0, 1.0 - p_hoax)))


def analyze_risk(prob_dict: Dict[str, float], original_text: Optional[str] = None) -> Tuple[float, str, str]:
    p_hoax = _extract_hoax_probability(prob_dict)
    thresh = _THRESHOLD_OPTIMAL or 0.5

    if p_hoax > THRESH_HIGH:
        level = "high"
        explanation = (
            f"Model sangat yakin teks ini hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Sebaiknya jangan dipercaya sebelum ada klarifikasi resmi."
        )
    elif p_hoax > max(THRESH_MED, thresh):
        level = "medium"
        explanation = (
            f"Model menilai teks ini berpotensi hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Disarankan cek ulang ke sumber resmi."
        )
    else:
        level = "low"
        explanation = (
            f"Model menilai teks ini cenderung bukan hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Tetap gunakan literasi dan bandingkan dengan sumber lain."
        )

    if original_text is not None and len(str(original_text).strip().split()) < 5:
        if level == "low":
            level = "medium"
        explanation += (
            " Catatan: teks sangat pendek (< 5 kata), prediksi bisa kurang stabil."
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
    return paragraphs or [raw]


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


# =========================
# BERTopic inference — [FIX-MAJOR-3]
# Selalu inject CLS embeddings dari IndoBERT ke BERTopic.transform.
# Model BERTopic dilatih dengan embedding_model=None, sehingga transform
# WAJIB menerima embeddings eksplisit agar tidak error atau salah cluster.
# =========================

_FALLBACK_TOPIC = TopicInfo(label="topik_umum", score=0.0, keywords=["topik_umum"])


def _bertopic_infer_topics(texts: List[str]) -> List[TopicInfo]:
    btm = _get_bertopic()
    if btm is None:
        print("[INFO] BERTopic belum siap. Mengembalikan topik_umum.")
        return [_FALLBACK_TOPIC for _ in texts]
    try:
        # [FIX-MAJOR-3] Ekstrak CLS embedding dari IndoBERT sebelum transform
        embeddings = _extract_cls_embeddings(texts, batch_size=BERTOPIC_EMBED_BATCH)
        topic_ids, _ = btm.transform(texts, embeddings=embeddings)

        results: List[TopicInfo] = []
        for tid in topic_ids:
            if tid == -1:
                results.append(_FALLBACK_TOPIC)
                continue
            topic_words = btm.get_topic(tid) or []
            keywords = [w for w, _ in topic_words[:TOPIC_KEYWORDS_TOPK]]
            score    = float(topic_words[0][1]) if topic_words else 0.0
            label    = " / ".join(keywords[:2]) if keywords else f"topik_{tid}"
            results.append(TopicInfo(label=label, score=_round6(score), keywords=keywords))
        return results
    except Exception as e:
        print(f"[WARN] BERTopic inference error: {e}")
        return [_FALLBACK_TOPIC for _ in texts]


def _to_canonical_label(p_hoax: float) -> str:
    thresh = _THRESHOLD_OPTIMAL or 0.5
    return "hoax" if p_hoax >= thresh else "not_hoax"


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
        "version": "2.0.0",
        "model_id": MODEL_ID,
        "id2label": ID2LABEL,
        "threshold_optimal": _THRESHOLD_OPTIMAL,
        "device": str(DEVICE),
        "bertopic_ready": _bertopic_ready,
        "topic_model": "bertopic",
        "risk_thresholds": {
            "high":   f"P(hoaks) > {THRESH_HIGH}",
            "medium": f"P(hoaks) > {THRESH_MED}",
            "low":    f"P(hoaks) ≤ {THRESH_MED}",
        },
        "endpoints": ["/predict", "/predict-batch", "/analyze"],
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "bertopic_ready": _bertopic_ready}


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
        "label": response.label,
        "p_hoax": response.hoax_probability,
        "risk_level": response.risk_level,
    })
    return response


@app.post("/predict-batch", response_model=BatchPredictResponse)
def predict_batch(request: BatchPredictRequest):
    texts     = request.texts or []
    prob_list = _predict_proba(texts, batch_size=PREDICT_BATCH_SIZE)
    results: List[PredictResponse] = []
    for original_text, prob_dict in zip(texts, prob_list):
        response = _build_predict_response(prob_dict, original_text=str(original_text))
        _maybe_log({"route": "/predict-batch", "label": response.label, "p_hoax": response.hoax_probability})
        results.append(response)
    return BatchPredictResponse(results=results)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    original_text = _normalize_unit_text(request.text)

    base_meta = AnalyzeMeta(
        model_id=MODEL_ID,
        max_length=MAX_LENGTH,
        sentence_batch_size=SENTENCE_BATCH_SIZE,
        threshold_used=_THRESHOLD_OPTIMAL,
        topic_model_used="bertopic",  # [FIX-5] selalu bertopic
    )

    if not original_text:
        return AnalyzeResponse(
            document=DocumentAnalysis(
                label="not_hoax", hoax_probability=0.0, confidence=0.0,
                risk_level="low", risk_explanation="Teks kosong.",
                sentence_aggregate_label="not_hoax",
                summary=DocumentSummary(paragraph_count=0, sentence_count=0,
                                        hoax_sentence_count=0, not_hoax_sentence_count=0),
            ),
            paragraphs=[], shared_topics=[], topics_global=None, meta=base_meta,
        )

    # Inferensi level dokumen
    doc_prob_list = _predict_proba([original_text], batch_size=1)
    doc_prob_dict = doc_prob_list[0] if doc_prob_list else {"not_hoax": 1.0, "hoax": 0.0}

    p_hoax_doc     = _extract_hoax_probability(doc_prob_dict)
    p_not_hoax_doc = _extract_not_hoax_probability(doc_prob_dict, p_hoax_doc)
    doc_label      = _to_canonical_label(p_hoax_doc)
    doc_conf       = max(p_hoax_doc, p_not_hoax_doc)

    _, risk_level, risk_explanation = analyze_risk(
        {"not_hoax": p_not_hoax_doc, "hoax": p_hoax_doc},
        original_text=original_text,
    )

    # Split paragraf & kalimat
    paragraph_texts = _split_paragraphs(original_text)
    sentence_texts: List[str] = []
    sentence_map:   List[Tuple[int, int]] = []
    for p_idx, paragraph in enumerate(paragraph_texts):
        for s_idx, sentence in enumerate(_split_sentences(paragraph)):
            sentence_texts.append(sentence)
            sentence_map.append((p_idx, s_idx))

    sentence_prob_list = _predict_proba(sentence_texts, batch_size=SENTENCE_BATCH_SIZE)

    # Bangun SentenceAnalysis per paragraf
    paragraph_sentences: List[List[SentenceAnalysis]] = [[] for _ in paragraph_texts]
    for (p_idx, s_idx), sent_text, sent_prob_dict in zip(sentence_map, sentence_texts, sentence_prob_list):
        p_hoax     = _extract_hoax_probability(sent_prob_dict)
        p_not_hoax = _extract_not_hoax_probability(sent_prob_dict, p_hoax)
        sent_label = _to_canonical_label(p_hoax)
        sent_conf  = max(p_hoax, p_not_hoax)
        paragraph_sentences[p_idx].append(SentenceAnalysis(
            sentence_index=int(s_idx),
            text=sent_text,
            label=sent_label,
            probabilities={"not_hoax": _round6(p_not_hoax), "hoax": _round6(p_hoax)},
            hoax_probability=_round6(p_hoax),
            confidence=_round6(sent_conf),
            color=_sentence_color(sent_label, sent_conf),
        ))

    # Ekstrak topik via BERTopic — [FIX-4] tidak ada TF-IDF fallback
    fallback_topic = _FALLBACK_TOPIC
    topics_global: Optional[TopicInfo] = None

    if request.topic_per_paragraph:
        topics = _bertopic_infer_topics(paragraph_texts)
    else:
        doc_for_topic = "\n\n".join(paragraph_texts)
        global_list   = _bertopic_infer_topics([doc_for_topic]) if doc_for_topic else [fallback_topic]
        global_topic  = global_list[0] if global_list else fallback_topic
        topics_global = global_topic
        topics        = [global_topic for _ in paragraph_texts]

    # Bangun ParagraphAnalysis
    paragraphs: List[ParagraphAnalysis] = []
    hoax_sentence_count     = 0
    not_hoax_sentence_count = 0

    for p_idx, p_text in enumerate(paragraph_texts):
        sents  = sorted(paragraph_sentences[p_idx], key=lambda x: x.sentence_index)
        n_hoax = sum(1 for s in sents if s.label == "hoax")
        n_not  = sum(1 for s in sents if s.label == "not_hoax")
        hoax_sentence_count     += n_hoax
        not_hoax_sentence_count += n_not

        if sents:
            p_max_hoax = max(s.hoax_probability for s in sents)
            # [FIX-MAJOR-1] Majority vote: hoaks hanya jika lebih banyak kalimat hoaks
            p_label = "hoax" if n_hoax > n_not else "not_hoax"
            p_conf  = max(p_max_hoax, 1.0 - p_max_hoax)
        else:
            p_max_hoax = 0.0
            p_label    = "not_hoax"
            p_conf     = 0.0

        topic_info = topics[p_idx] if p_idx < len(topics) else fallback_topic
        paragraphs.append(ParagraphAnalysis(
            paragraph_index=int(p_idx),
            text=p_text,
            label=p_label,
            hoax_probability=_round6(p_max_hoax),
            confidence=_round6(p_conf),
            topic=topic_info,
            sentences=sents,
        ))

    # [FIX-MAJOR-2] sentence_aggregate_label: majority vote
    sentence_aggregate_label = (
        "hoax" if hoax_sentence_count > not_hoax_sentence_count else "not_hoax"
    )

    shared_topic_map: Dict[str, List[int]] = defaultdict(list)
    for p in paragraphs:
        shared_topic_map[p.topic.label].append(int(p.paragraph_index))
    shared_topics = sorted(
        [SharedTopic(label=lbl, paragraph_indices=idxs)
         for lbl, idxs in shared_topic_map.items() if len(idxs) > 1],
        key=lambda x: (x.paragraph_indices[0], x.label),
    )

    summary = DocumentSummary(
        paragraph_count=len(paragraphs),
        sentence_count=hoax_sentence_count + not_hoax_sentence_count,
        hoax_sentence_count=hoax_sentence_count,
        not_hoax_sentence_count=not_hoax_sentence_count,
    )

    _maybe_log({
        "route": "/analyze",
        "doc_label": doc_label,
        "doc_p_hoax": p_hoax_doc,
        "paragraph_count": len(paragraphs),
        "topic_model_used": "bertopic",
    })

    return AnalyzeResponse(
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
        meta=base_meta,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
