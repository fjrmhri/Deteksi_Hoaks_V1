# Dokumentasi Sistem Deteksi Hoaks

Dokumentasi ini merangkum implementasi aktual repo `Deteksi_Hoaks` berdasarkan notebook training, backend FastAPI, frontend statis, file dataset, preview evaluasi, dan konfigurasi deploy. Bagian training utama ada di `notebooks/Deteksi_Hoax_V1.ipynb` cell 0-12, post-processing inferensi ada di cell 13-16, dan unggah artefak ke Hugging Face ada di cell 18.

## 1. Ringkasan Sistem End-to-End

```text
CSV dataset (dataset/*.csv)
  -> notebook training `notebooks/Deteksi_Hoax_V1.ipynb`
     - load + align schema (cell 3)
     - preprocessing + label mapping (cell 4)
     - split 70/15/15 + oversampling train only (cell 5)
     - tokenisasi + fine-tuning IndoBERT doc-level (cell 7-9)
     - simpan model/tokenizer ke `indobert_hoax_model_v3` (cell 11)
     - upload folder ke Hugging Face model repo `fjrmhri/TA-FINAL` (cell 18)
  -> backend `backend/app.py`
     - load model dari Hugging Face
     - endpoint `/analyze` untuk dokumen, paragraf, kalimat, dan topik
  -> frontend `public/`
     - kirim input multi-paragraf ke `/analyze`
     - render highlight inline, topik per paragraf, dan rincian confidence
```

Ringkasan keputusan model:
- Keputusan utama tetap doc-level (`document.label`) dengan backbone `indolem/indobert-base-uncased` hasil fine-tuning.
- Analisis kalimat dan topik per paragraf adalah post-processing inferensi. Notebook menjelaskan ini di section `## 11. Inferensi Multi-Paragraf (Sentence-Level + Topic)` pada cell 13 dan implementasinya di cell 14.
- Backend memproduksi response terstruktur untuk frontend melalui `POST /analyze` di `backend/app.py`.

## 2. Dataset

### 2.1 File yang Dipakai

| File | Header aktual | Peran di training |
| --- | --- | --- |
| `dataset/Summarized_CNN.csv` | `url, judul, tanggal, isi_berita, Narasi, Clean Narasi, hoax, summary` | Sumber `cnn`; notebook mengisi label kosong menjadi `0` pada cell 4 |
| `dataset/Summarized_Detik.csv` | `url, judul, tanggal, isi_berita, Narasi, Clean Narasi, hoax, summary` | Sumber `detik`; notebook mengisi label kosong menjadi `0` pada cell 4 |
| `dataset/Summarized_Kompas.csv` | `url, judul, tanggal, isi_berita, Narasi, Clean Narasi, hoax, summary` | Sumber `kompas`; notebook mengisi label kosong menjadi `0` pada cell 4 |
| `dataset/Summarized_TurnBackHoax.csv` | `url, judul, tanggal, isi_berita, Narasi, Clean Narasi, hoax, summary` | Sumber `turnbackhoax`; notebook mengisi label kosong menjadi `1` pada cell 4 |
| `dataset/Summarized_2020+.csv` | `url, judul, tanggal, isi_berita, Narasi, Clean Narasi, summary, source_file, hoax` | Sumber `merged_extra`; notebook mengisi label kosong menjadi `0` pada cell 4 |

Notebook cell 3 mendefinisikan skema standar `BASE_COLS`:
- `url`
- `judul`
- `tanggal`
- `isi_berita`
- `Narasi`
- `Clean Narasi`
- `hoax`
- `summary`

Saat load, `load_single_dataset()`:
- memastikan semua `BASE_COLS` ada,
- menambahkan kolom yang hilang dengan string kosong atau `NaN` untuk `hoax`,
- lalu menambah kolom `source` untuk menandai asal dataset.

### 2.2 Penempatan Data di Colab
Cell 1 mengharuskan path berikut:
- `/content/dataset/Summarized_CNN.csv`
- `/content/dataset/Summarized_Detik.csv`
- `/content/dataset/Summarized_Kompas.csv`
- `/content/dataset/Summarized_TurnBackHoax.csv`
- `/content/dataset/Summarized_2020+.csv`

Cell 2 menyediakan jalur otomatis dengan `kagglehub.dataset_download("fjrmhri/dataset-berita")`, lalu menyalin file ke `/content/dataset/`.

