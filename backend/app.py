"""
Indo Hoax Detector API — v3.2.0

[FIX-RC1] ROOT CAUSE inkonsistensi label dokumen vs highlight kalimat:
  Versi sebelumnya menjalankan DUA inferensi terpisah:
    1. _predict_proba([original_text]) → full text dipotong 256 token
       → sinyal hoaks di luar 256 token pertama tidak terdeteksi
       → document.label = "not_hoax" (SALAH)
    2. _predict_proba(sentence_texts) → per kalimat (BENAR)
       → sentence.label = "hoax"
  Frontend membaca document.label untuk verdict dan sentence.label untuk highlight
  → inkonsistensi tampilan.

  Fix: hapus inferensi terpisah level dokumen. Jalankan HANYA inferensi per kalimat,
  lalu agregasi hasilnya menjadi verdict dokumen. Satu sumber kebenaran.
"""

import json
import os
import random
import re
import threading
from collections import Counter, defaultdict
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

MODEL_ID        = os.getenv("MODEL_ID", "fjrmhri/deteksi_hoaks_indobert")
SUBFOLDER       = os.getenv("MODEL_SUBFOLDER", "") or None
MAX_LENGTH      = int(os.getenv("MAX_LENGTH", "256"))

THRESH_HIGH     = float(os.getenv("HOAX_THRESH_HIGH", "0.80"))
THRESH_MED      = float(os.getenv("HOAX_THRESH_MED",  "0.50"))

MIN_KATA_KALIMAT      = int(os.getenv("MIN_KATA_KALIMAT", "8"))
THRESH_KALIMAT_PENDEK = float(os.getenv("THRESH_KALIMAT_PENDEK", "0.70"))

PREDICT_BATCH_SIZE   = int(os.getenv("PREDICT_BATCH_SIZE", "64"))
SENTENCE_BATCH_SIZE  = int(os.getenv("SENTENCE_BATCH_SIZE", "64"))
SENTENCE_AMBER_CONF  = float(os.getenv("SENTENCE_AMBER_CONF", "0.70"))
BERTOPIC_EMBED_BATCH = int(os.getenv("BERTOPIC_EMBED_BATCH", "32"))

TOPIC_KEYWORDS_TOPK     = int(os.getenv("TOPIC_KEYWORDS_TOPK", "3"))
TOPIC_BERTOPIC_MODEL_ID = os.getenv(
    "TOPIC_BERTOPIC_MODEL_ID", "fjrmhri/deteksi_hoaks_bertopic"
).strip()

BERTOPIC_EMBED_MODEL_ID = os.getenv(
    "BERTOPIC_EMBED_MODEL_ID",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

ENABLE_LOGGING  = os.getenv("ENABLE_HOAX_LOGGING", "0") == "1"
LOG_SAMPLE_RATE = float(os.getenv("HOAX_LOG_SAMPLE_RATE", "0.2"))

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
if torch.cuda.is_available():
    torch.set_float32_matmul_precision("high")

print("======================================")
print(f"Loading IndoBERT dari Hub : {MODEL_ID}")
print(f"Device                    : {DEVICE}")
print(f"THRESH_HIGH/MED           : {THRESH_HIGH} / {THRESH_MED}")
print(f"THRESH_KALIMAT_PENDEK     : {THRESH_KALIMAT_PENDEK} (< {MIN_KATA_KALIMAT} kata)")
print(f"BERTopic embed model      : {BERTOPIC_EMBED_MODEL_ID}")
print("======================================")


# =========================
# Load IndoBERT (singleton)
# =========================

def _load_model_artifacts():
    kw = {}
    if SUBFOLDER:
        kw["subfolder"] = SUBFOLDER
    try:
        tok = AutoTokenizer.from_pretrained(MODEL_ID, **kw)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, **kw)
        return tok, mdl
    except Exception as e:
        if SUBFOLDER:
            print(f"[WARN] Gagal load subfolder='{SUBFOLDER}', retry: {e}")
            tok = AutoTokenizer.from_pretrained(MODEL_ID)
            mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
            return tok, mdl
        raise


tokenizer, model = _load_model_artifacts()
model.to(DEVICE)
model.eval()

ID2LABEL: Dict[int, str] = {0: "not_hoax", 1: "hoax"}

