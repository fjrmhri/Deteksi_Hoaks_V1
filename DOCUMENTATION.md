# Dokumentasi Sistem Deteksi Hoaks V2

Dokumentasi ini menjelaskan implementasi aktual repo `Deteksi_Hoaks` setelah penambahan **3 metode topic modelling** yang bisa dipilih dari UI tanpa mengubah inti training classifier IndoBERT.

## 1. Ringkasan Arsitektur V2

```text
CSV dataset (dataset/*.csv)
  -> notebook training `notebooks/Deteksi_Hoax_V2.ipynb`
     - load + preprocessing dataset
     - split 70/15/15
     - oversampling hanya di train
     - fine-tuning IndoBERT doc-level
     - simpan model classifier + metadata inferensi
     - post-training topic modelling:
       * TF-IDF
       * NMF
       * BERTopic (opsional)
     - simpan artifact topic model terpisah
     - upload classifier dan artifact topic ke repo Hugging Face terpisah
  -> backend `backend/app.py`
     - load classifier IndoBERT dari Hugging Face
     - endpoint `/analyze` untuk analisis dokumen/paragraf/kalimat
     - topic engine selectable: `tfidf | nmf | bertopic`
     - fallback aman ke TF-IDF bila artifact/dependency metode lain belum tersedia
  -> frontend `public/`
     - dropdown pemilihan metode topik
     - toggle deteksi per kalimat/paragraf
     - toggle topik global/per paragraf
     - render highlight inline + detail confidence + ringkasan topik
```

Prinsip utama V2:
- Backbone classifier tetap `indolem/indobert-base-uncased`.
- Training core IndoBERT tidak diubah secara semantik.
- Topic modelling selalu **post-training**.
- Fitur stabil lama tetap dipertahankan: multi-paragraf, highlight, rincian keyakinan, topik global vs per paragraf.

## 2. Training Classifier IndoBERT

Notebook baru [Deteksi_Hoax_V2.ipynb](d:/TA/Deteksi_Hoaks/notebooks/Deteksi_Hoax_V2.ipynb) mempertahankan konfigurasi penting dari baseline fix:

- `max_length = 256`
- `train_batch_size = 96`
- `eval_batch_size = 384`
- `grad_accumulation = 2`
- `learning_rate = 2e-5`
- `num_epochs = 3`
- split `70/15/15`
- oversampling hanya pada `train_df`
- evaluasi utama tetap pada classifier IndoBERT

Korpus untuk topic modelling memakai `train_df_pra_oversampling` agar tidak bias oleh duplikasi akibat oversampling.

## 3. Topic Modelling V2

### 3.1 Metode yang Tersedia

#### TF-IDF
- Dipakai sebagai default backend dan fallback tercepat.
- Menghasilkan keyword tertinggi per paragraf/dokumen.
- Tidak membutuhkan artifact berat untuk inferensi backend.
- Cocok untuk latency rendah.

#### NMF
- Dibangun di atas TF-IDF global corpus train.
- Fit pada `train_df_pra_oversampling`.
- Menyimpan artifact:
  - `nmf_vectorizer.joblib`
  - `nmf_model.joblib`
  - `nmf_topics.json`
  - `nmf_metadata.json`
- Inferensi menghasilkan distribusi topik, `topic_id`, label keyword, dan skor terstandar `0..1`.

#### BERTopic
- Tetap murni post-training.
- Opsi paling kaya tetapi paling berat.
- Di notebook, fit dapat dimatikan dengan `RUN_BERTOPIC=False`.
- Backend hanya memuat BERTopic bila `ENABLE_BERTOPIC_ENGINE=1` dan artifact/dependency tersedia.

### 3.2 Skema Output Topik

Semua metode distandarkan ke bentuk berikut:

```json
{
  "label": "kata1 / kata2",
  "score": 0.7345,
  "keywords": ["kata1", "kata2", "kata3"],
  "source": "tfidf",
  "topic_id": 4
}
```

