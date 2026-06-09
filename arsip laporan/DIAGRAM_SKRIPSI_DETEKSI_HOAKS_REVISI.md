# DIAGRAM SKRIPSI DETEKSI HOAKS_REVISI

Judul skripsi: **Deteksi Hoaks Berita Berbahasa Indonesia Berbasis Fine-Tuning IndoBERT pada Tingkat Kalimat dan Pemodelan Topik BERTopic**

Dokumen ini memperbarui paket diagram agar konsisten dengan eksperimen terbaru. Diagram yang tidak memuat angka atau sumber dataset tidak perlu diubah secara struktural.

---

## 1. Ringkasan Perubahan Diagram

| Diagram | Status Revisi | Perubahan |
|---|---|---|
| Kerangka Pemikiran | Tidak berubah secara struktur | Tidak perlu angka detail. Tetap menampilkan masalah, pendekatan, implementasi, pengukuran, dan hasil. |
| Alur Penelitian | Perlu update teks | Dataset menjadi empat file; threshold menjadi 0,30; corpus BERTopic 17.218 dokumen. |
| Arsitektur Sistem | Tidak berubah | Backend FastAPI, frontend statis, Hugging Face Spaces, dan Vercel tetap. |
| Alur Praproses Data | Perlu update teks dan angka | Load empat file dataset; data bersih 24.598; hapus `Summarized_2020+.csv`. |
| Alur Segmentasi Kalimat dan Paragraf | Tidak berubah | Tetap segmentasi runtime, bukan dataset training berlabel kalimat. |
| Alur Training IndoBERT | Perlu update angka | Train 17.218; setelah balancing 17.702; checkpoint `checkpoint-186`. |
| Alur Threshold dan Agregasi Verdict | Perlu update angka | Threshold runtime 0,30; majority vote; tie ke `hoax`. |
| Alur BERTopic | Perlu update angka dan konfigurasi | Corpus 17.218; UMAP n_neighbors 12; HDBSCAN min_cluster_size 12; guided topic modeling tidak aktif. |
| Evaluasi BERTopic | Perlu update angka | Coherence 0,520257; DBCV -0,013278; outlier 21,90%; topik final 79. |
| Deployment | Tidak berubah | Frontend Vercel; backend Hugging Face Spaces. |
| Use Case | Tidak berubah | Aktor dan fitur utama tetap. |
| Sequence | Tidak berubah secara struktur | Request tetap ke `POST /analyze`. |

---

## 2. Diagram 1 - Kerangka Pemikiran Penelitian

```mermaid
flowchart LR
    P["Masalah\nHoaks Indonesia cepat menyebar\nLabel artikel kurang interpretatif\nSulit mengetahui bagian teks yang bermasalah\nButuh konteks topik"]
    A["Pendekatan\nFine-tuning IndoBERT\nInferensi tingkat kalimat runtime\nAgregasi verdict dokumen\nBERTopic untuk konteks topik"]
    D["Pengembangan\nPraproses data\nSplit stratified 70/15/15\nOversampling ringan hanya training\nTraining IndoBERT\nKalibrasi threshold\nBERTopic"]
    I["Implementasi\nBackend FastAPI\nFrontend statis public/\nVercel\nHugging Face Spaces"]
    M["Pengukuran\nAccuracy, precision, recall, F1, AUC\nConfusion matrix dan ROC\nThreshold validation\nCoherence, DBCV, c-TF-IDF\nBlack-box test"]
    R["Hasil\nVerdict dokumen\nHighlight kalimat/paragraf\nConfidence\nTopik global\nTopik per paragraf"]

    P --> A --> D --> I --> M --> R
```

Caption: Diagram ini menunjukkan kerangka pemikiran penelitian mulai dari masalah penyebaran hoaks, pendekatan IndoBERT dan BERTopic, tahap pengembangan, implementasi web, pengukuran performa, sampai keluaran sistem yang bersifat interpretatif.

---

## 3. Diagram 2 - Alur Penelitian

```mermaid
flowchart TD
    A[Identifikasi masalah dan studi literatur] --> B[Pengumpulan dataset\nCNN.csv, Detik.csv, Kompas.csv, TurnBackHoax.csv]
    B --> C[Praproses data\n24.598 data bersih]
    C --> D[Split train-validation-test\nStratified random 70/15/15]
    D --> E[Oversampling ringan training set\n17.218 menjadi 17.702]
    E --> F[Fine-tuning IndoBERT]
    F --> G[Evaluasi validation dan test]
    G --> H[Kalibrasi threshold 0,30]
    C --> I[Corpus BERTopic\nTrain pra-oversampling 17.218 dokumen]
    I --> J[Embedding, UMAP, HDBSCAN, c-TF-IDF]
    J --> K[Evaluasi BERTopic\nCoherence, DBCV, outlier, c-TF-IDF]
    H --> L[Integrasi backend FastAPI]
    K --> L
    L --> M[Integrasi frontend statis]
    M --> N[Deployment]
    N --> O[Pengujian sistem]
    O --> P[Analisis hasil dan kesimpulan]
```

Caption: Diagram ini memperlihatkan alur penelitian mulai dari pengumpulan empat file dataset, praproses, split data, oversampling ringan pada training set, fine-tuning IndoBERT, pemodelan BERTopic, integrasi sistem, deployment, sampai pengujian.

---

## 4. Diagram 3 - Arsitektur Sistem