_THRESHOLD_OPTIMAL: float = 0.62
try:
    from huggingface_hub import hf_hub_download
    _cfg_path = hf_hub_download(MODEL_ID, "inference_config.json")
    with open(_cfg_path, encoding="utf-8") as _f:
        _inf_cfg = json.load(_f)
    _THRESHOLD_OPTIMAL = float(_inf_cfg.get("threshold_optimal", 0.62))
    print(f"[INFO] threshold_optimal dari inference_config.json: {_THRESHOLD_OPTIMAL}")
except Exception as _e:
    print(f"[INFO] inference_config.json tidak tersedia ({_e}). Pakai {_THRESHOLD_OPTIMAL}")


# =========================
# Hard Mapping Kategori (Rule-based)
# =========================

PETA_KATEGORI: List[Tuple[str, set]] = [
    ("Kriminal & Hukum", {
        "polisi", "tersangka", "pengadilan", "hukum", "penjara", "korupsi",
        "kpk", "pembunuhan", "penipuan", "sidang", "vonis", "kriminal",
        "penyidikan", "jaksa", "hakim", "ditangkap", "ditahan", "terdakwa",
        "dakwaan", "kejaksaan", "mahkamah", "peradilan", "pidana", "perdata",
    }),
    ("Politik", {
        "pemilu", "pilkada", "dpr", "partai", "kampanye", "bawaslu", "kpu",
        "pilpres", "caleg", "koalisi", "oposisi", "legislasi", "debat",
        "konstitusi", "suara", "demokrat", "golkar", "pdip", "gerindra",
        "pks", "dpd", "mpr", "fraksi", "legislatif", "senator",
    }),
    ("Nasional & Pemerintahan", {
        "kementerian", "menteri", "kebijakan", "asn", "pns", "pemerintah",
        "presiden", "ibukota", "otonomi", "daerah", "regulasi", "proyek",
        "pembangunan", "gubernur", "bupati", "walikota", "dprd", "pemda",
        "anggaran", "apbn", "apbd", "perpres", "perda", "kabinet",
        "wapres", "jokowi", "prabowo",
    }),
    ("Ekonomi & Bisnis", {
        "ekonomi", "saham", "investasi", "inflasi", "bank", "keuangan",
        "pajak", "ihsg", "umkm", "harga", "pasar", "ekspor", "impor",
        "startup", "bisnis", "perdagangan", "rupiah", "dolar", "kurs",
        "bi", "ojk", "bumn", "swasta", "perusahaan", "modal", "aset",
        "defisit", "surplus", "neraca", "pdb", "gdp",
    }),
    ("Kesehatan", {
        "kesehatan", "penyakit", "dokter", "virus", "vaksin",
        "obat", "bpjs", "pandemi", "medis", "gejala", "terapi", "pasien",
        "klinis", "covid", "kemenkes", "epidemi", "wabah", "imunisasi",
        "apotek", "farmasi", "faskes", "puskesmas", "nakes",
    }),
    ("Teknologi & Sains", {
        "teknologi", "internet", "aplikasi", "digital", "siber", "hacker",
        "inovasi", "satelit", "algoritma", "data", "ai", "kecerdasan",
        "buatan", "software", "hardware", "smartphone", "kominfo", "server",
        "cloud", "robot",
    }),
    ("Bencana & Cuaca", {
        "gempa", "banjir", "cuaca", "bmkg", "tsunami", "longsor", "erupsi",
        "badai", "evakuasi", "korban", "mitigasi", "iklim", "hujan", "angin",
        "kebakaran", "bencana", "bnpb", "bpbd", "kekeringan", "rob", "topan",
    }),
    ("Olahraga", {
        "olahraga", "sepakbola", "futsal", "basket", "bulutangkis", "atlet",
        "turnamen", "medali", "piala", "fifa", "aff", "liga", "stadion",
        "pertandingan", "klub", "pssi", "pbsi", "olimpiade",
        "voli", "tenis", "badminton", "pemain", "pelatih",
    }),
    ("Internasional", {
        "diplomasi", "perang", "konflik", "pbb", "nato", "geopolitik",
        "internasional", "sanksi", "asean", "g20", "kedutaan", "wna", "visa",
    }),
    ("Pendidikan", {
        "sekolah", "guru", "siswa", "mahasiswa", "kampus", "universitas",
        "beasiswa", "kurikulum", "ujian", "akademik", "riset",
        "kemendikbud", "snbp", "snbt", "sma", "smp", "sd", "dosen",
        "rektor", "fakultas",
    }),
    ("Transportasi & Infrastruktur", {
        "jalan", "tol", "kereta", "bandara", "pelabuhan", "transportasi",
        "kendaraan", "mrt", "lrt", "bus", "pesawat", "kapal",
        "terminal", "stasiun", "garuda", "kemenhub",
    }),
    ("Lingkungan & Energi", {
        "lingkungan", "energi", "listrik", "minyak", "gas", "emisi",
        "polusi", "tambang", "pln", "pertamina", "karbon",
        "hutan", "deforestasi", "sawit", "sampah",
    }),
    ("Hiburan & Gaya Hidup", {
        "artis", "film", "musik", "konser", "selebritas", "bioskop", "drama",
        "viral", "sinetron", "festival", "influencer", "lifestyle", "seleb",
        "youtube", "instagram", "tiktok", "kuliner", "wisata",
    }),
]