Catatan kompatibilitas:
- `label`, `score`, dan `keywords` tetap dipertahankan untuk frontend lama.
- `source` dan `topic_id` adalah field tambahan.
- `topics_global` tetap tersedia untuk mode topik global.

## 4. Notebook V2

Notebook V2 melanjutkan baseline fix lalu menambahkan blok topic modelling baru setelah training classifier selesai.

### 4.1 Toggle Penting

- `RUN_TFIDF = True`
- `RUN_NMF = True`
- `RUN_BERTOPIC = False`
- `RUN_TOPIC_EVAL = False`
- `RUN_TOPIC_COHERENCE = False`
- `NMF_NUM_TOPICS = 20`

Default tersebut dipilih agar training classifier tidak ikut melambat.

### 4.2 Artefak Hugging Face

Notebook menyediakan sel upload terpisah untuk:

- classifier IndoBERT
- artifact TF-IDF
- artifact NMF
- artifact BERTopic

Repo ID disimpan sebagai variabel di sel konfigurasi:

- `REPO_CLASSIFIER_HF`
- `REPO_TOPIC_TFIDF_HF`
- `REPO_TOPIC_NMF_HF`
- `REPO_TOPIC_BERTOPIC_HF`

Tujuannya agar classifier dan artifact topic model tidak tercampur dalam satu repo.

## 5. Backend FastAPI

File utama backend adalah [backend/app.py](d:/TA/Deteksi_Hoaks/backend/app.py).

### 5.1 Perubahan Utama

- `AnalyzeRequest` sekarang menerima `topic_model`.
- Topic engine mendukung `tfidf`, `nmf`, dan `bertopic`.
- NMF dan BERTopic memakai lazy-load + cache.
- Jika artifact atau dependency metode terpilih tidak tersedia, backend otomatis fallback ke TF-IDF.
- Informasi fallback ditulis ke `meta.topic_model_used` dan `meta.topic_fallback_reason`.

### 5.2 Env Var Baru

Selain env classifier lama, backend kini mengenal:

| Env | Fungsi |
| --- | --- |
| `TOPIC_NMF_MODEL_DIR` | Direktori lokal artifact NMF |
| `TOPIC_NMF_MODEL_ID` | Repo Hugging Face artifact NMF |
| `TOPIC_BERTOPIC_MODEL_DIR` | Direktori lokal artifact BERTopic |
| `TOPIC_BERTOPIC_MODEL_ID` | Repo Hugging Face artifact BERTopic |
| `ENABLE_BERTOPIC_ENGINE` | Mengaktifkan loader BERTopic di backend |
| `TOPIC_ARTIFACT_CACHE_DIR` | Cache download artifact Hugging Face |
| `TOPIC_BERTOPIC_EMBED_BATCH` | Batch encode BERTopic saat inferensi |

`backend/requirements.txt` ditambah `huggingface_hub` untuk download artifact dari Hub.

### 5.3 Kontrak API `/analyze`

Request:

```json
{
  "text": "Paragraf 1...\\n\\nParagraf 2...",
  "topic_per_paragraph": true,
  "sentence_level": true,
  "topic_model": "nmf"
}
```

Pilihan `topic_model`:
- `tfidf`
- `nmf`
- `bertopic`

Response inti:

```json
{
  "document": {
    "label": "not_hoax",
    "hoax_probability": 0.0412,
    "confidence": 0.9588,
    "risk_level": "low",
    "risk_explanation": "...",
    "sentence_aggregate_label": "not_hoax",
    "summary": {
      "paragraph_count": 2,
      "sentence_count": 4,
      "hoax_sentence_count": 0,
      "not_hoax_sentence_count": 4
    }
  },
  "paragraphs": [
    {
      "paragraph_index": 0,
      "text": "...",
      "label": "not_hoax",
      "hoax_probability": 0.0321,
      "confidence": 0.9679,
      "topic": {
        "label": "bantuan / otp",
        "score": 0.7114,
        "keywords": ["bantuan", "otp", "rekening"],
        "source": "nmf",
        "topic_id": 3
      },
      "sentences": []
    }
  ],
  "shared_topics": [],
  "topics_global": null,
  "meta": {
    "model_id": "fjrmhri/TA-FINAL",
    "max_length": 256,
    "sentence_batch_size": 64,
    "topic_model_requested": "nmf",
    "topic_model_used": "nmf",
    "topic_fallback_reason": null
  }
}
```

