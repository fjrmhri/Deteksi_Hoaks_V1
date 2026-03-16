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
except Exception:  # pragma: no cover - handled at runtime via fallback
    joblib = None

try:
    from huggingface_hub import snapshot_download
except Exception:  # pragma: no cover - handled at runtime via fallback
    snapshot_download = None


# =========================
# Konfigurasi & Load Model
# =========================

MODEL_ID = os.getenv("MODEL_ID", "fjrmhri/TA-FINAL")
SUBFOLDER = os.getenv("MODEL_SUBFOLDER", "") or None
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))

THRESH_HIGH = float(os.getenv("HOAX_THRESH_HIGH", "0.98"))
THRESH_MED = float(os.getenv("HOAX_THRESH_MED", "0.60"))

PREDICT_BATCH_SIZE = int(os.getenv("PREDICT_BATCH_SIZE", "64"))
SENTENCE_BATCH_SIZE = int(os.getenv("SENTENCE_BATCH_SIZE", "64"))
SENTENCE_AMBER_CONF = float(os.getenv("SENTENCE_AMBER_CONF", "0.70"))

DEFAULT_TOPIC_MODEL = "tfidf"
ALLOWED_TOPIC_MODELS = {"tfidf", "nmf", "bertopic"}
TOPIC_KEYWORDS_TOPK = int(os.getenv("TOPIC_KEYWORDS_TOPK", "3"))
TOPIC_MAX_FEATURES = int(os.getenv("TOPIC_MAX_FEATURES", "1500"))
TOPIC_ARTIFACT_CACHE_DIR = os.getenv(
    "TOPIC_ARTIFACT_CACHE_DIR", "/tmp/deteksi_hoaks_topic_models"
)
TOPIC_NMF_MODEL_DIR = os.getenv("TOPIC_NMF_MODEL_DIR", "").strip()
TOPIC_NMF_MODEL_ID = os.getenv("TOPIC_NMF_MODEL_ID", "").strip()
TOPIC_BERTOPIC_MODEL_DIR = os.getenv("TOPIC_BERTOPIC_MODEL_DIR", "").strip()
TOPIC_BERTOPIC_MODEL_ID = os.getenv("TOPIC_BERTOPIC_MODEL_ID", "").strip()
ENABLE_BERTOPIC_ENGINE = os.getenv("ENABLE_BERTOPIC_ENGINE", "0") == "1"
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
print(
    "Topic engines: "
    f"default={DEFAULT_TOPIC_MODEL}, nmf_dir={TOPIC_NMF_MODEL_DIR or '-'}, "
    f"nmf_repo={TOPIC_NMF_MODEL_ID or '-'}, "
    f"bertopic_enabled={ENABLE_BERTOPIC_ENGINE}, "
    f"bertopic_dir={TOPIC_BERTOPIC_MODEL_DIR or '-'}, "
    f"bertopic_repo={TOPIC_BERTOPIC_MODEL_ID or '-'}"
)
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
    except Exception as exc:
        if SUBFOLDER:
            print(
                f"[WARN] Gagal load dengan subfolder='{SUBFOLDER}'. Retry tanpa subfolder. "
                f"Detail: {exc}"
            )
            tok = AutoTokenizer.from_pretrained(MODEL_ID)
            mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
            return tok, mdl
        raise


tokenizer, model = _load_model_artifacts()
model.to(DEVICE)
model.eval()

if getattr(model.config, "id2label", None):
    ID2LABEL: Dict[int, str] = {int(k): v for k, v in model.config.id2label.items()}
else:
    ID2LABEL = {0: "not_hoax", 1: "hoax"}


