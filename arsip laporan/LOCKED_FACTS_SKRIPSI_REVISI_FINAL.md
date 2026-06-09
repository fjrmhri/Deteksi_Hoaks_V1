# LOCKED_FACTS_SKRIPSI_REVISI_FINAL

Dokumen ini mengunci fakta teknis final untuk penulisan skripsi berjudul:

**DETEKSI HOAKS BERITA BERBAHASA INDONESIA BERBASIS FINE-TUNING INDOBERT PADA TINGKAT KALIMAT DAN PEMODELAN TOPIK BERTOPIC**

Dokumen ini menggantikan `LOCKED_FACTS_SKRIPSI.md` lama. Semua dokumen skripsi setelah revisi harus mengikuti nilai pada dokumen ini.

---

## 1. Aturan Prioritas Sumber

Jika terdapat konflik antar sumber, gunakan prioritas berikut.

1. `Final_V4_DBCS.ipynb` terbaru sebagai sumber utama eksperimen.
2. Artefak terbaru di `public/hasil/`, terutama:
   - `public/hasil/inference_config.json`
   - `public/hasil/evaluasi_ctfidf_topik.csv`
   - grafik evaluasi model dan topic modeling.
3. `backend/app.py` untuk perilaku runtime API, segmentasi, threshold, agregasi, dan topik.
4. `public/index.html`, `public/app.js`, dan `public/styles.css` untuk perilaku frontend dan angka panel evaluasi.
5. `README.md` hanya untuk narasi arsitektur umum jika tidak bertentangan dengan notebook, `public/hasil/`, `inference_config.json`, dan `backend/app.py`.
6. `BUKU PEDOMAN TUGAS AKHIR.pdf` untuk struktur, format, tabel, gambar, abstrak, dan tata tulis.
7. `Pra Proposal.pdf` untuk konteks awal, latar belakang, dan posisi penelitian, bukan angka eksperimen final.
8. Dokumen lama BAB I–V, Abstrak, Blueprint, Diagram, dan Audit lama hanya digunakan sebagai target revisi.

---

## 2. Fakta Teknis Final

