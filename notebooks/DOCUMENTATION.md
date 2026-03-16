# Deteksi Hoaks V2 — Dokumentasi Sistem

**Versi**: 2.0.0  
**Model**: IndoBERT (`indolem/indobert-base-uncased`) + 3 Metode Topic Modelling  
**Stack**: Python · FastAPI · HuggingFace Transformers · sklearn · BERTopic

---

## Daftar Isi

1. [Gambaran Sistem](#gambaran-sistem)
2. [Arsitektur V2](#arsitektur-v2)
3. [Tiga Metode Topic Modelling](#tiga-metode-topic-modelling)
4. [Evaluasi Topic Modelling](#evaluasi-topic-modelling)
5. [Backend FastAPI V2](#backend-fastapi-v2)
6. [Frontend V2](#frontend-v2)
7. [Notebook V2](#notebook-v2)
8. [Manajemen Artefak HF Hub](#manajemen-artefak-hf-hub)
9. [Panduan Deploy](#panduan-deploy)
10. [FAQ & Trade-off](#faq--trade-off)

---

## Gambaran Sistem

Sistem V2 mempertahankan pipeline inti V1 (IndoBERT sequence classification, inferensi
per kalimat, highlight UI) dan **menambahkan tiga metode topic modelling yang dapat
dipilih melalui UI**:

```
Teks input → IndoBERT inference → highlight kalimat hoaks/fakta
                                ↘
                          Topic Modelling (pilihan user)
                          ├── TF-IDF    (default, tanpa artefak)
                          ├── LDA       (sklearn pickle)
                          └── BERTopic  (embedding multilingual)
```

**Prinsip tidak berubah dari V1:**
- Training IndoBERT tidak diubah (arsitektur, hyperparameter, split 70/15/15, balancing)
- Topic modelling adalah **post-training** dan bisa di-toggle ON/OFF
- Setiap metode memiliki fallback otomatis ke TF-IDF

---

## Arsitektur V2

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (index.html + app.js)                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Textarea input      │  │ Dropdown topic model:    │  │
│  │ Toggle per kalimat  │  │  ○ TF-IDF (default)      │  │
│  │ Toggle per paragraf │  │  ○ LDA                   │  │
│  │                     │  │  ○ BERTopic              │  │
│  └─────────────────────┘  └──────────────────────────┘  │
└───────────────────┬─────────────────────────────────────┘
                    │ POST /analyze
                    │ { text, topic_model, sentence_level, ... }
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Backend FastAPI V2 (app.py)                            │
│                                                         │
│  ┌────────────────────────────┐                         │
│  │ IndoBERT inference         │  (tidak berubah)        │
│  │ doc-level + sentence-level │                         │
│  └────────────────────────────┘                         │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Topic Extraction Router                            │ │
│  │  topic_model="tfidf"    → _extract_topics_tfidf() │ │
│  │  topic_model="lda"      → _extract_topics_lda()   │ │
│  │  topic_model="bertopic" → _extract_topics_bertopic│ │
│  │                                                    │ │
│  │  Output seragam: TopicInfo(label, score, keywords) │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
  HF Hub: IndoBERT       HF Hub: Topic Models
  fjrmhri/TA-FINAL       fjrmhri/TA-FINAL-TopicModels
                         ├── lda_model.pkl
                         └── bertopic_model_v1/
```

---

## Tiga Metode Topic Modelling

### Metode 1 — TF-IDF (default)

**Cara kerja**: Membangun matrix TF-IDF dari teks input secara real-time, lalu
mengambil keyword dengan bobot TF-IDF tertinggi per paragraf sebagai "topik".

**Karakteristik**:
- Tidak memerlukan artefak yang disimpan
- Berjalan sepenuhnya in-process
- Cepat: O(n × V) di mana n = jumlah paragraf, V = vocabulary size
- Deterministik
- Cocok untuk deployment minimal (tanpa file model tambahan)

**Keterbatasan**:
- Tidak memahami semantik (kata berbeda makna sama ≠ satu topik)
- Topik antar paragraf tidak konsisten (vectorizer di-fit ulang per request)
- Bukan "topic modelling" dalam arti statistik, lebih tepat "keyword extraction"

**Output**: `TopicInfo(label="kata1 / kata2", score=<tfidf_mean>, keywords=[...])`

---

### Metode 2 — LDA (Latent Dirichlet Allocation)

**Cara kerja**: LDA adalah model probabilistik generatif yang mengasumsikan setiap
dokumen merupakan campuran topik, dan setiap topik merupakan distribusi kata.
Model di-fit pada corpus training (pra-oversampling), lalu artefak disimpan sebagai
`lda_model.pkl` yang berisi `{vectorizer: CountVectorizer, lda: LDA}`.

**Alasan dipilih sebagai metode ke-3**:

| Kriteria | LDA | NMF | KeyBERT |
|----------|-----|-----|---------|
| Dependensi baru | ❌ (sklearn sudah ada) | ❌ (sklearn) | ⚠️ (sentence-transformers) |
| Deterministik | ✅ (dengan seed) | ✅ | ❌ |
| Artefak deploy | 1 file `.pkl` | 1 file `.pkl` | Model SentenceTransformer |
| Output distribusi topik | ✅ (berguna untuk eval) | ✅ | ❌ |
| GPU diperlukan | ❌ | ❌ | Opsional |
| Kecepatan inference | ⚡ Cepat | ⚡ Cepat | 🐢 Lambat |

**Karakteristik**:
- Menghasilkan distribusi probabilitas topik per paragraf (`dist = [p_t1, p_t2, ...]`)
- Topik konsisten antar request (vectorizer dan LDA sudah di-fit)
- Cocok untuk deployment: `pickle.load` + dua operasi `transform`
- Tidak memerlukan GPU

**Keterbatasan**:
- Jumlah topik harus ditentukan manual (`LDA_N_TOPICS`)
- Tidak menangkap relasi semantik kata (berbeda dengan BERTopic)
- Kualitas bergantung pada ukuran corpus dan vocabulary

**Output**: `TopicInfo(label="kata1 / kata2", score=<prob_dominant_topic>, keywords=[...])`

**Format artefak**:
```python
{
  "vectorizer": CountVectorizer,  # sudah di-fit
  "lda": LatentDirichletAllocation,  # sudah di-fit
  "n_topics": 10,
  "versi": "V2"
}
```

---

### Metode 3 — BERTopic

**Cara kerja**: BERTopic menggunakan pipeline:
1. **SentenceTransformer** (multilingual MiniLM-L12) untuk encode dokumen ke embedding
2. **UMAP** untuk reduksi dimensi embedding
3. **HDBSCAN** untuk clustering dokumen ke topik
4. **c-TF-IDF** untuk mengekstrak representasi kata per cluster (topik)

**Konfigurasi yang digunakan**:
```
embedding: paraphrase-multilingual-MiniLM-L12-v2
UMAP: n_neighbors=15, n_components=5, min_dist=0.0, metric=cosine
HDBSCAN: min_cluster_size=15, cluster_selection_method=eom
nr_topics: "auto"  (merge topik mirip)
calculate_probabilities: False  (3x lebih cepat)
```

**Karakteristik**:
- Paling kaya makna semantik dari ketiga metode
- Topik konsisten antar request (model disimpan)
- Mendukung teks berbahasa Indonesia dengan model multilingual

**Keterbatasan**:
- Inference paling lambat (perlu encoding ulang dengan SentenceTransformer)
- Memerlukan lebih banyak memory
- Artefak lebih besar (folder `bertopic_model_v1/`)
- Dokumen di luar distribusi training → assigned ke outlier topic (-1)

**Output**: `TopicInfo(label="kata1 / kata2", score=<ctfidf_score>, keywords=[...])`

---

## Evaluasi Topic Modelling

> **Catatan Metodologis Penting:**
> Topic modelling adalah metode **unsupervised**. Tidak ada ground-truth untuk "topik
> yang benar". Oleh karena itu, evaluasi dibagi menjadi dua jalur dengan tujuan berbeda.

### Jalur 1 — Evaluasi Intrinsik: Topic Diversity

**Definisi**:
```
Topic Diversity = |kata unik di seluruh top-K keyword topik| / (n_topik × K)
```

**Interpretasi**:
- Nilai mendekati **1.0** = topik sangat beragam, sedikit overlap keyword antar topik
- Nilai mendekati **0.0** = banyak overlap keyword, topik kurang terdistingue
- Ini adalah ukuran **keragaman internal** topik, bukan validasi eksterior

**Keterbatasan**: Topic Diversity tinggi belum tentu berarti topik bermakna; bisa saja
kata-kata yang unik tapi tidak koheren secara semantik.

**Metrik tambahan (opsional)**: Topic Coherence berbasis NPMI dapat dihitung jika
tersedia library `gensim`, namun memerlukan corpus tambahan dan waktu komputasi ekstra.

---

### Jalur 2 — Evaluasi Proxy: LogReg F1 + Confusion Matrix

**Tujuan evaluasi ini**: Mengukur seberapa informatif representasi topik terhadap
label klasifikasi hoaks/non-hoaks, **bukan** mengukur kualitas topik secara murni.

**Prosedur**:
1. Buat representasi topik setiap dokumen:
   - LDA → distribusi probabilitas topik `(n_docs, n_topics)`
   - BERTopic → one-hot topic ID `(n_docs, n_unique_topics)`
   - TF-IDF → sparse TF-IDF vector `(n_docs, n_features)`
2. Latih Logistic Regression ringan dari representasi → label hoaks/non-hoaks
3. Evaluasi pada test set: F1-score + confusion matrix

**Cara membaca hasil**:

| Hasil | Interpretasi |
|-------|--------------|
| F1 tinggi (~0.8+) | Representasi topik sangat informatif terhadap label. Topik memisahkan hoaks vs fakta dengan baik. |
| F1 sedang (~0.6-0.8) | Representasi topik cukup informatif, ada korelasi dengan label. |
| F1 rendah (~0.5-0.6) | Topik bersifat tematik netral, tidak berkorelasi kuat dengan label. **Ini normal** untuk topic model yang dilatih tanpa informasi label. |

**Poin kritis yang HARUS dipahami**:
- F1 rendah pada evaluasi proxy **tidak berarti** metode topic modelling buruk
- Topic modelling dirancang untuk menemukan tema/struktur teks, bukan memprediksi label
- BERTopic mungkin menghasilkan F1 proxy rendah karena ia mengelompokkan dokumen
  berdasarkan tema (mis. "kesehatan", "politik"), bukan berdasarkan kebenaran/kepalsuan informasi
- Konfusikan dua tujuan ini akan menghasilkan kesimpulan yang salah

---

## Backend FastAPI V2

### Endpoint Utama: `POST /analyze`

**Request Schema**:
```json
{
  "text": "string (required)",
  "topic_per_paragraph": false,
  "sentence_level": true,
  "topic_model": "tfidf"  // ← BARU di V2: "tfidf" | "lda" | "bertopic"
}
```

**Response Schema** (tambahan di V2):
```json
{
  "meta": {
    "model_id": "...",
    "max_length": 256,
    "sentence_batch_size": 64,
    "topic_model_used": "tfidf"  // ← BARU di V2
  }
}
```

### Environment Variables

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `MODEL_ID` | `fjrmhri/TA-FINAL` | ID model IndoBERT di HF Hub |
| `TOPIC_REPO_ID` | `fjrmhri/TA-FINAL-TopicModels` | **BARU** Repo artefak topic model |
| `LDA_ARTIFACT` | `lda_model.pkl` | **BARU** Nama file LDA di repo |
| `BERTOPIC_DIR` | `bertopic_model_v1` | **BARU** Subfolder BERTopic di repo |
| `TOPIC_KEYWORDS_TOPK` | `3` | Jumlah keyword per topik |

### Lazy Loading

LDA dan BERTopic di-load **on-demand** (saat pertama kali request menggunakan metode tersebut):
- LDA: `huggingface_hub.hf_hub_download` → `pickle.load`
- BERTopic: `huggingface_hub.snapshot_download` → `BERTopic.load`

Ini memastikan startup backend tetap cepat bahkan jika hanya TF-IDF yang digunakan.

---

## Frontend V2

### Perubahan dari V1

**Tambahan di `index.html`**:
```html
<div class="topic-method-row">
  <label>Metode Topic Modelling:</label>
  <select id="topicModelSelect">
    <option value="tfidf">TF-IDF (cepat, tanpa artefak)</option>
    <option value="lda">LDA – Latent Dirichlet Allocation</option>
    <option value="bertopic">BERTopic (embedding semantik)</option>
  </select>
  <p id="topicMethodHint">...</p>
</div>
```

**Perubahan di `app.js`**:
1. `callAnalyzeApi(text, topicPerParagraph, sentenceLevel, topicModel)` — parameter baru
2. Request body menyertakan `topic_model: topicModel`
3. Global summary menampilkan metode topik yang digunakan (`meta.topic_model_used`)
4. Dropdown dilengkapi hint text yang berubah sesuai pilihan

### Backward Compatibility

Jika backend belum diupgrade ke V2 (tidak menerima `topic_model`), frontend mengirimkan
`topic_model: "tfidf"` sebagai default, yang merupakan perilaku identik dengan V1.
Fallback retry (status 422) tetap ada.

---

## Notebook V2

### Struktur Sel

| Sel | Konten |
|-----|--------|
| 0 | Instalasi dependensi |
| 1 | Import library |
| 2 | Config IndoBERT (**CONSTRAINT, identik V1**) |
| 3 | Config Topic Modelling V2 |
| 4 | Unduh dataset dari Kaggle |
| 5 | Pemuatan data & pra-pemrosesan |
| 6 | Split data & balancing |
| 7 | Tokenisasi & training IndoBERT |
| 8 | Laporan detail & confusion matrix IndoBERT |
| 9 | Simpan & upload IndoBERT ke HF (repo terpisah) |
| 10 | Setup inferensi pasca-training |
| 11 | **Metode 1: TF-IDF** |
| 12 | **Metode 2: Fit LDA** |
| 13 | **Metode 2: LDA inferensi** |
| 14 | **Simpan & upload LDA** |
| 15 | **Metode 3: Fit BERTopic** |
| 16 | **Metode 3: BERTopic inferensi** |
| 17 | **Simpan & upload BERTopic** |
| 18 | Router topik & demo 3 metode side-by-side |
| 19 | Evaluasi intrinsik: Topic Diversity |
| 20 | Evaluasi proxy: LogReg F1 + CM |
| 21 | Plot confusion matrix proxy |
| 22 | Tabel perbandingan lengkap |

### Corpus untuk Topic Modelling

Topic modelling di-fit pada **`train_df_pra_oversampling`** (corpus sebelum oversampling
minority class), bukan pada `train_df` yang sudah dibalance. Ini menghindari duplikasi
dokumen yang dapat mempengaruhi distribusi topik.

---

## Manajemen Artefak HF Hub

V2 menggunakan **dua repo HF yang terpisah**:

| Repo | Isi | Alasan Dipisah |
|------|-----|----------------|
| `username/TA-FINAL` | Model IndoBERT + tokenizer | Tidak berubah dari V1 |
| `username/TA-FINAL-TopicModels` | `lda_model.pkl`, `bertopic_model_v1/` | Versioning independen, tidak mempengaruhi classifier |

**Keuntungan pemisahan**:
- Dapat mengupdate topic model tanpa menyentuh IndoBERT
- Lebih mudah debug jika ada issue pada salah satu komponen
- Backend dapat menggunakan topic model dari repo berbeda via env var

---

## Panduan Deploy

### Minimal (TF-IDF only)

```bash
# Hanya butuh env var model IndoBERT
MODEL_ID=username/TA-FINAL
# Topic model default = TF-IDF, tidak butuh artefak tambahan
```

### Standard (TF-IDF + LDA)

```bash
MODEL_ID=username/TA-FINAL
TOPIC_REPO_ID=username/TA-FINAL-TopicModels
LDA_ARTIFACT=lda_model.pkl
```

### Full (TF-IDF + LDA + BERTopic)

```bash
MODEL_ID=username/TA-FINAL
TOPIC_REPO_ID=username/TA-FINAL-TopicModels
LDA_ARTIFACT=lda_model.pkl
BERTOPIC_DIR=bertopic_model_v1
# Disarankan GPU atau minimal 4GB RAM untuk BERTopic inference
```

### requirements.txt (tambahan V2)

```
# Baru di V2 (opsional — hanya dibutuhkan jika metode diaktifkan)
bertopic>=0.16.0
sentence-transformers>=2.3.0
umap-learn>=0.5.0
hdbscan>=0.8.29
huggingface_hub>=0.20.0
```

---

## FAQ & Trade-off

**Q: Mengapa LDA dipilih sebagai metode ke-3, bukan NMF atau KeyBERT?**

A: LDA menghasilkan distribusi probabilistik topik per dokumen (bukan hanya keyword),
yang sangat berguna untuk evaluasi proxy (LogReg di atas distribusi LDA lebih stabil
daripada one-hot topic ID). LDA juga bagian dari sklearn (tidak ada dependensi baru)
dan sudah sangat mapan dalam literatur akademis NLP, sehingga lebih mudah diinterpretasi
dalam konteks penulisan ilmiah.

**Q: Apakah TF-IDF benar-benar "topic modelling"?**

A: Secara teknis, TF-IDF adalah keyword extraction, bukan topic modelling dalam arti
statistik. Namun dalam konteks sistem ini, ia berfungsi sebagai "topik" yang cepat dan
reliable untuk deployment. Untuk evaluasi akademis yang rigorous, LDA atau BERTopic
adalah pilihan yang lebih tepat.

**Q: BERTopic sangat lambat saat inferensi. Bagaimana cara mengatasinya?**

A: Gunakan BERTopic hanya untuk analisis batch atau offline. Untuk deployment real-time,
gunakan TF-IDF atau LDA. Jika BERTopic diperlukan secara real-time, pertimbangkan:
- Caching embedding untuk dokumen yang sering muncul
- Mengurangi `UKURAN_BATCH_EMBED`
- Menggunakan model embedding yang lebih kecil

**Q: Mengapa F1 proxy pada evaluasi bisa rendah walaupun topiknya terlihat bagus?**

A: Ini normal. Topic modelling tidak dirancang untuk memprediksi label hoaks/fakta.
Ia dirancang untuk menemukan tema latent dalam teks. Topik "covid" atau "bantuan sosial"
bisa muncul di dokumen hoaks DAN dokumen fakta. F1 proxy rendah justru mengindikasikan
bahwa topic model berhasil menemukan tema yang netral terhadap label (yang merupakan
perilaku yang diharapkan dari model unsupervised).

**Q: Apakah sistem V2 backward compatible dengan frontend V1?**

A: Ya. Backend V2 menggunakan `topic_model: "tfidf"` sebagai default jika parameter
tidak dikirimkan. Frontend V1 yang tidak mengirimkan `topic_model` akan mendapat
respons identik dengan V1.
