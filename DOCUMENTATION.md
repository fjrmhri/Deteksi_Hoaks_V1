# Dokumentasi Sistem Deteksi Hoaks V1 (IndoBERT + Sentence-Level + Topic)

Dokumentasi ini menjelaskan versi V1 sistem: classifier utama tetap IndoBERT doc-level, ditambah analisis tingkat kalimat dan topik per paragraf sebagai post-processing inferensi.

## Ringkasan Arsitektur V1

Alur utama:

1. Frontend (`public`) mengirim teks multi-paragraf ke backend `/analyze`.
2. Backend (`backend/app.py`) menjalankan inferensi doc-level IndoBERT sebagai keputusan utama.
3. Backend memecah teks menjadi paragraf dan kalimat, lalu mengklasifikasikan setiap kalimat dengan model yang sama (batched + `torch.no_grad()`).
4. Backend mengekstrak topik ringan per paragraf dengan TF-IDF keyword.
5. Frontend menampilkan:
   - label/risk dokumen,
   - highlight kalimat hoaks/fakta,
   - topic badge per paragraf,
   - topik bersama antar paragraf (jika ada).

## No-Regression Guarantee

Prinsip no-regression diterapkan sebagai berikut:

1. Backbone classifier tetap `indolem/indobert-base-uncased` fine-tuning biner (`not_hoax` vs `hoax`).
2. Pipeline training inti tetap mengikuti baseline notebook.
3. Fitur sentence-level dan topic tidak mengubah keputusan training, karena dijalankan sebagai post-processing inferensi.
4. Verifikasi no-regression dilakukan di Google Colab (GPU T4), bukan lokal laptop.

## Notebook

### Baseline
- `notebooks/Deteksi_Hoax.ipynb` tetap menjadi referensi training baseline.

### V1 Terpadu
- `notebooks/Deteksi_Hoax_V1.ipynb` berisi:
  1. Training doc-level baseline (struktur tetap).
  2. Util inferensi multi-paragraf:
     - split paragraf (blank line),
     - split kalimat regex ringan (tanpa NLTK download),
     - klasifikasi kalimat batched,
     - agregasi label paragraf (`>=1 kalimat hoax => paragraf hoax`).
  3. Topic extraction TF-IDF keyword per paragraf.
  4. Demo inferensi multi-paragraf.
  5. Markdown `No-Regression Guarantee`.

## Backend (Hugging Face Spaces)

File utama: `backend/app.py`

### Endpoint yang tersedia

1. `GET /health`
2. `POST /predict` (kompatibilitas lama)
3. `POST /predict-batch` (kompatibilitas lama)
4. `POST /analyze` (endpoint utama V1)

### Request `/analyze`

```json
{ "text": "paragraf 1...\n\nparagraf 2..." }
```

### Response `/analyze` (stabil)

```json
{
  "document": {
    "label": "hoax|not_hoax",
    "hoax_probability": 0.0,
    "confidence": 0.0,
    "risk_level": "low|medium|high",
    "risk_explanation": "...",
    "sentence_aggregate_label": "hoax|not_hoax",
    "summary": {
      "paragraph_count": 0,
      "sentence_count": 0,
      "hoax_sentence_count": 0,
      "not_hoax_sentence_count": 0
    }
  },
  "paragraphs": [
    {
      "paragraph_index": 0,
      "text": "...",
      "label": "hoax|not_hoax",
      "hoax_probability": 0.0,
      "confidence": 0.0,
      "topic": {
        "label": "string",
        "score": 0.0,
        "keywords": ["k1", "k2", "k3"]
      },
      "sentences": [
        {
          "sentence_index": 0,
          "text": "...",
          "label": "hoax|not_hoax",
          "probabilities": {"not_hoax": 0.0, "hoax": 0.0},
          "hoax_probability": 0.0,
          "confidence": 0.0,
          "color": "red|amber|green"
        }
      ]
    }
  ],
  "shared_topics": [
    {"label": "string", "paragraph_indices": [0, 2]}
  ],
  "meta": {
    "model_id": "...",
    "max_length": 256,
    "sentence_batch_size": 64
  }
}
```

### Env penting backend

- `MODEL_ID` (default: `fjrmhri/hoaks-detection`)
- `MODEL_SUBFOLDER` (default: `models/indobert_hoax`)
- `MAX_LENGTH` (default: `256`)
- `SENTENCE_BATCH_SIZE` (default: `64`)
- `SENTENCE_AMBER_CONF` (default: `0.70`)
- `HOAX_THRESH_HIGH` (default: `0.98`)
- `HOAX_THRESH_MED` (default: `0.60`)
- `TOPIC_KEYWORDS_TOPK` (default: `3`)
- `TOPIC_MAX_FEATURES` (default: `1500`)

## Frontend (Vercel)

Folder: `public/`

- `public/app.js`
  - endpoint utama ke `/analyze`,
  - render ringkasan dokumen,
  - render topic badge per paragraf,
  - render kalimat berwarna dengan confidence,
  - fallback error handling + copy/share.

- `public/index.html`
  - struktur panel hasil untuk analisis bertingkat.

- `public/styles.css`
  - gaya highlight kalimat (`red/amber/green`) dan card paragraf.

Tidak ada fitur NER di frontend maupun backend V1.

## Deploy

### Backend ke Hugging Face Spaces (Docker)

1. Pastikan dependency backend sudah mencakup `scikit-learn` di `backend/requirements.txt`.
2. Gunakan `backend/Dockerfile`.
3. Atur env variable di Space sesuai kebutuhan.
4. Verifikasi endpoint `/health`, `/predict`, `/analyze`.

### Frontend ke Vercel

1. Build statis dari folder `public` (sesuai `package.json` saat ini).
2. Pastikan `apiBaseUrl` di `public/app.js` mengarah ke Space backend aktif.
3. Verifikasi render hasil `/analyze` di browser.

## Verifikasi Ringan (Tanpa Beban Berat Lokal)

1. Colab: jalankan notebook V1 untuk training baseline + demo inferensi multi-paragraf.
2. Backend smoke test:
   - `GET /health`
   - `POST /predict`
   - `POST /analyze`
3. Frontend smoke test:
   - input multi-paragraf,
   - cek highlight kalimat, badge topik, ringkasan confidence,
   - cek fallback saat backend tidak tersedia.
