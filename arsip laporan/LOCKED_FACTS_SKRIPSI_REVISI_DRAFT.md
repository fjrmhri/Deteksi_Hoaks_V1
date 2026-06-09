# LOCKED_FACTS_SKRIPSI_REVISI_DRAFT

Dokumen ini adalah draft revisi `LOCKED_FACTS_SKRIPSI.md` setelah perubahan dataset dan training terbaru. Dokumen ini belum mengganti seluruh bab, tetapi menjadi acuan teknis baru untuk proses revisi.

## 1. Aturan Prioritas Sumber Revisi

Jika ada konflik antar sumber, gunakan prioritas berikut:

1. `Final_V4_DBCS.ipynb` terbaru.
2. Artefak terbaru di `public/hasil/`, terutama `inference_config.json`, grafik evaluasi, dan `evaluasi_ctfidf_topik.csv`.
3. `backend/app.py` untuk perilaku runtime API.
4. `public/index.html`, `public/app.js`, dan `public/styles.css` untuk tampilan frontend.
5. `README.md` hanya untuk narasi arsitektur umum karena sebagian angka di README belum sinkron dengan artefak terbaru.
6. Dokumen skripsi lama hanya sebagai target revisi, bukan source angka.

---

## 2. Tabel Fakta Teknis Baru