def _kategorisasi_teks(teks: str) -> Optional[Tuple[str, float]]:
    teks_lower = teks.lower()
    teks_clean = re.sub(r"[^\w\s]", " ", teks_lower)
    token_set  = set(teks_clean.split())
    total      = max(len(token_set), 1)
    best_nama: Optional[str] = None
    best_skor: float = 0.0
    for nama, kata_kunci in PETA_KATEGORI:
        hit = 0
        for kw in kata_kunci:
            if " " in kw:
                if kw in teks_lower:
                    hit += 1
            else:
                if kw in token_set:
                    hit += 1
        if hit == 0:
            continue
        skor = hit / total
        if skor > best_skor:
            best_skor = skor
            best_nama = nama
    if best_nama is None:
        return None
    return best_nama, _round6(best_skor)


# =========================
# BERTopic + SentenceTransformer Singleton
# =========================

_bertopic_model = None
_st_embedder    = None
_bertopic_lock  = Lock()
_bertopic_ready = False


def _load_bertopic_background():
    global _bertopic_model, _st_embedder, _bertopic_ready
    with _bertopic_lock:
        if _bertopic_ready:
            return
        try:
            from bertopic import BERTopic
            from sentence_transformers import SentenceTransformer
            print(f"[INFO] Loading BERTopic dari: {TOPIC_BERTOPIC_MODEL_ID}")
            _bertopic_model = BERTopic.load(TOPIC_BERTOPIC_MODEL_ID)
            print(f"[INFO] Loading SentenceTransformer: {BERTOPIC_EMBED_MODEL_ID}")
            _st_embedder = SentenceTransformer(
                BERTOPIC_EMBED_MODEL_ID,
                device="cpu",
            )
            print("[INFO] BERTopic + embedder berhasil dimuat.")
        except Exception as e:
            print(f"[WARN] Gagal load BERTopic/embedder: {e}.")
            _bertopic_model = None
            _st_embedder    = None
        finally:
            _bertopic_ready = True


threading.Thread(target=_load_bertopic_background, daemon=True).start()


def _get_bertopic_components() -> Tuple[Optional[Any], Optional[Any]]:
    with _bertopic_lock:
        if _bertopic_ready:
            return _bertopic_model, _st_embedder
        return None, None


# =========================
# FastAPI
# =========================

app = FastAPI(title="Indo Hoax Detector API", version="3.2.0")

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
    topic_model_used: str = "bertopic+rules"

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

_FALLBACK_TOPIC = TopicInfo(label="topik_umum", score=0.0, keywords=["topik_umum"])


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
    unique_texts: List[str] = []
    text_to_idx: Dict[str, int] = {}
    inverse: List[int] = []
    for t in prepared:
        if t not in text_to_idx:
            text_to_idx[t] = len(unique_texts)
            unique_texts.append(t)
        inverse.append(text_to_idx[t])
    unique_results: List[Dict[str, float]] = []
    for chunk in _iter_chunks(unique_texts, batch_size):
        enc = tokenizer(
            chunk, padding=True, truncation=True,
            max_length=MAX_LENGTH, return_tensors="pt",
        )
        enc = {k: v.to(DEVICE) for k, v in enc.items()}
        with torch.inference_mode():
            probs = torch.softmax(model(**enc).logits, dim=-1).cpu().numpy()
        for row in probs:
            unique_results.append({
                ID2LABEL.get(idx, str(idx)): float(p)
                for idx, p in enumerate(row)
            })
    return [dict(unique_results[i]) for i in inverse]