Perilaku penting:
- `topic_per_paragraph=false` menghasilkan satu `topics_global`, lalu topik itu disalin ke tiap paragraf.
- `topic_per_paragraph=true` mengisi `paragraph.topic` untuk tiap paragraf.
- `shared_topics` tetap dibangun dari label topik paragraf.
- Bila `topic_model` invalid atau belum tersedia, response tetap sukses dengan `topic_model_used="tfidf"`.

## 6. Frontend

Frontend tetap berada di:

- [public/index.html](d:/TA/Deteksi_Hoaks/public/index.html)
- [public/app.js](d:/TA/Deteksi_Hoaks/public/app.js)
- [public/styles.css](d:/TA/Deteksi_Hoaks/public/styles.css)

### 6.1 Perubahan UI

- Dropdown baru `Metode Topik`:
  - `TF-IDF (cepat)`
  - `NMF`
  - `BERTopic (lebih berat)`
- Toggle lama tetap dipertahankan:
  - deteksi per kalimat / per paragraf
  - topik global / topik per paragraf

### 6.2 Perilaku Frontend

- Request `/analyze` sekarang mengirim `topic_model`.
- Jika backend lama atau schema lama menolak field baru, frontend retry tanpa `topic_model`, lalu fallback penuh ke payload minimal.
- Ringkasan hasil menampilkan metode topik aktif.
- Jika backend fallback, UI menampilkan catatan fallback tanpa menghentikan render hasil.

## 7. Evaluasi Topic Modelling

Notebook V2 menambahkan dua jalur evaluasi.

### 7.1 Intrinsic Metrics

- **Topic diversity**
  - Rasio keyword unik terhadap total keyword top-K.
- **Coherence `c_v`**
  - Opsional.
  - Dijalankan hanya jika `RUN_TOPIC_COHERENCE=True`.
  - Menggunakan `gensim` bila tersedia.

Catatan:
- Untuk TF-IDF baseline, coherence dicatat sebagai `N/A` karena tidak membangun latent topics seperti NMF/BERTopic.

### 7.2 Proxy Supervised Metrics

Representasi topik paragraf dipakai untuk melatih `LogisticRegression` ringan pada label `hoax/non-hoax`.

Metric yang dilaporkan:
- precision
- recall
- F1
- confusion matrix

Makna metric:
- ini **bukan** “akurasi topik murni”
- ini mengukur seberapa informatif representasi topik terhadap label klasifikasi
- berguna untuk membandingkan metode topik dalam konteks dataset yang sama

## 8. Validasi Ringan

Sesuai batasan implementasi, perubahan diverifikasi tanpa eksperimen berat:

- `python -m py_compile backend/app.py`
- `node --check public/app.js`
- validasi struktur JSON notebook baru

Tidak ada training ulang classifier, fitting topic model besar, atau coherence berat yang dijalankan lokal saat implementasi.

## 9. File Utama V2

- [notebooks/Deteksi_Hoax_V2.ipynb](d:/TA/Deteksi_Hoaks/notebooks/Deteksi_Hoax_V2.ipynb)
- [backend/app.py](d:/TA/Deteksi_Hoaks/backend/app.py)
- [backend/requirements.txt](d:/TA/Deteksi_Hoaks/backend/requirements.txt)
- [public/index.html](d:/TA/Deteksi_Hoaks/public/index.html)
- [public/app.js](d:/TA/Deteksi_Hoaks/public/app.js)
- [public/styles.css](d:/TA/Deteksi_Hoaks/public/styles.css)