| Item | Nilai final baru yang dipakai | Sumber/path | Dipakai di BAB | Catatan |
|---|---|---|---|---|
| Judul skripsi | `DETEKSI HOAKS BERITA BERBAHASA INDONESIA BERBASIS FINE-TUNING INDOBERT PADA TINGKAT KALIMAT DAN PEMODELAN TOPIK BERTOPIC` | `Pra Proposal.pdf`, dokumen skripsi lama | Cover, Abstrak, BAB I–V | Tidak berubah. |
| Fokus penelitian | Deteksi hoaks berita berbahasa Indonesia berbasis fine-tuning IndoBERT, inferensi/visualisasi tingkat kalimat runtime, agregasi verdict dokumen, dan BERTopic | Semua dokumen skripsi | BAB I–V | Tidak berubah. |
| Batasan tingkat kalimat | Tingkat kalimat merujuk pada segmentasi, inferensi, visualisasi, dan agregasi runtime | `backend/app.py`, BAB III lama | BAB I, III, IV, V | Jangan klaim dataset training berlabel kalimat eksplisit. |
| Dataset aktual | Kaggle `fjrmhri/dataset-skripsi` | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Berbeda dari dokumen lama yang menyebut dataset dengan data tambahan 2020+. |
| File dataset aktual di notebook | `CNN.csv`, `Detik.csv`, `Kompas.csv`, `TurnBackHoax.csv` | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | `Summarized_2020+.csv` tidak dipakai. |
| Status `Summarized_2020+.csv` | Tidak ditemukan/dipakai dalam notebook terbaru | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Hapus semua narasi `merged_extra`. |
| Total data mentah | 24.675 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Ganti angka lama 173.229. |
| Baris teks kosong dibuang | 0 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Jika tidak perlu, boleh tidak ditampilkan di tabel utama. |
| Label NaN dibuang | 0 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Opsional. |
| Duplikat `(text,label)` dihapus | 77 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Ganti angka lama 1.055. |
| Konflik label | 0 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap 0. |
| Total data bersih | 24.598 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV, Abstrak bila perlu | Ganti 172.174. |
| Distribusi label bersih | `not_hoax = 12.645`; `hoax = 11.953`; rasio hoaks 48,6% | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Dataset relatif seimbang; jangan sebut sangat tidak seimbang. |
| Distribusi sumber | CNN 4.216; Detik 4.213; Kompas 4.216; TurnBackHoax 11.953 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Risiko bias sumber tetap ada. |
| Statistik panjang teks | count 24.598; mean 1.029,0; std 1.172,7; min 1; median 573,5; max 29.140 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Opsional sebagai tabel pendukung. |
| Split data | Stratified random split 70/15/15 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Bukan group split. |
| Ukuran split | Train 17.218; validation 3.690; test 3.690 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Ganti ukuran lama. |
| Train sebelum balancing | label 0 = 8.851; label 1 = 8.367 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Selisih kecil. |
| Teknik balancing | Oversampling kelas minoritas hanya pada training set menggunakan `sklearn.utils.resample` | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Validation/test tidak dibalancing. |
| Train setelah balancing | label 0 = 8.851; label 1 = 8.851; total 17.702 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Oversampling ringan. |
| Corpus BERTopic | Train pra-oversampling sebanyak 17.218 dokumen | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Jangan gunakan train setelah balancing untuk corpus BERTopic. |
| Model klasifikasi dasar | `indolem/indobert-base-uncased` | Notebook, `public/hasil/inference_config.json` | BAB II, BAB III, BAB IV | Tetap. |
| Model klasifikasi runtime | `fjrmhri/deteksi_hoaks_indobert` | `backend/app.py` | BAB III, BAB IV | Tetap. |
| Tokenizer | `AutoTokenizer` dari model IndoBERT/fine-tuned model | Notebook, `backend/app.py` | BAB III, BAB IV | Tetap. |
| Label klasifikasi | `not_hoax = 0`, `hoax = 1` | Notebook, `inference_config.json`, `backend/app.py` | BAB III, BAB IV | Tetap. |
| Tokenisasi | truncation aktif, `max_length = 256` | Notebook, `inference_config.json`, `backend/app.py` | BAB III, BAB IV | Tetap. |
| Batch train per device | 96 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Batch evaluasi per device | 384 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Gradient accumulation | 2 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Effective batch 192. |
| Learning rate | 2e-5 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Weight decay | 0,01 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Epoch | 3 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Scheduler | linear | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Warmup ratio | 0,06 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Seed | 42 | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Tetap. |
| Metric for best model | F1 | Notebook, `inference_config.json` | BAB III, BAB IV | Tetap. |
| Library runtime eksperimen | PyTorch `2.10.0+cu128`, Transformers `5.0.0` | Notebook, `inference_config.json` | BAB IV | Tetap versi, tanggal berubah. |
| Training date | 2026-05-14 | Notebook, `inference_config.json`, `public/index.html` | BAB IV, Abstrak bila perlu | Ganti tanggal lama. |
| Checkpoint terbaik | `indobert_hoax_model_v3/checkpoint-186` | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Ganti `checkpoint-3507`. |
| Threshold default | 0,50 | Notebook, `inference_config.json` | BAB III, BAB IV | Tetap. |
| Threshold optimal/runtime | 0,30 | Notebook, `inference_config.json`, `backend/app.py`, `public/index.html` | BAB III, BAB IV, Abstrak, BAB V, Diagram | Ganti 0,34. |
| Metrik validation default | Accuracy 0,995393; Precision hoax 0,998876; Recall hoax 0,991634; F1 hoax 0,995242; Weighted F1 0,995392; AUC 0,999804 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Default/argmax. |
| Metrik test default | Accuracy 0,996748; Precision hoax 0,999439; Recall hoax 0,993865; F1 hoax 0,996644; Weighted F1 0,996748; AUC 0,999817 | `Final_V4_DBCS.ipynb` terbaru | BAB IV, Abstrak, BAB V | Gunakan sebagai metrik evaluasi utama atau jelaskan bersama threshold runtime. |
| Validation @ threshold 0,30 | Accuracy 0,995935; Precision 0,998878; Recall 0,992750; F1 0,995804; AUC 0,999804; TP 1780; FP 2; FN 13; TN 1895 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Metrik runtime threshold. |
| Test @ threshold 0,30 | Accuracy 0,996748; Precision 0,998880; Recall 0,994423; F1 0,996646; AUC 0,999817; TP 1783; FP 2; FN 10; TN 1895 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Metrik runtime threshold. |
| BERTopic embedding | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Notebook, `backend/app.py` | BAB III, BAB IV | Tetap. |
| UMAP | n_neighbors 12; n_components 5; min_dist 0,0; metric cosine | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Ganti parameter lama. |
| HDBSCAN | min_cluster_size 12; min_samples 2; metric euclidean; cluster_selection_method leaf | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Ganti parameter lama. |
| CountVectorizer/c-TF-IDF | ngram 1–2; min_df 3; max_df 0,75; max_features 20.000; stopwords khusus BERTopic | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Ganti parameter lama. |
| Guided topic modeling | Tidak aktif (`AKTIFKAN_GUIDED = False`) | `Final_V4_DBCS.ipynb` terbaru | BAB III, BAB IV | Jangan klaim guided topic modeling dipakai. |
| Strategi final outlier | `reduce_probabilities`, threshold 0,10 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Jelaskan sebagai konfigurasi final. |
| Total dokumen BERTopic | 17.218 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Ganti 120.521. |
| Jumlah topik final non-outlier | 79 | Notebook, `public/index.html` | BAB IV, BAB V, Abstrak bila perlu | Ganti 75. |
| Jumlah topik utama | 79 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Ganti lama. |
| Dokumen outlier | 3.771 | Notebook, `public/index.html` | BAB IV | Ganti 48.115. |
| Outlier rate | 21,90% | Notebook, `public/index.html` | BAB IV, BAB V, Abstrak | Ganti 39,92%. |
| Topik terbesar | 0 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Dokumen topik terbesar 2.787. |
| DBCV | -0,013278 | Notebook, `public/index.html` | BAB IV, BAB V, Abstrak | DBCV negatif tipis; jangan klaim kuat secara absolut. |
| DBCV mode | sampled | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Titik 3.000, cluster 79. |
| HDBSCAN relative validity | 0,218550 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Tambahan jika dibahas. |
| Coherence c_v | 0,520257 | Notebook, `public/index.html` | BAB IV, BAB V, Abstrak | Ganti 0,439093. |
| Coherence docs/topics | 8.000 dokumen; 79 topik | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Tambahan evaluasi. |
| c-TF-IDF CSV | `public/hasil/evaluasi_ctfidf_topik.csv` | Notebook, repo | BAB IV | Tetap file, isi berubah. |
| c-TF-IDF rows/columns | 790 baris; 9 kolom | Notebook, CSV | BAB IV | Ganti 750 baris. |
| Kata/frasa unik | 720 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Ganti angka lama. |
| Topic exclusivity | 0,913889 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Tambahan interpretasi c-TF-IDF. |
| Category exclusivity | 0,945833 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Tambahan interpretasi c-TF-IDF. |
| Keyword coverage | 0,069279 | `Final_V4_DBCS.ipynb` terbaru | BAB IV | Coverage rendah; interpretasi hati-hati. |
| Backend framework | FastAPI | `backend/app.py` | BAB III, BAB IV | Tetap. |
| Endpoint runtime | GET `/`, GET `/health`, POST `/predict`, POST `/predict-batch`, POST `/analyze` | `backend/app.py` | BAB III, BAB IV | `POST /analyze` tetap endpoint utama. |
| Segmentasi paragraf backend | Regex blank line; fallback line-based jika perlu | `backend/app.py` | BAB III, BAB IV | Tetap. |
| Segmentasi kalimat backend | Regex berbasis tanda akhir `.`, `!`, `?` | `backend/app.py` | BAB III, BAB IV | Tetap. |
| Agregasi verdict | Majority vote per kalimat, tie ke `hoax` | `backend/app.py` | BAB III, BAB IV, BAB V | Tetap. |
| Topik runtime | Rule-based category, fallback BERTopic, fallback `Topik Umum` | `backend/app.py` | BAB III, BAB IV | Tetap. |
| Frontend | HTML/CSS/JavaScript vanilla di `public/` | `public/index.html`, `public/app.js` | BAB III, BAB IV | Tetap. |
| Frontend API default | `https://fjrmhri-ta-final-space.hf.space` | `public/app.js` | BAB III, BAB IV | Tetap. |
| Confidence cutoff UI | 0,65 | `public/app.js` | BAB IV | Oranye jika confidence < 65%. |
| Panel metrik frontend | Accuracy 99,67%; F1 Hoaks 99,66%; AUC 99,98%; Precision 99,89%; Recall 99,44%; Weighted F1 99,67%; Coherence 0,5203; DBCV -0,0133; Outlier 21,90%; Topik final 79 | `public/index.html` | BAB IV, screenshot | Screenshot panel harus diperbarui. |
| Deployment backend | Hugging Face Spaces/FastAPI | `README.md`, `public/app.js`, `backend/Dockerfile` | BAB III, BAB IV | Tidak berubah. |
| Deployment frontend | Vercel static frontend | `README.md`, `package.json`, `vercel.json` | BAB III, BAB IV | Tidak berubah. |
| Klaim terlarang | Tidak ada evidence retrieval, bukan verifikasi fakta absolut, bukan group split, bukan dataset training berlabel kalimat eksplisit | Semua dokumen revisi | Semua BAB | Tetap wajib dijaga. |