def _extract_hoax_probability(prob_dict: Dict[str, float]) -> float:
    if not prob_dict:
        return 0.0
    for k in prob_dict:
        nk = re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")
        if nk in {"hoax", "hoaks"} or ("hoax" in nk and "not" not in nk and "non" not in nk):
            return float(prob_dict[k])
    if len(prob_dict) == 2:
        for k in prob_dict:
            nk = re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")
            if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
                return float(1.0 - float(prob_dict[k]))
    return 0.0


def _extract_not_hoax_probability(prob_dict: Dict[str, float], p_hoax: float) -> float:
    if not prob_dict:
        return float(1.0 - p_hoax)
    for k in prob_dict:
        nk = re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")
        if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
            return float(prob_dict[k])
    return float(max(0.0, min(1.0, 1.0 - p_hoax)))


def analyze_risk(
    p_hoax: float,
    original_text: Optional[str] = None,
) -> Tuple[str, str]:
    """Terima p_hoax langsung (bukan prob_dict) agar tidak ada ambiguitas."""
    thresh = _THRESHOLD_OPTIMAL
    if p_hoax > THRESH_HIGH:
        level = "high"
        explanation = (
            f"Model sangat yakin teks ini hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Jangan disebarkan sebelum ada klarifikasi resmi."
        )
    elif p_hoax > max(THRESH_MED, thresh):
        level = "medium"
        explanation = (
            f"Model menilai teks ini berpotensi hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Cek ulang ke sumber resmi."
        )
    else:
        level = "low"
        explanation = (
            f"Model menilai teks ini cenderung bukan hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Tetap gunakan literasi kritis."
        )
    if original_text is not None and len(str(original_text).strip().split()) < 5:
        if level == "low":
            level = "medium"
        explanation += " Teks sangat pendek (< 5 kata), prediksi bisa kurang stabil."
    return level, explanation


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


def _to_canonical_label(p_hoax: float, teks: Optional[str] = None) -> str:
    thresh = _THRESHOLD_OPTIMAL
    if teks is not None:
        n_kata = len(str(teks).strip().split())
        if n_kata < MIN_KATA_KALIMAT:
            thresh = THRESH_KALIMAT_PENDEK
    return "hoax" if p_hoax >= thresh else "not_hoax"


# =========================
# BERTopic inference dengan SentenceTransformer
# =========================

def _st_encode(texts: List[str], embedder) -> np.ndarray:
    return embedder.encode(
        texts,
        batch_size=BERTOPIC_EMBED_BATCH,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )


def _infer_topic_per_paragraf(texts: List[str]) -> List[TopicInfo]:
    rule_results: List[Optional[Tuple[str, float]]] = [
        _kategorisasi_teks(t) for t in texts
    ]
    idx_perlu_bertopic = [i for i, r in enumerate(rule_results) if r is None]
    bertopic_map: Dict[int, TopicInfo] = {}

    if idx_perlu_bertopic:
        btm, embedder = _get_bertopic_components()
        if btm is not None and embedder is not None:
            try:
                teks_subset = [texts[i] for i in idx_perlu_bertopic]
                embeddings  = _st_encode(teks_subset, embedder)
                topic_ids, _ = btm.transform(teks_subset, embeddings=embeddings)
                for local_i, (global_i, tid) in enumerate(
                    zip(idx_perlu_bertopic, topic_ids)
                ):
                    if tid == -1:
                        bertopic_map[global_i] = _FALLBACK_TOPIC
                        continue
                    topic_words = btm.get_topic(tid) or []
                    keywords    = [w for w, _ in topic_words[:TOPIC_KEYWORDS_TOPK]]
                    score       = float(topic_words[0][1]) if topic_words else 0.0
                    label       = " / ".join(keywords[:2]) if keywords else f"topik_{tid}"
                    bertopic_map[global_i] = TopicInfo(
                        label=label, score=_round6(score), keywords=keywords
                    )
            except Exception as e:
                print(f"[WARN] BERTopic inference error: {e}")

    final: List[TopicInfo] = []
    for i in range(len(texts)):
        rule_match = rule_results[i]
        if rule_match is not None:
            nama, skor = rule_match
            final.append(TopicInfo(label=nama, score=skor, keywords=[nama]))
        elif i in bertopic_map:
            final.append(bertopic_map[i])
        else:
            final.append(_FALLBACK_TOPIC)
    return final