### 2.3 Strategi Preprocessing
Implementasi preprocessing ada di notebook cell 4.

Urutan yang dilakukan:
1. Pilih kolom teks dengan prioritas `Clean Narasi -> Narasi -> isi_berita -> judul`.
2. Simpan hasilnya ke kolom `text`.
3. Buang baris yang `text`-nya kosong.
4. Konversi `hoax` menjadi numerik (`hoax_num`).
5. Isi label yang hilang berdasarkan sumber:
   - `cnn`, `detik`, `kompas` -> `0`
   - `turnbackhoax` -> `1`
   - `merged_extra` -> `0`
6. Buang baris dengan label di luar `0/1`.
7. Bentuk kolom `label` dari `hoax_num`.
8. Hapus duplikat berdasarkan pasangan `text` + `label`.

Notebook output di cell 9 menunjukkan hasil preprocessing:
- total baris merged mentah: `173229`
- duplikat `text + label` yang dibuang: `1055`
- distribusi label akhir: `160221` non-hoaks dan `11953` hoaks

### 2.4 Split dan Balancing
Implementasi split ada di cell 5.

Aturan split:
- train `70%`
- validation `15%`
- test `15%`
- stratify berdasarkan `label`

Balancing:
- hanya dilakukan di `train_df`
- metode: oversampling kelas minoritas dengan `sklearn.utils.resample`
- validation dan test tidak di-balance

Notebook output di cell 9:
- train sebelum balancing: `112154` non-hoaks, `8367` hoaks
- train sesudah balancing: `112154` non-hoaks, `112154` hoaks
- validation: `25826`
- test: `25827`

### 2.5 Catatan Bias dan Leakage
Notebook tidak membahas bias atau leakage secara eksplisit. Dari implementasi yang ada, dua catatan berikut adalah inferensi langsung dari kode:
- Label pada beberapa sumber diisi berdasarkan asal dataset, bukan hanya dari isi baris. Ini terlihat di cell 4 dan berarti kualitas label bergantung pada kurasi sumber data.
- Oversampling dilakukan hanya pada train split. Ini mengurangi risiko duplikasi hasil balancing masuk ke validation/test, karena balancing dijalankan setelah split di cell 5.

## 3. Model dan Training (`notebooks/Deteksi_Hoax_V1.ipynb`)

### 3.1 Backbone dan Label Mapping
Cell 1 dan cell 8 menunjukkan konfigurasi inti berikut:
- backbone: `indolem/indobert-base-uncased`
- jumlah label: `2`
- mapping label: `not_hoax -> 0`, `hoax -> 1`

### 3.2 Konfigurasi Training
Dari cell 1 dan cell 8:
- `max_length = 256`
- `train_batch_size = 96`
- `eval_batch_size = 384`
- `grad_accumulation = 2`
- `learning_rate = 2e-5`
- `weight_decay = 0.01`
- `num_epochs = 3`
- `seed = 42`
- `fp16 = torch.cuda.is_available()`
- `save_total_limit = 2`
- `output_dir = "indobert_hoax_model_v3"`

### 3.3 Tokenisasi dan Dataset Hugging Face
Cell 7:
- memuat tokenizer dengan `AutoTokenizer.from_pretrained(cfg.model_name)`
- men-tokenisasi `batch["text"]` dengan `truncation=True` dan `max_length=cfg.max_length`
- mengonversi `train_df`, `val_df`, `test_df` menjadi `datasets.Dataset`
- format tensor akhir hanya memakai `input_ids`, `attention_mask`, dan `label`

Catatan implementasi:
- padding saat training diserahkan ke `DataCollatorWithPadding` di cell 8, jadi notebook tidak mengunci `padding="max_length"` saat tokenisasi train/eval.

### 3.4 Jalur Training End-to-End
Cell 9 menjalankan alur penuh:
1. `load_all_datasets(cfg)`
2. `build_training_dataframe(df_raw)`
3. `stratified_splits(df_all)`
4. `balance_minority_only_train(train_df)` bila `cfg.balance_minority` aktif
5. `prepare_datasets(...)`
6. `trainer.train()`
7. `trainer.evaluate(val_ds)`
8. `trainer.evaluate(test_ds)`

Output training di cell 9:
- `global_step = 3507`
- `training_loss = 0.019015168411578076`
- `train_runtime = 7150.1223` detik