---

## 3. Narasi Aman Revisi

### Tingkat kalimat

> Istilah tingkat kalimat pada penelitian ini merujuk pada proses segmentasi, inferensi, visualisasi, dan agregasi hasil prediksi pada saat sistem berjalan. Penelitian ini tidak mengklaim bahwa dataset pelatihan merupakan dataset berlabel kalimat eksplisit.

### Split data

> Dataset dibagi menggunakan stratified random split dengan proporsi 70% training, 15% validation, dan 15% test. Penelitian ini tidak menggunakan group split berbasis artikel atau sumber.

### Balancing

> Penanganan perbedaan jumlah kelas dilakukan menggunakan oversampling ringan hanya pada training set. Validation set dan test set tidak di-oversampling agar evaluasi tetap dilakukan pada distribusi data asli.

### Dataset terbaru

> Dataset terbaru hanya menggunakan empat sumber utama, yaitu CNN, Detik, Kompas, dan TurnBackHoax. Data tambahan `Summarized_2020+.csv` tidak digunakan pada eksperimen terbaru.

### BERTopic dan DBCV

> BERTopic digunakan sebagai pendukung interpretabilitas topik, bukan sebagai penentu label hoaks. Nilai DBCV sampled sebesar -0,013278 perlu dibaca hati-hati karena menunjukkan struktur cluster berbasis densitas belum ideal secara absolut, meskipun konfigurasi final dipilih sebagai kompromi terbaik berdasarkan coherence, outlier rate, dan interpretasi c-TF-IDF.

### Keluaran sistem

> Sistem menghasilkan prediksi berbasis model berupa verdict dokumen, confidence, highlight kalimat/paragraf, topik global, dan topik per paragraf. Sistem tidak melakukan evidence retrieval atau verifikasi fakta absolut terhadap sumber eksternal.