```mermaid
flowchart LR
    A[Pengguna] --> B[Frontend Statis\nHTML, CSS, JavaScript]
    B -->|POST /analyze| C[Backend FastAPI]
    C --> D[IndoBERT Runtime\nfjrmhri/deteksi_hoaks_indobert]
    C --> E[BERTopic Runtime + Rules]
    C --> F[Inference Config\nthreshold 0,30]
    D --> C
    E --> C
    C -->|JSON response| B
    B --> G[Verdict, Confidence, Highlight, Topik]
```

Status: Tidak berubah secara arsitektur. Update hanya pada teks threshold.

---

## 5. Diagram 4 - Alur Praproses Data

```mermaid
flowchart TD
    A[Load CNN.csv] --> E[Gabungkan dataset]
    B[Load Detik.csv] --> E
    C[Load Kompas.csv] --> E
    D[Load TurnBackHoax.csv] --> E
    E --> F[Pilih kolom teks]
    F --> G[Periksa teks kosong\n0 baris dibuang]
    G --> H[Konversi label\nnot_hoax=0; hoax=1]
    H --> I[Periksa label NaN\n0 baris dibuang]
    I --> J[Hapus duplikat text-label\n77 baris]
    J --> K[Periksa konflik label\n0 konflik]
    K --> L[Dataset bersih\n24.598 data]
```

Caption: Diagram ini menunjukkan praproses dataset terbaru yang hanya memakai empat file utama dan tidak memakai `Summarized_2020+.csv`.

---

## 6. Diagram 5 - Alur Segmentasi Kalimat dan Paragraf

```mermaid
flowchart TD
    A[Input teks berita] --> B[Normalisasi line break]
    B --> C[Segmentasi paragraf\nblank line atau fallback line-based]
    C --> D[Segmentasi kalimat\nregex tanda akhir . ! ?]
    D --> E[Inferensi per kalimat]
    E --> F[Highlight kalimat/paragraf]
    E --> G[Agregasi verdict dokumen]
```

Status: Tidak berubah. Diagram ini tetap hanya menggambarkan proses runtime.

---

## 7. Diagram 6 - Alur Training IndoBERT

```mermaid
flowchart TD
    A[Dataset bersih 24.598] --> B[Split stratified 70/15/15]
    B --> C[Train 17.218]
    B --> D[Validation 3.690]
    B --> E[Test 3.690]
    C --> F[Oversampling ringan training set\n17.702 data]
    F --> G[Tokenisasi IndoBERT\nmax_length 256]
    G --> H[Fine-tuning IndoBERT\n3 epoch, LR 2e-5]
    H --> I[Pilih checkpoint terbaik\ncheckpoint-186]
    I --> J[Evaluasi validation dan test]
```

---

## 8. Diagram 7 - Alur Threshold dan Agregasi Verdict

```mermaid
flowchart TD
    A[Probabilitas hoaks per kalimat] --> B{P hoaks >= 0,30?}
    B -->|Ya| C[Label kalimat hoax]
    B -->|Tidak| D[Label kalimat not_hoax]
    C --> E[Majority vote]
    D --> E
    E --> F{Jumlah label seimbang?}
    F -->|Ya| G[Tie ke hoax]
    F -->|Tidak| H[Label mayoritas]
    G --> I[Verdict dokumen]
    H --> I
```

---

## 9. Diagram 8 - Alur BERTopic

```mermaid
flowchart TD
    A[Train pra-oversampling\n17.218 dokumen] --> B[Sentence embedding\nparaphrase-multilingual-MiniLM-L12-v2]
    B --> C[UMAP\nn_neighbors 12, n_components 5, min_dist 0,0]
    C --> D[HDBSCAN\nmin_cluster_size 12, min_samples 2, leaf]
    D --> E[c-TF-IDF\nngram 1-2, min_df 3, max_df 0,75]
    E --> F[Reduksi outlier\nreduce_probabilities threshold 0,10]
    F --> G[Topik final 79]
```

---

## 10. Diagram 9 - Evaluasi BERTopic

```mermaid
flowchart TD
    A[Model BERTopic final] --> B[Coherence c_v\n0,520257]
    A --> C[DBCV sampled\n-0,013278]
    A --> D[Outlier rate\n21,90%]
    A --> E[c-TF-IDF\n790 baris, 720 kata/frasa unik]
    B --> F[Interpretasi kualitas topik]
    C --> F
    D --> F
    E --> F
```

Caption: Diagram ini menunjukkan bahwa evaluasi BERTopic tidak hanya bergantung pada satu metrik. DBCV negatif tipis dibaca bersama coherence, outlier rate, dan c-TF-IDF.

---

## 11. Diagram 10 - Alur Inferensi Backend

```mermaid
sequenceDiagram
    participant U as Pengguna
    participant FE as Frontend
    participant API as Backend FastAPI
    participant M as IndoBERT
    participant T as BERTopic + Rules

    U->>FE: Input teks berita
    FE->>API: POST /analyze
    API->>API: Segmentasi paragraf dan kalimat
    API->>M: Prediksi per kalimat
    M-->>API: Probabilitas hoax/not_hoax
    API->>API: Threshold 0,30 dan majority vote
    API->>T: Ekstraksi topik
    T-->>API: Topik global/paragraf
    API-->>FE: JSON response
    FE-->>U: Verdict, confidence, highlight, topik
```

Status: Struktur tetap, threshold diperbarui.

---

## 12. Deployment, Use Case, Activity, dan Component

Diagram deployment, use case, activity, dan component tidak perlu diubah secara struktural karena arsitektur sistem tidak berubah. Catatan yang harus disesuaikan hanya angka threshold dan panel evaluasi jika angka tersebut ditulis pada caption atau deskripsi diagram.