def _build_predict_response(prob_dict: Dict[str, float], original_text: str) -> PredictResponse:
    label  = max(prob_dict, key=prob_dict.get)
    score  = float(prob_dict[label])
    p_hoax = _extract_hoax_probability(prob_dict)
    risk_level, risk_explanation = analyze_risk(p_hoax, original_text=original_text)
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
        "version": "3.2.0",
        "model_id": MODEL_ID,
        "id2label": ID2LABEL,
        "threshold_optimal": _THRESHOLD_OPTIMAL,
        "thresh_kalimat_pendek": THRESH_KALIMAT_PENDEK,
        "min_kata_kalimat": MIN_KATA_KALIMAT,
        "device": str(DEVICE),
        "bertopic_ready": _bertopic_ready,
        "bertopic_embed_model": BERTOPIC_EMBED_MODEL_ID,
        "topic_model": "bertopic+rule-based",
        "kategori": [nama for nama, _ in PETA_KATEGORI],
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
            label="unknown", score=0.0, probabilities={},
            hoax_probability=0.0, risk_level="low",
            risk_explanation="Teks kosong.",
        )
    response = _build_predict_response(prob_list[0], original_text=str(original_text))
    _maybe_log({"route": "/predict", "label": response.label, "p_hoax": response.hoax_probability})
    return response