| Item | Nilai Final | Sumber/Path | Catatan Pemakaian |
|---|---|---|---|
| Judul skripsi | `DETEKSI HOAKS BERITA BERBAHASA INDONESIA BERBASIS FINE-TUNING INDOBERT PADA TINGKAT KALIMAT DAN PEMODELAN TOPIK BERTOPIC` | `Pra Proposal.pdf`, dokumen skripsi | Gunakan kapital pada cover dan dokumen formal. |
| Fokus penelitian | Deteksi hoaks berita berbahasa Indonesia berbasis fine-tuning IndoBERT, inferensi/visualisasi tingkat kalimat runtime, agregasi verdict dokumen, dan pemodelan topik BERTopic | Naskah skripsi dan repository | Tidak memuat verifikasi fakta absolut. |
| Dataset aktual | Kaggle `fjrmhri/dataset-skripsi` | `Final_V4_DBCS.ipynb` | Dataset lama dengan data tambahan tidak digunakan. |
| File dataset aktual | `CNN.csv`, `Detik.csv`, `Kompas.csv`, `TurnBackHoax.csv` | `Final_V4_DBCS.ipynb` | `Summarized_2020+.csv` tidak dipakai. |
| Total data mentah | 24.675 | `Final_V4_DBCS.ipynb` | Sebelum pembersihan. |
| Baris teks kosong dibuang | 0 | `Final_V4_DBCS.ipynb` | Tidak ada teks kosong yang terhapus. |
| Label NaN dibuang | 0 | `Final_V4_DBCS.ipynb` | Tidak ada label NaN yang terhapus. |
| Duplikat `(text,label)` dihapus | 77 | `Final_V4_DBCS.ipynb` | Deduplikasi pasangan teks dan label. |
| Konflik label | 0 | `Final_V4_DBCS.ipynb` | Tidak ditemukan teks sama dengan label berbeda. |
| Total data bersih | 24.598 | `Final_V4_DBCS.ipynb` | Dipakai untuk split. |
| Distribusi label | `not_hoax = 12.645`, `hoax = 11.953`, rasio hoaks 48,6% | `Final_V4_DBCS.ipynb` | Dataset relatif seimbang. |
| Distribusi sumber | CNN 4.216; Detik 4.213; Kompas 4.216; TurnBackHoax 11.953 | `Final_V4_DBCS.ipynb` | Risiko bias sumber tetap dibahas. |
| Statistik panjang teks | count 24.598; mean 1.029,0; std 1.172,7; min 1; median 573,5; max 29.140 | `Final_V4_DBCS.ipynb` | Opsional untuk tabel pendukung BAB IV. |
| Split | Stratified random split 70/15/15 | `Final_V4_DBCS.ipynb` | Bukan group split berbasis artikel/sumber. |
| Train | 17.218 | `Final_V4_DBCS.ipynb` | Sebelum balancing. |
| Validation | 3.690 | `Final_V4_DBCS.ipynb` | Tidak dibalancing. |
| Test | 3.690 | `Final_V4_DBCS.ipynb` | Tidak dibalancing. |
| Train sebelum balancing | label 0 = 8.851; label 1 = 8.367 | `Final_V4_DBCS.ipynb` | Selisih kelas kecil. |
| Teknik balancing | Oversampling kelas minoritas hanya pada training set menggunakan `sklearn.utils.resample` | `Final_V4_DBCS.ipynb` | Validation dan test tidak di-oversampling. |
| Train setelah balancing | label 0 = 8.851; label 1 = 8.851; total 17.702 | `Final_V4_DBCS.ipynb` | Oversampling ringan. |
| Corpus BERTopic | 17.218 dokumen train pra-oversampling | `Final_V4_DBCS.ipynb` | Tidak memakai data hasil oversampling. |
| Model dasar IndoBERT | `indolem/indobert-base-uncased` | Notebook dan `inference_config.json` | Model dasar fine-tuning. |
| Model runtime | `fjrmhri/deteksi_hoaks_indobert` | `backend/app.py` | Dimuat dari Hugging Face Hub. |
| Tokenizer | `AutoTokenizer` dari model IndoBERT/fine-tuned model | Notebook dan `backend/app.py` | Tidak menyebut tokenizer lain. |
| Label klasifikasi | `not_hoax = 0`, `hoax = 1` | Notebook, config, backend | `hoax` adalah label positif. |
| Max length | 256 | Notebook dan config | Dipakai pada training dan runtime. |
| Batch train per device | 96 | Notebook | Konfigurasi training. |
| Batch evaluasi per device | 384 | Notebook | Konfigurasi evaluasi. |
| Gradient accumulation | 2 | Notebook | Effective batch size 192. |
| Effective batch size | 192 | Notebook | 96 x 2. |
| Learning rate | 2e-5 | Notebook | Konfigurasi training. |
| Weight decay | 0,01 | Notebook | Konfigurasi training. |
| Epoch | 3 | Notebook | Konfigurasi training. |
| Scheduler | linear | Notebook | Konfigurasi training. |
| Warmup ratio | 0,06 | Notebook | Konfigurasi training. |
| Seed | 42 | Notebook | Reprodusibilitas eksperimen. |
| Metric for best model | F1 | Notebook dan config | Model terbaik dipilih berdasarkan F1. |
| Training date | 2026-05-14 | Notebook, config, frontend | Ditulis 14 Mei 2026 dalam naskah. |
| Checkpoint terbaik | `indobert_hoax_model_v3/checkpoint-186` | Notebook | Checkpoint eksperimen lokal. |
| Threshold default | 0,50 | Notebook dan config | Pembanding default. |
| Threshold optimal/runtime | 0,30 | Notebook, config, backend, frontend | Threshold yang dipakai sistem runtime. |
| Validation default | Accuracy 0,995393; Precision hoax 0,998876; Recall hoax 0,991634; F1 hoax 0,995242; Weighted F1 0,995392; AUC 0,999804 | Notebook | Metrik default/argmax. |
| Test default | Accuracy 0,996748; Precision hoax 0,999439; Recall hoax 0,993865; F1 hoax 0,996644; Weighted F1 0,996748; AUC 0,999817 | Notebook | Metrik default/argmax. |
| Validation @0,30 | Accuracy 0,995935; Precision hoax 0,998878; Recall hoax 0,992750; F1 hoax 0,995804; AUC 0,999804; TP 1.780; FP 2; FN 13; TN 1.895 | Notebook | Metrik threshold runtime pada validation. |
| Test @0,30 | Accuracy 0,996748; Precision hoax 0,998880; Recall hoax 0,994423; F1 hoax 0,996646; AUC 0,999817; TP 1.783; FP 2; FN 10; TN 1.895 | Notebook | Metrik threshold runtime pada test. |
| Embedding BERTopic | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Notebook dan backend | Embedding untuk dokumen/topik. |
| UMAP | n_neighbors 12; n_components 5; min_dist 0,0; metric cosine | Notebook | Reduksi dimensi BERTopic. |
| HDBSCAN | min_cluster_size 12; min_samples 2; metric euclidean; cluster_selection_method leaf | Notebook | Clustering BERTopic. |
| CountVectorizer/c-TF-IDF | ngram 1–2; min_df 3; max_df 0,75; max_features 20.000; stopwords khusus BERTopic | Notebook | Ekstraksi kata/frasa topik. |
| Guided topic modeling | Tidak aktif (`AKTIFKAN_GUIDED = False`) | Notebook | Jangan klaim guided topic modeling aktif. |
| Strategi final outlier | `reduce_probabilities`, threshold 0,10 | Notebook | Strategi final BERTopic. |
| Total dokumen BERTopic | 17.218 | Notebook | Train pra-oversampling. |
| Topik final non-outlier | 79 | Notebook dan frontend | Topik final yang dipakai. |
| Jumlah outlier | 3.771 | Notebook dan frontend | Dokumen berlabel outlier. |
| Outlier rate | 21,90% | Notebook dan frontend | Metrik evaluasi BERTopic. |
| Topik terbesar | 0 | Notebook | Dokumen topik terbesar 2.787. |
| Dokumen topik terbesar | 2.787 | Notebook | Setara 16,19% dari corpus. |
| DBCV sampled | -0,013278 | Notebook dan frontend | Dibaca hati-hati; negatif tipis. |
| DBCV titik dipakai | 3.000 | Notebook | Mode sampled. |
| DBCV cluster dipakai | 79 | Notebook | Topik non-outlier. |
| HDBSCAN relative validity | 0,218550 | Notebook | Metrik tambahan clustering. |
| Coherence c_v | 0,520257 | Notebook dan frontend | Evaluasi keterkaitan kata topik. |
| Coherence dokumen/topik | 8.000 dokumen; 79 topik | Notebook | Sampel coherence. |
| c-TF-IDF file | `public/hasil/evaluasi_ctfidf_topik.csv` | Repository | Sumber analisis kata/frasa topik. |
| c-TF-IDF rows/columns | 790 baris; 9 kolom | Notebook dan CSV | 10 kata untuk tiap 79 topik. |
| Kata/frasa unik | 720 | Notebook | Analisis diskriminasi topik. |
| Kata eksklusif topik | 658 | Notebook | Topic exclusivity 0,913889. |
| Topic exclusivity | 0,913889 | Notebook | Proporsi kata/frasa eksklusif per topik. |
| Kata eksklusif kategori | 681 | Notebook | Category exclusivity 0,945833. |
| Category exclusivity | 0,945833 | Notebook | Proporsi kata/frasa eksklusif kategori. |
| Topik dengan keyword hit | 76 | Notebook | Topik yang punya keyword kategori. |
| Rata-rata coverage keyword | 0,069279 | Notebook | Coverage rendah; interpretasi hati-hati. |
| Backend | FastAPI | `backend/app.py` | Backend inference. |
| Endpoint utama | `POST /analyze` | `backend/app.py` | Endpoint analisis multi-paragraf. |
| Endpoint tambahan | GET `/`; GET `/health`; POST `/predict`; POST `/predict-batch` | `backend/app.py` | Endpoint pendukung. |
| Segmentasi paragraf | Regex blank line, fallback line-based jika perlu | `backend/app.py` | Runtime API. |
| Segmentasi kalimat | Regex berbasis tanda akhir `.`, `!`, `?` | `backend/app.py` | Runtime API. |
| Agregasi verdict | Majority vote per kalimat, tie ke `hoax` | `backend/app.py` | Bukan satu kalimat ekstrem. |
| Topik runtime | Rule-based category, fallback BERTopic, fallback `Topik Umum` | `backend/app.py` | Strategi hibrida. |
| Frontend | HTML/CSS/JavaScript vanilla di `public/` | `public/` | Tanpa framework frontend. |
| Frontend API default | `https://fjrmhri-ta-final-space.hf.space` | `public/app.js` | Bisa dioverride via query string. |
| Confidence cutoff UI | 0,65 | `public/app.js` | Unit dengan confidence rendah ditandai ragu/oranye. |
| Panel metrik frontend | Accuracy test 99,67%; F1 hoaks 99,66%; AUC-ROC 99,98%; Precision hoaks 99,89%; Recall hoaks 99,44%; Weighted F1 test 99,67%; Threshold 0,30; Training date 14 Mei 2026; Coherence 0,5203; DBCV -0,0133; Outlier rate 21,90%; Topik final 79 | `public/index.html` | Screenshot harus sesuai angka ini. |