### 3.5 Artefak Output
Cell 11 dan cell 12 menunjukkan artefak yang disimpan:
- model fine-tuned disimpan ke folder `indobert_hoax_model_v3`
- tokenizer juga disimpan ke folder yang sama
- folder tersebut kemudian di-zip menjadi `indobert_hoax_model_v3.zip`

Repo ini tidak menyimpan artefak hasil training di workspace. Bukti yang ada hanya jalur output di notebook dan log upload pada cell 18.

Tidak ada artefak calibration terpisah di file repo ini.

### 3.6 Push ke Hugging Face
Cell 18 adalah sumber paling jelas untuk artefak Hugging Face:
- token dibaca dari Colab Secrets `HF_TOKEN`
- target repo model: `fjrmhri/TA-FINAL`
- folder yang diunggah: `/content/indobert_hoax_model_v3`
- metode unggah: `HfApi().upload_folder(...)`

Link repo model:
- [https://huggingface.co/fjrmhri/TA-FINAL](https://huggingface.co/fjrmhri/TA-FINAL)

Catatan artefak:
- log output cell 18 memperlihatkan upload file model utama dan file checkpoint seperti `checkpoint-3500` dan `checkpoint-3507`. Artinya, unggahan dapat mencakup lebih dari sekadar model final jika isi `output_dir` belum dibersihkan.

## 4. Inferensi

### 4.1 Jalur Inferensi Utama
Inferensi multi-paragraf diperkenalkan di notebook cell 13-16 dan diimplementasikan untuk produksi di `backend/app.py`.

Alur aktual di backend:
1. Normalisasi whitespace.
2. Prediksi doc-level pada seluruh input dengan model yang sama seperti training.
3. Split paragraf dengan regex baris kosong. Jika perlu, backend fallback ke split berbasis line break tunggal.
4. Split setiap paragraf menjadi kalimat dengan regex `[^.!?]+(?:[.!?]+(?:["\)\]]+)?)|[^.!?]+$`.
5. Klasifikasikan semua kalimat secara batched.
6. Bangun objek response untuk dokumen, paragraf, kalimat, shared topics, dan metadata.

### 4.2 Aturan Label dan Confidence
Backend `backend/app.py` memakai aturan berikut:
- probabilitas hoaks diambil dari label `hoax` atau hasil komplemen dari label non-hoaks bila perlu
- label kanonik:
  - `hoax` jika `P(hoax) >= 0.5`
  - `not_hoax` jika `P(hoax) < 0.5`
- confidence kalimat = `max(P(hoax), P(not_hoax))`
- label paragraf = `hoax` jika ada minimal satu kalimat hoaks, selain itu `not_hoax`
- `sentence_aggregate_label` dokumen = `hoax` jika ada minimal satu kalimat hoaks, selain itu `not_hoax`

Penting:
- `document.label` tetap keputusan utama doc-level.
- `sentence_aggregate_label` bisa berbeda dengan `document.label`.
- Notebook demo di cell 16 menunjukkan contoh mismatch ini: `document.label = not_hoax`, tetapi `sentence_aggregate_label = hoax`.

### 4.3 Risk Level Dokumen
Risk level di backend ditentukan dari `P(hoax)` dokumen:
- `high` jika `P(hoax) > 0.98`
- `medium` jika `0.60 < P(hoax) <= 0.98`
- `low` jika `P(hoax) <= 0.60`

Tambahan di backend:
- untuk teks sangat pendek (`< 5` kata), level minimum dinaikkan menjadi `medium`, tetapi label dokumen tidak diubah.

### 4.4 Aturan Warna
Ada dua sumber aturan warna yang perlu dibedakan:

Aturan warna yang dihitung backend:
- `red` jika label kalimat `hoax`
- `amber` jika label bukan hoax tetapi confidence `< SENTENCE_AMBER_CONF`
- `green` jika bukan hoax dan confidence cukup tinggi
- default env backend: `SENTENCE_AMBER_CONF = 0.70`

Aturan warna yang ditampilkan frontend:
- frontend tidak memakai field `sentence.color` secara langsung
- `public/app.js` menghitung ulang highlight dengan `CONFIDENCE_CUTOFF = 0.65`
- hasil UI saat ini sesuai legenda di `public/index.html`:
  - merah = Hoaks
  - hijau = Fakta
  - oranye = confidence `< 65%`

Jadi, warna yang terlihat pengguna mengikuti cutoff `0.65` di frontend, bukan cutoff default `0.70` yang dipakai backend untuk field `color`.

## 5. Topic per Paragraf

### 5.1 Metode yang Dipakai
Repo ini tidak memakai BERTopic. Topik per paragraf dihitung dengan ekstraksi keyword TF-IDF.

Bukti:
- notebook cell 14: `extract_topics_tfidf(...)`
- backend `backend/app.py`: `_extract_topics(...)`
- dependency backend juga memasang `scikit-learn`

### 5.2 Parameter Topic Extraction
Parameter aktual di backend:
- `TfidfVectorizer(lowercase=True)`
- `ngram_range=(1, 2)`
- `max_features=1500`
- `token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b"`
- stopwords di-hardcode pada `ID_STOPWORDS`
- jumlah keyword per paragraf: `TOPIC_KEYWORDS_TOPK = 3`

### 5.3 Bentuk Topik yang Dihasilkan
Untuk setiap paragraf, backend mengembalikan:
```json
{
  "label": "kata1 / kata2",
  "score": 0.123456,
  "keywords": ["kata1", "kata2", "kata3"]
}
```

Cara hitung:
- `keywords` diambil dari pasangan fitur TF-IDF tertinggi per paragraf
- `label` dibentuk dari maksimal dua keyword pertama, dipisahkan ` / `
- `score` adalah rata-rata bobot TF-IDF keyword terpilih
- jika vectorizer gagal atau paragraf kosong dari sisi fitur, backend fallback ke token alphabetic unik; jika tetap tidak ada token, label default menjadi `topik_umum`

### 5.4 Shared Topics
Backend juga membentuk `shared_topics`, yaitu daftar label topik yang muncul di lebih dari satu paragraf, dengan indeks paragraf terkait.

Catatan implementasi:
- `shared_topics` ada di response backend.
- frontend saat ini tidak merender `shared_topics`; `public/app.js` fokus pada topik per paragraf.

### 5.5 Fallback Topic di Frontend
Frontend punya fallback terbatas:
- jika backend mengembalikan hanya satu paragraf padahal input pengguna memiliki beberapa paragraf, UI membangun ulang struktur paragraf dari input asli (`buildFallbackParagraphs`)
- dalam mode fallback itu, jika topik backend tidak tersedia, UI menebak topik lokal dari frekuensi token (`inferTopicLocal`)
- di luar kondisi fallback tersebut, topik utama tetap bergantung pada payload backend

## 6. Backend (FastAPI)

### 6.1 Load Model
`backend/app.py` melakukan:
- `AutoTokenizer.from_pretrained(MODEL_ID, subfolder=MODEL_SUBFOLDER jika ada)`
- `AutoModelForSequenceClassification.from_pretrained(MODEL_ID, subfolder=MODEL_SUBFOLDER jika ada)`
- fallback tanpa `subfolder` bila load pertama gagal
- `model.eval()` setelah model dipindah ke device

Default env penting:

| Env var | Default | Fungsi |
| --- | --- | --- |
| `MODEL_ID` | `fjrmhri/TA-FINAL` | Repo model Hugging Face yang dimuat backend |
| `MODEL_SUBFOLDER` | kosong | Subfolder artefak model bila repo memakai struktur nested |
| `MAX_LENGTH` | `256` | Panjang maksimum token inferensi |
| `PREDICT_BATCH_SIZE` | `64` | Batch size untuk `/predict-batch` |
| `SENTENCE_BATCH_SIZE` | `64` | Batch size inferensi kalimat |
| `HOAX_THRESH_HIGH` | `0.98` | Ambang risk level `high` |
| `HOAX_THRESH_MED` | `0.60` | Ambang risk level `medium` |
| `SENTENCE_AMBER_CONF` | `0.70` | Ambang warna `amber` yang dihitung backend |
| `TOPIC_KEYWORDS_TOPK` | `3` | Jumlah keyword topik |
| `TOPIC_MAX_FEATURES` | `1500` | Batas fitur TF-IDF |
| `ENABLE_HOAX_LOGGING` | `0` | Aktivasi sampling log inferensi |
| `HOAX_LOG_SAMPLE_RATE` | `0.2` | Rasio sampling log |

### 6.2 Endpoint yang Tersedia
Endpoint aktual di backend:
- `GET /`
- `GET /health`
- `POST /predict`
- `POST /predict-batch`
- `POST /analyze`

`/predict` dan `/predict-batch` adalah endpoint kompatibilitas yang masih ada. Endpoint utama untuk UI saat ini adalah `/analyze`.

### 6.3 Kontrak API `/analyze`
Request:
```json
{
  "text": "Paragraf 1...\n\nParagraf 2..."
}
```

Response shape aktual:
```json
{
  "document": {
    "label": "hoax | not_hoax",
    "hoax_probability": 0.0,
    "confidence": 0.0,
    "risk_level": "low | medium | high",
    "risk_explanation": "...",
    "sentence_aggregate_label": "hoax | not_hoax",
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
      "label": "hoax | not_hoax",
      "hoax_probability": 0.0,
      "confidence": 0.0,
      "topic": {
        "label": "kata1 / kata2",
        "score": 0.0,
        "keywords": ["kata1", "kata2", "kata3"]
      },
      "sentences": [
        {
          "sentence_index": 0,
          "text": "...",
          "label": "hoax | not_hoax",
          "probabilities": {
            "not_hoax": 0.0,
            "hoax": 0.0
          },
          "hoax_probability": 0.0,
          "confidence": 0.0,
          "color": "red | amber | green"
        }
      ]
    }
  ],
  "shared_topics": [
    {
      "label": "kata1 / kata2",
      "paragraph_indices": [0, 2]
    }
  ],
  "meta": {
    "model_id": "fjrmhri/TA-FINAL",
    "max_length": 256,
    "sentence_batch_size": 64
  }
}
```

Perilaku penting:
- bila `text` kosong, backend mengembalikan struktur kosong dengan `document.label = not_hoax`
- `meta.model_id` membantu memastikan model yang sedang dipakai backend
- response model ini didefinisikan melalui kelas `DocumentAnalysis`, `ParagraphAnalysis`, `SentenceAnalysis`, `TopicInfo`, `SharedTopic`, dan `AnalyzeMeta` di `backend/app.py`

### 6.4 Health Check
`GET /health` mengembalikan:
```json
{ "status": "ok" }
```

### 6.5 Deploy ke Hugging Face Spaces (Docker)
File deploy backend:
- `backend/Dockerfile`
- `backend/requirements.txt`

Poin penting:
- image dasar: `python:3.11-slim`
- port yang diekspos: `7860`
- command start: `uvicorn app:app --host 0.0.0.0 --port 7860`
- `Dockerfile` mengasumsikan `requirements.txt` dan `app.py` ada di root build context, jadi deploy paling aman adalah memakai isi folder `backend/` sebagai root Space Docker

Contoh build lokal:
```bash
docker build -f backend/Dockerfile backend
```

## 7. Frontend (`public/`)

### 7.1 Alur UI
Frontend terdiri dari `public/index.html`, `public/app.js`, dan `public/styles.css`.

Alur interaksi:
1. pengguna menempelkan teks berita multi-paragraf ke textarea
2. frontend menghitung statistik input: jumlah paragraf, kalimat, dan kata
3. tombol `Deteksi` mengirim `POST /analyze`
4. frontend menampilkan:
   - ringkasan hasil
   - blok paragraf dengan highlight inline per kalimat
   - topik per paragraf
   - panel `Rincian Keyakinan`
5. tombol `Reset` membersihkan input dan output

Tambahan UI aktual:
- `Ctrl+Enter` atau `Ctrl+NumpadEnter` juga menjalankan deteksi
- jika request gagal, pesan error ditampilkan di `errorBox`

### 7.2 Highlight dan Rincian Confidence
Frontend menampilkan:
- highlight inline di setiap kalimat
- panel `Rincian Keyakinan` yang memuat item per kalimat dengan:
  - posisi `P{paragraf} S{kalimat}`
  - badge `Hoaks`, `Fakta`, atau `Ragu`
  - `Confidence`
  - `P(hoaks)`
  - `P(fakta)`

Field yang dipakai frontend terutama berasal dari:
- `sentence.label`
- `sentence.confidence`
- `sentence.hoax_probability`
- `sentence.probabilities.not_hoax`
- `sentence.probabilities.hoax`

### 7.3 Cara Set Backend URL
`public/app.js` menyelesaikan URL backend dengan urutan prioritas berikut:
1. query string `?api=...`
2. `window.__HOAX_API_BASE_URL__`
3. default hardcoded `https://fjrmhri-ta-final-space.hf.space`

Frontend juga bisa menerima URL halaman Hugging Face Space dalam format `https://huggingface.co/spaces/<owner>/<space>` lalu menormalkannya ke domain `.hf.space`.

### 7.4 Deploy ke Vercel
Berdasarkan `package.json` dan `vercel.json`:
- build command: `npm run build`
- hasil build: folder `dist`
- isi `dist` dibuat dengan menyalin seluruh `public/`
- Vercel memakai `@vercel/static-build`

Catatan:
- script build memakai `cp -r public dist`, sehingga paling aman dijalankan di environment POSIX/Linux seperti Vercel. Di PowerShell murni, `cp` bisa berbeda perilaku tergantung shell yang dipakai.

## 8. Preview dan Evaluasi

Folder `preview/` menyimpan dua gambar dokumentasi performa:
- `preview/confusion-matrix-validation.png`
- `preview/confusion-matrix-test.png`

Gambar ini sesuai dengan confusion matrix yang dibuat di notebook cell 10.

Ringkasan metrik dari notebook output:

| Split | Accuracy | Precision hoax | Recall hoax | F1 hoax |
| --- | --- | --- | --- | --- |
| Validation | `0.9984898939053667` | `0.9926966292134831` | `0.9854991634132738` | `0.9890848026868178` |
| Test | `0.998722267394587` | `0.9983012457531144` | `0.9832682654768544` | `0.9907277325091318` |

Confusion matrix dari output cell 10:
- Validation: `[[24020, 13], [26, 1767]]`
- Test: `[[24031, 3], [30, 1763]]`

## 9. Troubleshooting

### 9.1 Topik tidak muncul
Kemungkinan penyebab:
- backend tidak mengirim field topic yang diharapkan (`paragraph.topic`, `topic_label`, atau variasi kompatibel lainnya)
- backend mengembalikan satu paragraf untuk input multi-paragraf, sehingga frontend masuk mode fallback
- ada mismatch schema antara payload backend dan parser topik di `public/app.js`

Poin penting:
- backend resmi repo ini memang mengirim `paragraph.topic`
- frontend punya mode debug `?debug=1` yang mencetak potongan payload topic untuk membantu inspeksi schema

### 9.2 Hasil selalu Hoaks atau selalu Fakta
Periksa hal berikut:
- mapping label training di notebook cell 8 harus tetap `not_hoax -> 0`, `hoax -> 1`
- backend menganggap `P(hoax) >= 0.5` sebagai `hoax`
- `HOAX_THRESH_HIGH` dan `HOAX_THRESH_MED` hanya memengaruhi `risk_level`, bukan label utama
- jika model yang ter-load bukan artefak yang benar, cek `meta.model_id` dan env `MODEL_ID`

### 9.3 Kalimat tidak jadi oranye padahal confidence rendah
Penyebab paling mungkin:
- UI memakai cutoff `0.65`
- backend menghitung field `color` dengan cutoff default `0.70`

Jadi, interpretasi warna yang terlihat di browser mengikuti frontend, bukan field warna mentah dari backend.

### 9.4 Build frontend gagal di shell lokal Windows
`package.json` memakai `cp -r public dist`. Jika command itu gagal di PowerShell lokal, jalankan deploy lewat Vercel, Git Bash, WSL, atau ubah command build di luar scope repo ini.

## 10. Referensi Internal
- `notebooks/Deteksi_Hoax_V1.ipynb`
  - cell 1: config path dan hyperparameter
  - cell 3: schema dataset standar
  - cell 4: preprocessing dan label mapping
  - cell 5: split dan balancing
  - cell 7-9: tokenisasi, trainer, training, evaluasi
  - cell 11-12: simpan dan zip artefak
  - cell 13-16: inferensi multi-paragraf dan demo
  - cell 18: upload ke Hugging Face model repo
- `backend/app.py`: load model, schema response, endpoint FastAPI, inferensi kalimat, topik TF-IDF
- `backend/Dockerfile`: container backend untuk Hugging Face Spaces Docker
- `backend/requirements.txt`: dependency backend
- `public/app.js`: request `/analyze`, parsing payload, fallback topic, rendering highlight
- `public/index.html`: struktur UI dan legenda warna
- `public/styles.css`: styling highlight, kartu paragraf, dan rincian confidence
- `package.json` dan `vercel.json`: build frontend dan target deploy Vercel
- `preview/confusion-matrix-validation.png` dan `preview/confusion-matrix-test.png`: aset dokumentasi performa