app = FastAPI(
    title="Indo Hoax Detector API",
    description="API FastAPI untuk deteksi berita hoaks (model IndoBERT).",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    topic_model: str = DEFAULT_TOPIC_MODEL


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
    source: Optional[str] = None
    topic_id: Optional[int] = None


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
    topic_model_requested: str
    topic_model_used: str
    topic_fallback_reason: Optional[str] = None


class AnalyzeResponse(BaseModel):
    document: DocumentAnalysis
    paragraphs: List[ParagraphAnalysis]
    shared_topics: List[SharedTopic]
    topics_global: Optional[TopicInfo] = None
    meta: AnalyzeMeta


PARAGRAPH_SPLIT_RE = re.compile(r"(?:\r?\n){2,}")
SENTENCE_SPLIT_RE = re.compile(r'[^.!?]+(?:[.!?]+(?:["\)\]]+)?)|[^.!?]+$')
WS_RE = re.compile(r"\s+")
TOKEN_RE = re.compile(r"[a-zA-Z]{3,}")

ID_STOPWORDS = {
    "yang",
    "dan",
    "atau",
    "di",
    "ke",
    "dari",
    "untuk",
    "dengan",
    "pada",
    "adalah",
    "itu",
    "ini",
    "dalam",
    "sebagai",
    "karena",
    "juga",
    "agar",
    "oleh",
    "saat",
    "akan",
    "telah",
    "sudah",
    "tidak",
    "iya",
    "ya",
    "kita",
    "mereka",
    "kami",
    "anda",
    "hingga",
    "lebih",
    "masih",
    "dapat",
    "bisa",
    "setelah",
    "sebelum",
    "tersebut",
    "terhadap",
    "disebut",
    "menurut",
    "para",
    "sebuah",
    "adanya",
    "yakni",
    "bahwa",
    "the",
}

TOPIC_ENGINE_CACHE: Dict[str, Dict[str, Any]] = {}
TOPIC_ENGINE_ERRORS: Dict[str, str] = {}
TOPIC_ENGINE_LOCK = Lock()


def _round6(value: float) -> float:
    return float(round(float(value), 6))


def _iter_chunks(items: List[str], chunk_size: int) -> Iterable[List[str]]:
    if chunk_size <= 0:
        chunk_size = 1
    for idx in range(0, len(items), chunk_size):
        yield items[idx : idx + chunk_size]


def _normalize_unit_text(text: str) -> str:
    return WS_RE.sub(" ", str(text)).strip()


def _prepare_texts(texts: List[str]) -> List[str]:
    processed = []
    for text in texts:
        normalized = _normalize_unit_text("" if text is None else text)
        processed.append(normalized if normalized else "[EMPTY]")
    return processed


def _predict_proba(
    texts: List[str], batch_size: int = SENTENCE_BATCH_SIZE
) -> List[Dict[str, float]]:
    if not texts:
        return []

    prepared_texts = _prepare_texts(texts)

    unique_texts: List[str] = []
    text_to_unique_idx: Dict[str, int] = {}
    inverse_indices: List[int] = []
    for text in prepared_texts:
        if text not in text_to_unique_idx:
            text_to_unique_idx[text] = len(unique_texts)
            unique_texts.append(text)
        inverse_indices.append(text_to_unique_idx[text])

    unique_results: List[Dict[str, float]] = []
    for chunk in _iter_chunks(unique_texts, batch_size):
        encodings = tokenizer(
            chunk,
            padding=True,
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        encodings = {key: value.to(DEVICE) for key, value in encodings.items()}

        with torch.inference_mode():
            outputs = model(**encodings)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()

        for row in probs:
            prob_dict: Dict[str, float] = {}
            for idx, prob_value in enumerate(row):
                label_name = ID2LABEL.get(idx, str(idx))
                prob_dict[label_name] = float(prob_value)
            unique_results.append(prob_dict)

    return [dict(unique_results[idx]) for idx in inverse_indices]


def _normalize_label_key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(label).lower()).strip("_")


def _extract_hoax_probability(prob_dict: Dict[str, float]) -> float:
    if not prob_dict:
        return 0.0

    normalized = {key: _normalize_label_key(key) for key in prob_dict.keys()}

    for key, normalized_key in normalized.items():
        if normalized_key in {"hoax", "hoaks"}:
            return float(prob_dict[key])

    for key, normalized_key in normalized.items():
        if "hoax" in normalized_key and "not" not in normalized_key and "non" not in normalized_key:
            return float(prob_dict[key])

    if len(prob_dict) == 2:
        for key, normalized_key in normalized.items():
            if normalized_key in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
                return float(1.0 - float(prob_dict[key]))

    return 0.0


def _extract_not_hoax_probability(prob_dict: Dict[str, float], p_hoax: float) -> float:
    if not prob_dict:
        return float(1.0 - p_hoax)

    normalized = {key: _normalize_label_key(key) for key in prob_dict.keys()}
    for key, normalized_key in normalized.items():
        if normalized_key in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
            return float(prob_dict[key])

    return float(max(0.0, min(1.0, 1.0 - p_hoax)))


def analyze_risk(
    prob_dict: Dict[str, float], original_text: Optional[str] = None
) -> Tuple[float, str, str]:
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

    if original_text is not None and len(str(original_text).strip().split()) < 5:
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

    paragraphs = [part.strip() for part in PARAGRAPH_SPLIT_RE.split(raw) if part.strip()]
    if len(paragraphs) <= 1 and "\n" in raw:
        line_based = [part.strip() for part in raw.splitlines() if part.strip()]
        if len(line_based) > 1:
            return line_based
    return paragraphs if paragraphs else [raw]


def _split_sentences(paragraph: str) -> List[str]:
    normalized = _normalize_unit_text(paragraph)
    if not normalized:
        return []
    sentences = [match.group(0).strip() for match in SENTENCE_SPLIT_RE.finditer(normalized)]
    return [sentence for sentence in sentences if sentence] or [normalized]


def _sentence_color(label: str, confidence: float) -> str:
    if label == "hoax":
        return "red"
    if confidence < SENTENCE_AMBER_CONF:
        return "amber"
    return "green"


def _unique_topic_tokens(text: str) -> List[str]:
    tokens = [token for token in TOKEN_RE.findall(str(text).lower()) if token not in ID_STOPWORDS]
    unique_tokens: List[str] = []
    for token in tokens:
        if token not in unique_tokens:
            unique_tokens.append(token)
    return unique_tokens


def _clamp_topic_score(score: Any) -> float:
    try:
        value = float(score)
    except (TypeError, ValueError):
        return 0.0
    if not np.isfinite(value):
        return 0.0
    return _round6(max(0.0, min(1.0, value)))


def _fallback_topic_from_text(text: str, source: str) -> TopicInfo:
    keywords = _unique_topic_tokens(text)[:TOPIC_KEYWORDS_TOPK] or ["topik_umum"]
    return TopicInfo(
        label=" / ".join(keywords[:2]) if keywords else "topik_umum",
        score=0.0,
        keywords=keywords[:TOPIC_KEYWORDS_TOPK],
        source=source,
        topic_id=None,
    )


def _make_topic_info(
    label: Optional[str],
    score: Any,
    keywords: Optional[List[str]],
    source: str,
    topic_id: Optional[int] = None,
) -> TopicInfo:
    cleaned_keywords = [str(item).strip() for item in (keywords or []) if str(item).strip()]
    if not cleaned_keywords:
        cleaned_keywords = ["topik_umum"]
    cleaned_label = str(label).strip() if label is not None else ""
    if not cleaned_label:
        cleaned_label = " / ".join(cleaned_keywords[:2]) if cleaned_keywords else "topik_umum"
    return TopicInfo(
        label=cleaned_label,
        score=_clamp_topic_score(score),
        keywords=cleaned_keywords[:TOPIC_KEYWORDS_TOPK],
        source=source,
        topic_id=topic_id,
    )


def _extract_tfidf_topics(paragraph_texts: List[str]) -> List[TopicInfo]:
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

        for idx in range(matrix.shape[0]):
            row = matrix.getrow(idx)
            if row.nnz == 0:
                topics.append(_fallback_topic_from_text(paragraph_texts[idx], source="tfidf"))
                continue

            pairs = sorted(
                zip(row.indices, row.data),
                key=lambda item: (-item[1], features[item[0]]),
            )[:TOPIC_KEYWORDS_TOPK]
            keywords = [features[feature_idx] for feature_idx, _ in pairs] or ["topik_umum"]
            score = float(np.mean([float(value) for _, value in pairs])) if pairs else 0.0
            topics.append(
                _make_topic_info(
                    label=" / ".join(keywords[:2]) if keywords else "topik_umum",
                    score=score,
                    keywords=keywords,
                    source="tfidf",
                    topic_id=None,
                )
            )
    except Exception:
        for text in paragraph_texts:
            topics.append(_fallback_topic_from_text(text, source="tfidf"))

    return topics


def _interpret_topic_model(raw_value: Any) -> Tuple[str, str, Optional[str]]:
    requested = str(raw_value or "").strip().lower()
    if not requested:
        return DEFAULT_TOPIC_MODEL, DEFAULT_TOPIC_MODEL, None
    if requested in ALLOWED_TOPIC_MODELS:
        return requested, requested, None
    return (
        requested,
        DEFAULT_TOPIC_MODEL,
        f"topic_model '{requested}' tidak dikenali; fallback ke {DEFAULT_TOPIC_MODEL}.",
    )


def _combine_fallback_reason(*messages: Optional[str]) -> Optional[str]:
    combined = [str(message).strip() for message in messages if str(message or "").strip()]
    return " ".join(combined) if combined else None


def _resolve_artifact_dir(local_dir: str, model_id: str, label: str) -> Path:
    if local_dir:
        path = Path(local_dir)
        if path.exists():
            return path
        raise FileNotFoundError(f"Direktori artifact {label} tidak ditemukan: {path}")

    if not model_id:
        raise FileNotFoundError(
            f"Artifact {label} tidak tersedia. Set env dir lokal atau repo id untuk {label}."
        )

    if snapshot_download is None:
        raise RuntimeError(
            "huggingface_hub tidak tersedia sehingga artifact dari Hugging Face tidak bisa diunduh."
        )

    cache_dir = Path(TOPIC_ARTIFACT_CACHE_DIR)
    cache_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = snapshot_download(
        repo_id=model_id,
        repo_type="model",
        cache_dir=str(cache_dir),
    )
    return Path(snapshot_path)


def _load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


def _normalize_topic_catalog(raw_catalog: Any) -> Dict[int, Dict[str, Any]]:
    catalog: Dict[int, Dict[str, Any]] = {}
    if isinstance(raw_catalog, list):
        iterable = raw_catalog
    elif isinstance(raw_catalog, dict):
        iterable = []
        for key, value in raw_catalog.items():
            if isinstance(value, dict):
                item = dict(value)
                item.setdefault("topic_id", key)
                iterable.append(item)
    else:
        iterable = []

    for item in iterable:
        if not isinstance(item, dict):
            continue
        try:
            topic_id = int(item.get("topic_id"))
        except (TypeError, ValueError):
            continue
        keywords = [
            str(keyword).strip()
            for keyword in item.get("keywords", [])
            if str(keyword).strip()
        ]
        label = str(item.get("label", "")).strip()
        catalog[topic_id] = {
            "label": label,
            "keywords": keywords,
        }
    return catalog


def _topic_keywords_from_components(
    components: np.ndarray, feature_names: np.ndarray, topic_id: int
) -> List[str]:
    if components.ndim != 2 or topic_id < 0 or topic_id >= components.shape[0]:
        return ["topik_umum"]
    topic_weights = components[topic_id]
    top_indices = np.argsort(topic_weights)[::-1][:TOPIC_KEYWORDS_TOPK]
    keywords = [str(feature_names[idx]) for idx in top_indices if idx < len(feature_names)]
    return keywords or ["topik_umum"]


def _load_nmf_engine() -> Dict[str, Any]:
    if joblib is None:
        raise RuntimeError("joblib tidak tersedia sehingga artifact NMF tidak bisa dimuat.")

    artifact_dir = _resolve_artifact_dir(TOPIC_NMF_MODEL_DIR, TOPIC_NMF_MODEL_ID, "NMF")
    vectorizer_path = artifact_dir / "nmf_vectorizer.joblib"
    model_path = artifact_dir / "nmf_model.joblib"
    metadata_path = artifact_dir / "nmf_metadata.json"
    topics_path = artifact_dir / "nmf_topics.json"

    if not vectorizer_path.exists() or not model_path.exists():
        raise FileNotFoundError(
            "Artifact NMF wajib berisi nmf_vectorizer.joblib dan nmf_model.joblib."
        )

    vectorizer = joblib.load(vectorizer_path)
    nmf_model = joblib.load(model_path)
    metadata = _load_json_file(metadata_path, default={})
    topic_catalog = _normalize_topic_catalog(_load_json_file(topics_path, default=[]))

    feature_names = (
        vectorizer.get_feature_names_out()
        if hasattr(vectorizer, "get_feature_names_out")
        else np.array([])
    )
    return {
        "kind": "nmf",
        "artifact_dir": str(artifact_dir),
        "vectorizer": vectorizer,
        "model": nmf_model,
        "metadata": metadata,
        "topic_catalog": topic_catalog,
        "feature_names": feature_names,
    }


def _load_bertopic_engine() -> Dict[str, Any]:
    if not ENABLE_BERTOPIC_ENGINE:
        raise RuntimeError("ENABLE_BERTOPIC_ENGINE=0 sehingga BERTopic dinonaktifkan.")

    try:
        from bertopic import BERTopic
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # pragma: no cover - runtime dependency path
        raise RuntimeError(
            "Dependency BERTopic belum tersedia di runtime backend."
        ) from exc

    artifact_dir = _resolve_artifact_dir(
        TOPIC_BERTOPIC_MODEL_DIR, TOPIC_BERTOPIC_MODEL_ID, "BERTopic"
    )
    metadata = _load_json_file(artifact_dir / "bertopic_metadata.json", default={})
    embedding_model = str(metadata.get("embedding_model", "")).strip()
    if not embedding_model:
        raise FileNotFoundError(
            "Artifact BERTopic wajib memiliki bertopic_metadata.json dengan field 'embedding_model'."
        )

    topic_model = BERTopic.load(str(artifact_dir), embedding_model=None)
    embedder = SentenceTransformer(
        embedding_model,
        device="cuda" if torch.cuda.is_available() else "cpu",
    )

    topic_keywords: Dict[int, List[str]] = {}
    topic_catalog = _normalize_topic_catalog(
        _load_json_file(artifact_dir / "bertopic_topics.json", default=[])
    )
    info_df = topic_model.get_topic_info()
    valid_topic_ids: List[int] = []
    for row in info_df.to_dict(orient="records"):
        try:
            topic_id = int(row.get("Topic"))
        except (TypeError, ValueError):
            continue
        if topic_id == -1:
            continue
        valid_topic_ids.append(topic_id)
        topic_terms = topic_model.get_topic(topic_id) or []
        keywords = [
            str(term).strip()
            for term, _ in topic_terms[:TOPIC_KEYWORDS_TOPK]
            if str(term).strip()
        ]
        if not keywords and topic_id in topic_catalog:
            keywords = topic_catalog[topic_id].get("keywords", [])
        topic_keywords[topic_id] = keywords or ["topik_umum"]

    return {
        "kind": "bertopic",
        "artifact_dir": str(artifact_dir),
        "metadata": metadata,
        "model": topic_model,
        "embedder": embedder,
        "topic_keywords": topic_keywords,
        "valid_topic_ids": valid_topic_ids,
        "topic_catalog": topic_catalog,
    }


def _get_or_load_topic_engine(model_name: str) -> Dict[str, Any]:
    if model_name == DEFAULT_TOPIC_MODEL:
        return {"kind": DEFAULT_TOPIC_MODEL}

    with TOPIC_ENGINE_LOCK:
        if model_name in TOPIC_ENGINE_CACHE:
            return TOPIC_ENGINE_CACHE[model_name]
        if model_name in TOPIC_ENGINE_ERRORS:
            raise RuntimeError(TOPIC_ENGINE_ERRORS[model_name])

        try:
            if model_name == "nmf":
                engine = _load_nmf_engine()
            elif model_name == "bertopic":
                engine = _load_bertopic_engine()
            else:
                raise RuntimeError(f"Topic engine '{model_name}' tidak didukung.")
        except Exception as exc:
            TOPIC_ENGINE_ERRORS[model_name] = str(exc)
            raise

        TOPIC_ENGINE_CACHE[model_name] = engine
        return engine


def _extract_nmf_topics(
    paragraph_texts: List[str], engine: Dict[str, Any]
) -> List[TopicInfo]:
    if not paragraph_texts:
        return []

    vectorizer = engine["vectorizer"]
    nmf_model = engine["model"]
    topic_catalog = engine.get("topic_catalog", {})
    feature_names = engine.get("feature_names", np.array([]))

    matrix = vectorizer.transform(paragraph_texts)
    distributions = nmf_model.transform(matrix)
    topics: List[TopicInfo] = []

    for idx, raw_row in enumerate(distributions):
        row = np.asarray(raw_row, dtype=float).ravel()
        row = np.nan_to_num(row, nan=0.0, posinf=0.0, neginf=0.0)
        row_sum = float(row.sum())
        if row_sum <= 0.0:
            topics.append(_fallback_topic_from_text(paragraph_texts[idx], source="nmf"))
            continue

        normalized = row / row_sum
        topic_id = int(np.argmax(normalized))
        score = float(normalized[topic_id]) if topic_id < normalized.size else 0.0

        topic_entry = topic_catalog.get(topic_id, {})
        keywords = topic_entry.get("keywords") or _topic_keywords_from_components(
            np.asarray(nmf_model.components_),
            np.asarray(feature_names),
            topic_id,
        )
        label = topic_entry.get("label") or " / ".join(keywords[:2]) or f"topik_{topic_id}"
        topics.append(
            _make_topic_info(
                label=label,
                score=score,
                keywords=keywords,
                source="nmf",
                topic_id=topic_id,
            )
        )

    return topics


def _score_from_distribution(
    probability_row: Optional[Any] = None, approximate_row: Optional[Any] = None
) -> float:
    for candidate in (probability_row, approximate_row):
        if candidate is None:
            continue
        array = np.asarray(candidate, dtype=float).ravel()
        if array.size == 0:
            continue
        array = np.nan_to_num(array, nan=0.0, posinf=0.0, neginf=0.0)
        value = float(np.max(array))
        if np.isfinite(value):
            return max(0.0, min(1.0, value))
    return 0.0


def _extract_bertopic_topics(
    paragraph_texts: List[str], engine: Dict[str, Any]
) -> List[TopicInfo]:
    if not paragraph_texts:
        return []

    topic_model = engine["model"]
    embedder = engine["embedder"]
    topic_keywords = engine.get("topic_keywords", {})
    topic_catalog = engine.get("topic_catalog", {})

    embeddings = embedder.encode(
        paragraph_texts,
        batch_size=TOPIC_BERTOPIC_EMBED_BATCH,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    topic_ids, probabilities = topic_model.transform(paragraph_texts, embeddings=embeddings)

    approximate_distribution = None
    try:
        approximate_distribution, _ = topic_model.approximate_distribution(paragraph_texts)
    except Exception:
        approximate_distribution = None

    topics: List[TopicInfo] = []
    for idx, text in enumerate(paragraph_texts):
        topic_id_raw = topic_ids[idx] if idx < len(topic_ids) else None
        topic_id = int(topic_id_raw) if topic_id_raw is not None and topic_id_raw != -1 else None

        prob_row = None
        if probabilities is not None:
            try:
                prob_row = probabilities[idx]
            except Exception:
                prob_row = None

        approx_row = None
        if approximate_distribution is not None:
            try:
                approx_row = approximate_distribution[idx]
            except Exception:
                approx_row = None

        score = _score_from_distribution(prob_row, approx_row)
        if topic_id is None:
            topics.append(_fallback_topic_from_text(text, source="bertopic"))
            continue

        keywords = (
            topic_keywords.get(topic_id)
            or topic_catalog.get(topic_id, {}).get("keywords")
            or ["topik_umum"]
        )
        label = topic_catalog.get(topic_id, {}).get("label") or " / ".join(keywords[:2]) or f"topik_{topic_id}"
        topics.append(
            _make_topic_info(
                label=label,
                score=score,
                keywords=keywords,
                source="bertopic",
                topic_id=topic_id,
            )
        )

    return topics


def _extract_topics(
    paragraph_texts: List[str], topic_model_raw: Any
) -> Tuple[List[TopicInfo], str, str, Optional[str]]:
    requested_name, preferred_model, fallback_reason = _interpret_topic_model(topic_model_raw)
    actual_model = preferred_model

    if preferred_model == "tfidf":
        return _extract_tfidf_topics(paragraph_texts), requested_name, actual_model, fallback_reason

    try:
        engine = _get_or_load_topic_engine(preferred_model)
        if preferred_model == "nmf":
            topics = _extract_nmf_topics(paragraph_texts, engine)
        elif preferred_model == "bertopic":
            topics = _extract_bertopic_topics(paragraph_texts, engine)
        else:
            raise RuntimeError(f"Topic engine '{preferred_model}' tidak tersedia.")
        return topics, requested_name, actual_model, fallback_reason
    except Exception as exc:
        actual_model = DEFAULT_TOPIC_MODEL
        reason = _combine_fallback_reason(
            fallback_reason,
            f"Topic model '{preferred_model}' tidak tersedia: {exc}",
        )
        return _extract_tfidf_topics(paragraph_texts), requested_name, actual_model, reason


def _to_canonical_label(p_hoax: float) -> str:
    return "hoax" if p_hoax >= 0.5 else "not_hoax"


def _build_predict_response(
    prob_dict: Dict[str, float], original_text: str
) -> PredictResponse:
    label = max(prob_dict, key=prob_dict.get)
    score = float(prob_dict[label])
    p_hoax, risk_level, risk_explanation = analyze_risk(
        prob_dict, original_text=original_text
    )

    return PredictResponse(
        label=label,
        score=score,
        probabilities=prob_dict,
        hoax_probability=float(p_hoax),
        risk_level=risk_level,
        risk_explanation=risk_explanation,
    )


def _maybe_log(sample_info: Dict[str, Any]):
    if not ENABLE_LOGGING:
        return
    if random.random() > LOG_SAMPLE_RATE:
        return
    print("[HOAX_LOG]", sample_info)


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
        "topic_models": sorted(ALLOWED_TOPIC_MODELS),
        "topic_defaults": {
            "default_model": DEFAULT_TOPIC_MODEL,
            "bertopic_enabled": ENABLE_BERTOPIC_ENGINE,
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

    _maybe_log(
        {
            "route": "/predict",
            "text_len": len(str(original_text)),
            "word_count": len(str(original_text).split()),
            "label": response.label,
            "p_hoax": response.hoax_probability,
            "risk_level": response.risk_level,
        }
    )

    return response


@app.post("/predict-batch", response_model=BatchPredictResponse)
def predict_batch(request: BatchPredictRequest):
    texts = request.texts or []
    prob_list = _predict_proba(texts, batch_size=PREDICT_BATCH_SIZE)
    results: List[PredictResponse] = []

    for original_text, prob_dict in zip(texts, prob_list):
        response = _build_predict_response(prob_dict, original_text=str(original_text))
        _maybe_log(
            {
                "route": "/predict-batch",
                "text_len": len(str(original_text)),
                "word_count": len(str(original_text).split()),
                "label": response.label,
                "p_hoax": response.hoax_probability,
                "risk_level": response.risk_level,
            }
        )
        results.append(response)

    return BatchPredictResponse(results=results)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    original_text = _normalize_unit_text(request.text)
    requested_topic_model, _, fallback_reason = _interpret_topic_model(request.topic_model)

    meta_kwargs = {
        "model_id": MODEL_ID,
        "max_length": MAX_LENGTH,
        "sentence_batch_size": SENTENCE_BATCH_SIZE,
        "topic_model_requested": requested_topic_model,
        "topic_model_used": DEFAULT_TOPIC_MODEL if fallback_reason else requested_topic_model,
        "topic_fallback_reason": fallback_reason,
    }

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
            meta=AnalyzeMeta(**meta_kwargs),
        )

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
    paragraph_sentences: List[List[SentenceAnalysis]] = [[] for _ in paragraph_texts]

    if request.sentence_level:
        sentence_texts: List[str] = []
        sentence_map: List[Tuple[int, int]] = []

        for paragraph_idx, paragraph in enumerate(paragraph_texts):
            for sentence_idx, sentence in enumerate(_split_sentences(paragraph)):
                sentence_texts.append(sentence)
                sentence_map.append((paragraph_idx, sentence_idx))

        sentence_prob_list = _predict_proba(sentence_texts, batch_size=SENTENCE_BATCH_SIZE)

        for (paragraph_idx, sentence_idx), sent_text, sent_prob_dict in zip(
            sentence_map, sentence_texts, sentence_prob_list
        ):
            p_hoax = _extract_hoax_probability(sent_prob_dict)
            p_not_hoax = _extract_not_hoax_probability(sent_prob_dict, p_hoax)
            sent_label = _to_canonical_label(p_hoax)
            sent_conf = max(p_hoax, p_not_hoax)

            paragraph_sentences[paragraph_idx].append(
                SentenceAnalysis(
                    sentence_index=int(sentence_idx),
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
    else:
        paragraph_prob_list = _predict_proba(paragraph_texts, batch_size=SENTENCE_BATCH_SIZE)

        for paragraph_idx, (paragraph_text, para_prob_dict) in enumerate(
            zip(paragraph_texts, paragraph_prob_list)
        ):
            p_hoax = _extract_hoax_probability(para_prob_dict)
            p_not_hoax = _extract_not_hoax_probability(para_prob_dict, p_hoax)
            para_label = _to_canonical_label(p_hoax)
            para_conf = max(p_hoax, p_not_hoax)

            paragraph_sentences[paragraph_idx].append(
                SentenceAnalysis(
                    sentence_index=0,
                    text=paragraph_text,
                    label=para_label,
                    probabilities={
                        "not_hoax": _round6(p_not_hoax),
                        "hoax": _round6(p_hoax),
                    },
                    hoax_probability=_round6(p_hoax),
                    confidence=_round6(para_conf),
                    color=_sentence_color(para_label, para_conf),
                )
            )

    fallback_topic = TopicInfo(
        label="topik_umum",
        score=0.0,
        keywords=["topik_umum"],
        source=DEFAULT_TOPIC_MODEL,
        topic_id=None,
    )

    topics_global: Optional[TopicInfo] = None
    if request.topic_per_paragraph:
        topics, requested_topic_model, topic_model_used, fallback_reason = _extract_topics(
            paragraph_texts,
            request.topic_model,
        )
    else:
        doc_for_topic = "\n\n".join(paragraph_texts)
        global_topics, requested_topic_model, topic_model_used, fallback_reason = _extract_topics(
            [doc_for_topic] if doc_for_topic else [],
            request.topic_model,
        )
        global_topic = global_topics[0] if global_topics else fallback_topic
        topics_global = global_topic
        topics = [global_topic for _ in paragraph_texts]

    paragraphs: List[ParagraphAnalysis] = []
    hoax_sentence_count = 0
    not_hoax_sentence_count = 0

    for paragraph_idx, paragraph_text in enumerate(paragraph_texts):
        sentences = sorted(
            paragraph_sentences[paragraph_idx],
            key=lambda item: item.sentence_index,
        )

        hoax_count = sum(1 for sentence in sentences if sentence.label == "hoax")
        not_hoax_count = sum(1 for sentence in sentences if sentence.label == "not_hoax")
        hoax_sentence_count += hoax_count
        not_hoax_sentence_count += not_hoax_count

        if sentences:
            paragraph_hoax_probability = max(sentence.hoax_probability for sentence in sentences)
            paragraph_label = "hoax" if hoax_count > 0 else "not_hoax"
            paragraph_confidence = max(
                paragraph_hoax_probability, 1.0 - paragraph_hoax_probability
            )
        else:
            paragraph_hoax_probability = 0.0
            paragraph_label = "not_hoax"
            paragraph_confidence = 0.0

        topic_info = topics[paragraph_idx] if paragraph_idx < len(topics) else fallback_topic

        paragraphs.append(
            ParagraphAnalysis(
                paragraph_index=int(paragraph_idx),
                text=paragraph_text,
                label=paragraph_label,
                hoax_probability=_round6(paragraph_hoax_probability),
                confidence=_round6(paragraph_confidence),
                topic=topic_info,
                sentences=sentences,
            )
        )

    sentence_aggregate_label = "hoax" if hoax_sentence_count > 0 else "not_hoax"

    shared_topic_map: Dict[str, List[int]] = defaultdict(list)
    for paragraph in paragraphs:
        shared_topic_map[paragraph.topic.label].append(int(paragraph.paragraph_index))

    shared_topics = sorted(
        [
            SharedTopic(label=label, paragraph_indices=indices)
            for label, indices in shared_topic_map.items()
            if len(indices) > 1
        ],
        key=lambda item: (item.paragraph_indices[0], item.label),
    )

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
            topic_model_requested=requested_topic_model,
            topic_model_used=topic_model_used,
            topic_fallback_reason=fallback_reason,
        ),
    )

    _maybe_log(
        {
            "route": "/analyze",
            "text_len": len(original_text),
            "word_count": len(original_text.split()),
            "doc_label": response.document.label,
            "doc_p_hoax": response.document.hoax_probability,
            "paragraph_count": response.document.summary.paragraph_count,
            "sentence_count": response.document.summary.sentence_count,
            "topic_model_requested": requested_topic_model,
            "topic_model_used": topic_model_used,
            "topic_fallback_reason": fallback_reason,
        }
    )

    return response


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "7860"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