---

## 3. Narasi Aman untuk Naskah

### 3.1 Tingkat Kalimat

Istilah “tingkat kalimat” dalam penelitian ini merujuk pada proses segmentasi, inferensi, visualisasi, dan agregasi hasil prediksi pada saat sistem berjalan. Dataset pelatihan tidak diklaim sebagai dataset berlabel kalimat eksplisit.

### 3.2 Split Data

Dataset dibagi menggunakan stratified random split dengan proporsi 70% training, 15% validation, dan 15% test. Penelitian ini tidak menggunakan group split berbasis artikel, domain, atau sumber.

### 3.3 Balancing

Dataset bersih relatif seimbang dengan rasio hoaks 48,6%. Oversampling tetap digunakan secara ringan hanya pada training set untuk menyamakan jumlah label `hoax` dan `not_hoax`. Validation set dan test set tidak di-oversampling.

### 3.4 BERTopic dan DBCV

BERTopic digunakan sebagai pendukung interpretabilitas topik, bukan sebagai penentu label hoaks. Nilai DBCV sampled sebesar -0,013278 menunjukkan struktur cluster berbasis densitas belum ideal secara absolut, sehingga hasil topik dibaca bersama coherence c_v, outlier rate, c-TF-IDF, dan inspeksi kata/frasa topik.

### 3.5 Output Sistem

Sistem menghasilkan prediksi berbasis model berupa verdict dokumen, confidence, highlight kalimat/paragraf, topik global, dan topik per paragraf. Sistem bukan verifikasi fakta absolut dan tidak melakukan evidence retrieval terhadap sumber eksternal.

---

## 4. Klaim Terlarang

Klaim berikut tidak boleh muncul dalam naskah final.

1. Dataset training berlabel kalimat eksplisit.
2. Group split berbasis artikel, sumber, atau domain.
3. Evidence retrieval atau pencarian bukti eksternal.
4. Sistem sebagai verifikasi fakta absolut.
5. BERTopic sebagai penentu label hoaks.
6. Guided topic modeling aktif.
7. `Summarized_2020+.csv` digunakan pada eksperimen terbaru.
8. Dataset sangat tidak seimbang.
9. Backend menggunakan database, message broker, atau sistem antrian.
10. Metrik lama dipakai sebagai angka final.