@app.post("/predict-batch", response_model=BatchPredictResponse)
def predict_batch(request: BatchPredictRequest):
    texts     = request.texts or []
    prob_list = _predict_proba(texts, batch_size=PREDICT_BATCH_SIZE)
    results   = [
        _build_predict_response(pd, original_text=str(t))
        for t, pd in zip(texts, prob_list)
    ]
    return BatchPredictResponse(results=results)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    """
    [FIX-RC1] Satu sumber kebenaran: hanya inferensi per kalimat.
    Verdict dokumen (label, hoax_probability, confidence) diturunkan dari
    agregasi kalimat — bukan dari inferensi terpisah pada teks penuh yang
    dipotong 256 token.
    """
    original_text = _normalize_unit_text(request.text)

    base_meta = AnalyzeMeta(
        model_id=MODEL_ID,
        max_length=MAX_LENGTH,
        sentence_batch_size=SENTENCE_BATCH_SIZE,
        threshold_used=_THRESHOLD_OPTIMAL,
        topic_model_used="bertopic+rules",
    )

    if not original_text:
        return AnalyzeResponse(
            document=DocumentAnalysis(
                label="not_hoax", hoax_probability=0.0, confidence=0.0,
                risk_level="low", risk_explanation="Teks kosong.",
                sentence_aggregate_label="not_hoax",
                summary=DocumentSummary(
                    paragraph_count=0, sentence_count=0,
                    hoax_sentence_count=0, not_hoax_sentence_count=0,
                ),
            ),
            paragraphs=[], shared_topics=[], topics_global=None, meta=base_meta,
        )

    # ── Step 1: split paragraf & kalimat ──────────────────────────
    paragraph_texts = _split_paragraphs(original_text)
    sentence_texts: List[str] = []
    sentence_map:   List[Tuple[int, int]] = []
    for p_idx, paragraph in enumerate(paragraph_texts):
        for s_idx, sentence in enumerate(_split_sentences(paragraph)):
            sentence_texts.append(sentence)
            sentence_map.append((p_idx, s_idx))

    # ── Step 2: inferensi PER KALIMAT (satu-satunya inferensi) ────
    sentence_prob_list = _predict_proba(sentence_texts, batch_size=SENTENCE_BATCH_SIZE)

    # ── Step 3: bangun SentenceAnalysis ───────────────────────────
    paragraph_sentences: List[List[SentenceAnalysis]] = [[] for _ in paragraph_texts]
    for (p_idx, s_idx), sent_text, sent_prob_dict in zip(
        sentence_map, sentence_texts, sentence_prob_list
    ):
        p_hoax     = _extract_hoax_probability(sent_prob_dict)
        p_not_hoax = _extract_not_hoax_probability(sent_prob_dict, p_hoax)
        sent_label = _to_canonical_label(p_hoax, teks=sent_text)
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

    # ── Step 4: agregasi kalimat → verdict dokumen ─────────────────
    # [FIX-RC1] Tidak ada inferensi terpisah pada teks penuh.
    # document.label dan document.hoax_probability diturunkan dari kalimat.
    all_sentences_flat = [s for plist in paragraph_sentences for s in plist]
    hoax_sentence_count     = sum(1 for s in all_sentences_flat if s.label == "hoax")
    not_hoax_sentence_count = sum(1 for s in all_sentences_flat if s.label == "not_hoax")

    if all_sentences_flat:
        # Rata-rata P(hoaks) dari semua kalimat — representatif untuk dokumen
        p_hoax_doc = float(
            sum(s.hoax_probability for s in all_sentences_flat) / len(all_sentences_flat)
        )
    else:
        p_hoax_doc = 0.0

    p_not_hoax_doc = float(max(0.0, min(1.0, 1.0 - p_hoax_doc)))

    # Majority vote kalimat menentukan label dokumen
    doc_label = "hoax" if hoax_sentence_count > not_hoax_sentence_count else "not_hoax"

    # Confidence = keyakinan ke arah label yang menang
    doc_conf = p_hoax_doc if doc_label == "hoax" else p_not_hoax_doc

    risk_level, risk_explanation = analyze_risk(p_hoax_doc, original_text=original_text)

    # sentence_aggregate_label identik dengan doc_label (keduanya dari votes kalimat)
    sentence_aggregate_label = doc_label

    # ── Step 5: topik per paragraf ─────────────────────────────────
    per_paragraph_topics = _infer_topic_per_paragraf(paragraph_texts)

    if request.topic_per_paragraph:
        topics_global = None
    else:
        label_counts: Counter = Counter(t.label for t in per_paragraph_topics)
        most_common_label = label_counts.most_common(1)[0][0]
        topics_global = next(
            (t for t in per_paragraph_topics if t.label == most_common_label),
            _FALLBACK_TOPIC,
        )

    # ── Step 6: bangun ParagraphAnalysis ──────────────────────────
    paragraphs: List[ParagraphAnalysis] = []
    for p_idx, p_text in enumerate(paragraph_texts):
        sents  = sorted(paragraph_sentences[p_idx], key=lambda x: x.sentence_index)
        n_hoax = sum(1 for s in sents if s.label == "hoax")
        n_not  = sum(1 for s in sents if s.label == "not_hoax")

        if sents:
            p_max_hoax = max(s.hoax_probability for s in sents)
            p_label    = "hoax" if n_hoax > n_not else "not_hoax"
            p_conf     = p_max_hoax if p_label == "hoax" else (1.0 - p_max_hoax)
        else:
            p_max_hoax = 0.0
            p_label    = "not_hoax"
            p_conf     = 0.0

        topic_info = (
            per_paragraph_topics[p_idx]
            if p_idx < len(per_paragraph_topics)
            else _FALLBACK_TOPIC
        )
        paragraphs.append(ParagraphAnalysis(
            paragraph_index=int(p_idx),
            text=p_text,
            label=p_label,
            hoax_probability=_round6(p_max_hoax),
            confidence=_round6(p_conf),
            topic=topic_info,
            sentences=sents,
        ))

    shared_topic_map: Dict[str, List[int]] = defaultdict(list)
    for p in paragraphs:
        shared_topic_map[p.topic.label].append(int(p.paragraph_index))
    shared_topics = sorted(
        [SharedTopic(label=lbl, paragraph_indices=idxs)
         for lbl, idxs in shared_topic_map.items() if len(idxs) > 1],
        key=lambda x: (x.paragraph_indices[0], x.label),
    )

    _maybe_log({
        "route": "/analyze",
        "doc_label": doc_label,
        "doc_p_hoax": p_hoax_doc,
        "paragraph_count": len(paragraphs),
        "hoax_sentence_count": hoax_sentence_count,
    })

    return AnalyzeResponse(
        document=DocumentAnalysis(
            label=doc_label,
            hoax_probability=_round6(p_hoax_doc),
            confidence=_round6(doc_conf),
            risk_level=risk_level,
            risk_explanation=risk_explanation,
            sentence_aggregate_label=sentence_aggregate_label,
            summary=DocumentSummary(
                paragraph_count=len(paragraphs),
                sentence_count=hoax_sentence_count + not_hoax_sentence_count,
                hoax_sentence_count=hoax_sentence_count,
                not_hoax_sentence_count=not_hoax_sentence_count,
            ),
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
