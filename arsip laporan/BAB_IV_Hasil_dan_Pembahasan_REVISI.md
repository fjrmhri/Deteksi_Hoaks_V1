# BAB IV
# HASIL DAN PEMBAHASAN

Bab ini menyajikan hasil implementasi dan pembahasan sistem deteksi hoaks berita berbahasa Indonesia berbasis fine-tuning IndoBERT, inferensi dan visualisasi pada tingkat kalimat, serta pemodelan topik BERTopic. Pembahasan disusun berdasarkan hasil eksperimen model, artefak evaluasi, implementasi backend FastAPI, implementasi frontend web, dan rancangan pengujian fungsional sistem.

Hasil pada bab ini perlu dibaca dengan batasan metodologis berikut. Pertama, istilah tingkat kalimat merujuk pada segmentasi, inferensi, visualisasi, dan agregasi prediksi pada sistem, bukan klaim bahwa dataset pelatihan memiliki label eksplisit pada tingkat kalimat. Kedua, pembagian data yang terverifikasi adalah stratified random split dengan proporsi 70% training, 15% validation, dan 15% test. Penelitian ini tidak mengklaim penggunaan group split berbasis artikel atau sumber. Ketiga, sistem tidak melakukan evidence retrieval, sehingga keluaran sistem merupakan hasil klasifikasi model dan pemodelan topik, bukan verifikasi fakta berbasis bukti eksternal.

## 4.1 Implementasi Dataset dan Praproses

Dataset yang digunakan pada penelitian ini merupakan dataset berita berbahasa Indonesia dari Kaggle dengan identitas `fjrmhri/dataset-skripsi`. Dataset terdiri atas empat file CSV, yaitu `CNN.csv`, `Detik.csv`, `Kompas.csv`, dan `TurnBackHoax.csv`. File `Summarized_2020+.csv` tidak digunakan pada eksperimen terbaru. Penghapusan data tambahan membuat dataset lebih kecil, tetapi sumber data menjadi lebih mudah dipertanggungjawabkan.

Tahap praproses dilakukan untuk membentuk kolom teks utama dan label biner yang konsisten. Data dengan teks kosong dan label NaN diperiksa, label dikonversi menjadi `not_hoax = 0` dan `hoax = 1`, duplikasi pasangan `(text,label)` dihapus, dan konflik label diperiksa.

**Tabel 4.1 Hasil Preprocessing Dataset**

| Tahap | Hasil |
|---|---:|
| Total data mentah | 24.675 |
| Baris teks kosong dibuang | 0 |
| Label NaN dibuang | 0 |
| Duplikat `(text,label)` yang dihapus | 77 |
| Konflik label | 0 |
| Total data bersih | 24.598 |
| Teknik yang tidak diklaim | Stemming, lemmatization, normalisasi agresif, evidence retrieval |

Distribusi label data bersih ditunjukkan pada Tabel 4.2.

**Tabel 4.2 Distribusi Label Data Bersih**

| Label | Kode Label | Jumlah Data | Persentase |
|---|---:|---:|---:|
| `not_hoax` | 0 | 12.645 | 51,4% |
| `hoax` | 1 | 11.953 | 48,6% |
| **Total** | - | **24.598** | **100%** |

Distribusi tersebut menunjukkan bahwa dataset bersih relatif seimbang. Dengan demikian, oversampling pada eksperimen terbaru tidak lagi bersifat ekstrem, tetapi tetap dilakukan secara ringan pada training set untuk menyamakan jumlah kelas.

**Tabel 4.3 Distribusi Sumber Data**

| Sumber | Label Dominan | Jumlah Data |
|---|---|---:|
| CNN | `not_hoax` | 4.216 |
| Detik | `not_hoax` | 4.213 |
| Kompas | `not_hoax` | 4.216 |
| TurnBackHoax | `hoax` | 11.953 |
| **Total** | - | **24.598** |

Meskipun label relatif seimbang, risiko bias sumber tetap ada karena data `not_hoax` berasal dari portal berita, sedangkan data `hoax` berasal dari TurnBackHoax.

**Tabel 4.4 Statistik Panjang Teks**

| Statistik | Nilai |
|---|---:|
| Count | 24.598 |
| Mean | 1.029,0 |
| Std | 1.172,7 |
| Min | 1 |
| Median | 573,5 |
| Max | 29.140 |

Pembagian dataset dilakukan menggunakan stratified random split dengan proporsi 70% training, 15% validation, dan 15% test.

**Tabel 4.5 Split Train/Validation/Test**

| Subset | Proporsi | Jumlah Data | Keterangan |
|---|---:|---:|---|
| Training | 70% | 17.218 | Pelatihan IndoBERT dan corpus awal BERTopic sebelum oversampling |
| Validation | 15% | 3.690 | Evaluasi validation dan kalibrasi threshold |
| Test | 15% | 3.690 | Evaluasi akhir model |
| **Total** | **100%** | **24.598** | Data bersih |

**Tabel 4.6 Balancing Training Set**

| Kondisi | Label 0 `not_hoax` | Label 1 `hoax` | Total |
|---|---:|---:|---:|
| Sebelum balancing | 8.851 | 8.367 | 17.218 |
| Setelah balancing | 8.851 | 8.851 | 17.702 |

Oversampling dilakukan hanya pada training set menggunakan `sklearn.utils.resample`. Validation set dan test set tidak dibalancing agar evaluasi tidak terpengaruh penggandaan data.

**Gambar 4.1 Distribusi dataset**

![Gambar 4.1 Distribusi dataset](public/hasil/distribusi_dataset.png)

*Sumber: `public/hasil/distribusi_dataset.png`.*

## 4.2 Implementasi Fine-Tuning IndoBERT

Model klasifikasi yang digunakan adalah `indolem/indobert-base-uncased`. Model tersebut di-*fine-tune* untuk tugas klasifikasi biner dengan label `not_hoax` dan `hoax`. Pada tahap runtime sistem web, model yang digunakan backend dimuat dari Hugging Face Hub dengan identitas `fjrmhri/deteksi_hoaks_indobert`.

Tokenisasi dilakukan menggunakan tokenizer dari keluarga IndoBERT. Panjang maksimum input ditetapkan sebesar 256 token dengan truncation aktif. Fitur yang digunakan oleh model meliputi `input_ids`, `attention_mask`, dan `label`.

**Tabel 4.7 Konfigurasi Training IndoBERT**

| Parameter | Nilai |
|---|---|
| Model dasar | `indolem/indobert-base-uncased` |
| Model runtime | `fjrmhri/deteksi_hoaks_indobert` |
| Label klasifikasi | `not_hoax = 0`, `hoax = 1` |
| Max length | 256 |
| Batch train per device | 96 |
| Batch evaluasi per device | 384 |
| Gradient accumulation | 2 |
| Effective batch size | 192 |
| Learning rate | 2e-5 |
| Weight decay | 0,01 |
| Epoch | 3 |
| Scheduler | linear |
| Warmup ratio | 0,06 |
| Seed | 42 |
| Metric for best model | F1 |
| Runtime eksperimen | PyTorch `2.10.0+cu128`, Transformers `5.0.0` |
| Tanggal training | 14 Mei 2026 |
| Checkpoint terbaik | `indobert_hoax_model_v3/checkpoint-186` |

Konfigurasi tersebut menunjukkan bahwa pelatihan dilakukan dengan batch efektif 192, learning rate 2e-5, weight decay 0,01, dan tiga epoch. Checkpoint terbaik dipilih berdasarkan metrik F1.

**Gambar 4.2 Kurva training**

![Gambar 4.2 Kurva training](public/hasil/kurva_training.png)

*Sumber: `public/hasil/kurva_training.png`.*

## 4.3 Hasil Evaluasi IndoBERT

Evaluasi IndoBERT dilakukan pada validation set dan test set. Metrik yang digunakan meliputi accuracy, precision kelas hoaks, recall kelas hoaks, F1-score kelas hoaks, weighted F1, dan AUC. Kelas `hoax` diperlakukan sebagai kelas positif.

**Tabel 4.8 Metrik Validation IndoBERT Default**

| Metrik | Nilai |
|---|---:|
| Accuracy | 0,995393 |
| Precision hoax | 0,998876 |
| Recall hoax | 0,991634 |
| F1 hoax | 0,995242 |
| Weighted F1 | 0,995392 |
| AUC | 0,999804 |

**Tabel 4.9 Metrik Test IndoBERT Default**

| Metrik | Nilai |
|---|---:|
| Accuracy | 0,996748 |
| Precision hoax | 0,999439 |
| Recall hoax | 0,993865 |
| F1 hoax | 0,996644 |
| Weighted F1 | 0,996748 |
| AUC | 0,999817 |

Hasil evaluasi menunjukkan performa klasifikasi yang tinggi pada validation set dan test set. Namun, hasil ini tetap perlu dibaca hati-hati karena dataset memiliki risiko bias sumber dan pembagian data menggunakan stratified random split, bukan group split berbasis artikel atau sumber.

**Gambar 4.3 Confusion matrix validation**

![Gambar 4.3 Confusion matrix validation](public/hasil/confusion_matrix_validation.png)

**Gambar 4.4 Confusion matrix test**

![Gambar 4.4 Confusion matrix test](public/hasil/confusion_matrix_test.png)

**Gambar 4.5 ROC curve validation**

![Gambar 4.5 ROC curve validation](public/hasil/roc_curve_validation.png)

**Gambar 4.6 ROC curve test**

![Gambar 4.6 ROC curve test](public/hasil/roc_curve_test.png)

## 4.4 Kalibrasi Threshold

Threshold default klasifikasi biner adalah 0,50. Pada penelitian ini, threshold dikalibrasi pada validation set dan menghasilkan threshold optimal/runtime sebesar 0,30. Threshold ini digunakan oleh sistem web saat inferensi.

**Tabel 4.10 Evaluasi Threshold Optimal pada Validation Set**

| Metrik | Nilai |
|---|---:|
| Threshold | 0,30 |
| Accuracy | 0,995935 |
| Precision hoax | 0,998878 |
| Recall hoax | 0,992750 |
| F1 hoax | 0,995804 |
| AUC | 0,999804 |
| TP | 1.780 |
| FP | 2 |
| FN | 13 |
| TN | 1.895 |

**Tabel 4.11 Evaluasi Threshold Optimal pada Test Set**

| Metrik | Nilai |
|---|---:|
| Threshold | 0,30 |
| Accuracy | 0,996748 |
| Precision hoax | 0,998880 |
| Recall hoax | 0,994423 |
| F1 hoax | 0,996646 |
| AUC | 0,999817 |
| TP | 1.783 |
| FP | 2 |
| FN | 10 |
| TN | 1.895 |

Pemilihan threshold dilakukan berdasarkan validation set. Test set digunakan untuk membaca generalisasi dari konfigurasi yang telah dipilih. Pada threshold runtime 0,30, recall hoaks pada test set meningkat dibanding konfigurasi default, sedangkan precision tetap sangat tinggi.

**Gambar 4.7 Kalibrasi threshold validation**

![Gambar 4.7 Kalibrasi threshold validation](public/hasil/kalibrasi_threshold_validation.png)

## 4.5 Implementasi Pemodelan Topik BERTopic

BERTopic digunakan untuk mendukung interpretabilitas topik, bukan untuk menentukan label hoaks. Corpus BERTopic menggunakan train pra-oversampling sebanyak 17.218 dokumen agar struktur topik tidak dipengaruhi duplikasi data hasil oversampling.

**Tabel 4.12 Konfigurasi BERTopic**

| Komponen | Nilai |
|---|---|
| Corpus | 17.218 dokumen train pra-oversampling |
| Embedding model | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| UMAP | n_neighbors 12; n_components 5; min_dist 0,0; metric cosine |
| HDBSCAN | min_cluster_size 12; min_samples 2; metric euclidean; cluster_selection_method leaf |
| CountVectorizer/c-TF-IDF | ngram 1–2; min_df 3; max_df 0,75; max_features 20.000; stopwords khusus BERTopic |
| Guided topic modeling | Tidak aktif (`AKTIFKAN_GUIDED = False`) |
| Strategi final outlier | `reduce_probabilities`, threshold 0,10 |

Model topik runtime menggunakan strategi hibrida, yaitu rule-based category, fallback BERTopic, dan fallback akhir `Topik Umum`.

## 4.6 Evaluasi BERTopic

Evaluasi BERTopic dilakukan menggunakan coherence c_v, DBCV, outlier rate, HDBSCAN relative validity, dan inspeksi c-TF-IDF.

**Tabel 4.13 Evaluasi BERTopic**

| Metrik | Nilai |
|---|---:|
| Total dokumen BERTopic | 17.218 |
| Topik final non-outlier | 79 |
| Jumlah topik utama | 79 |
| Jumlah outlier | 3.771 |
| Outlier rate | 21,90% |
| Topik terbesar | 0 |
| Dokumen topik terbesar | 2.787 |
| Persentase topik terbesar | 16,19% |
| DBCV sampled | -0,013278 |
| DBCV titik dipakai | 3.000 |
| DBCV cluster dipakai | 79 |
| HDBSCAN relative validity | 0,218550 |
| Coherence c_v | 0,520257 |
| Coherence dokumen dipakai | 8.000 |
| Coherence topik dipakai | 79 |

Nilai coherence c_v sebesar 0,520257 menunjukkan keterkaitan kata topik yang cukup informatif untuk interpretasi. Namun, DBCV sampled sebesar -0,013278 menunjukkan bahwa struktur cluster berbasis densitas belum ideal secara absolut. Oleh karena itu, kualitas BERTopic dibaca sebagai kombinasi antara coherence, outlier rate, DBCV, dan hasil c-TF-IDF.

**Gambar 4.8 Distribusi topik BERTopic**

![Gambar 4.8 Distribusi topik BERTopic](public/hasil/distribusi_topik_bertopic.png)

**Gambar 4.9 Topik per label**

![Gambar 4.9 Topik per label](public/hasil/topik_per_label.png)

## 4.7 Analisis c-TF-IDF

Analisis c-TF-IDF digunakan untuk membaca kata atau frasa yang paling membedakan setiap topik. File yang digunakan adalah `public/hasil/evaluasi_ctfidf_topik.csv`.

**Tabel 4.14 Ringkasan c-TF-IDF**

| Item | Nilai |
|---|---:|
| Baris CSV | 790 |
| Kolom CSV | 9 |
| Topik valid | 79 |
| Kata/frasa unik | 720 |
| Kata eksklusif topik | 658 |
| Topic exclusivity | 0,913889 |
| Kata eksklusif kategori | 681 |
| Category exclusivity | 0,945833 |
| Topik dengan keyword hit | 76 |
| Rata-rata coverage keyword | 0,069279 |

Nilai topic exclusivity dan category exclusivity menunjukkan bahwa sebagian besar kata/frasa pada hasil c-TF-IDF bersifat diskriminatif terhadap topik atau kategori tertentu. Namun, rata-rata coverage keyword relatif rendah, sehingga interpretasi kategori tetap perlu dilakukan hati-hati dan tidak boleh dianggap sebagai label fakta.

**Gambar 4.10 Heatmap c-TF-IDF**

![Gambar 4.10 Heatmap c-TF-IDF](public/hasil/ctfidf_heatmap.png)

**Gambar 4.11 Distribusi c-TF-IDF per topik**

![Gambar 4.11 Distribusi c-TF-IDF per topik](public/hasil/ctfidf_distribusi_topik.png)

## 4.8 Implementasi Backend FastAPI

Backend menggunakan FastAPI dan menyediakan endpoint utama `POST /analyze`. Endpoint ini menerima teks berita, melakukan segmentasi paragraf dan kalimat, menjalankan model IndoBERT, menerapkan threshold 0,30, mengagregasikan verdict dokumen, dan menambahkan informasi topik.

**Tabel 4.15 Endpoint Backend**

| Endpoint | Method | Fungsi |
|---|---|---|
| `/` | GET | Metadata runtime backend |
| `/health` | GET | Health check backend |
| `/predict` | POST | Prediksi satu teks |
| `/predict-batch` | POST | Prediksi batch |
| `/analyze` | POST | Analisis multi-paragraf lengkap |

Agregasi verdict dilakukan menggunakan majority vote per kalimat dengan tie ke `hoax`. Topik runtime ditentukan melalui rule-based category, fallback BERTopic, dan fallback `Topik Umum`.

## 4.9 Implementasi Frontend dan Panel Metrik

Frontend diimplementasikan menggunakan HTML, CSS, dan JavaScript vanilla pada folder `public/`. Frontend mengirim request ke backend melalui endpoint `POST /analyze` dengan API default `https://fjrmhri-ta-final-space.hf.space`. UI menampilkan verdict dokumen, confidence, highlight, topik, dan rincian confidence. Confidence cutoff UI sebesar 0,65 digunakan untuk menandai unit teks yang confidence-nya rendah.

**Tabel 4.16 Panel Metrik Frontend**

| Item Panel | Nilai |
|---|---:|
| Accuracy test | 99,67% |
| F1 hoaks | 99,66% |
| AUC-ROC | 99,98% |
| Precision hoaks | 99,89% |
| Recall hoaks | 99,44% |
| Weighted F1 test | 99,67% |
| Threshold runtime | 0,30 |
| Training date | 14 Mei 2026 |
| Coherence | 0,5203 |
| DBCV | -0,0133 |
| Outlier rate | 21,90% |
| Topik final | 79 |

Screenshot frontend harus diambil ulang agar panel metrik sesuai dengan nilai pada Tabel 4.16.

## 4.10 Pengujian Fungsional Sistem

Pengujian fungsional dilakukan untuk memastikan fitur utama sistem berjalan sesuai kebutuhan. Pengujian dilakukan dengan pendekatan black-box terhadap input, pemanggilan API, rendering hasil, dan panel evaluasi.

**Tabel 4.17 Pengujian Black-Box Sistem**

| No | Komponen | Skenario | Hasil yang Diharapkan |
|---:|---|---|---|
| 1 | Input teks | Pengguna memasukkan berita multi-paragraf | Sistem menerima teks dan menghitung statistik paragraf, kalimat, dan kata |
| 2 | Endpoint `POST /analyze` | Frontend mengirim teks ke backend | Backend mengembalikan JSON analisis |
| 3 | Verdict dokumen | Response memiliki field `document` | Frontend menampilkan verdict dan confidence |
| 4 | Highlight | Response memiliki daftar kalimat/paragraf | Frontend menampilkan highlight sesuai label dan confidence |
| 5 | Topik | Toggle topik aktif | Frontend menampilkan topik global dan/atau topik paragraf |
| 6 | Panel metrik | Halaman evaluasi dibuka | Nilai panel sesuai eksperimen terbaru |
| 7 | Error handling | Teks kosong dikirim | Sistem menampilkan pesan kesalahan |

## 4.11 Pembahasan Hasil

Hasil eksperimen menunjukkan bahwa penghapusan data tambahan membuat dataset lebih kecil dan lebih mudah dipertanggungjawabkan. Dataset bersih berjumlah 24.598 data dengan rasio hoaks 48,6%, sehingga distribusi label relatif seimbang. Oversampling pada training set hanya bersifat ringan karena jumlah label pada training set sudah cukup dekat.

Performa IndoBERT tetap tinggi pada validation set dan test set. Pada threshold runtime 0,30, model menghasilkan F1 hoaks 0,996646 dan AUC 0,999817 pada test set. Nilai tersebut menunjukkan kemampuan klasifikasi yang kuat pada data uji. Namun, hasil ini tidak boleh dibaca sebagai bukti generalisasi absolut karena split yang digunakan adalah stratified random split. Selain itu, risiko bias sumber tetap ada karena data hoaks dan non-hoaks berasal dari jenis sumber berbeda.

Pada sisi BERTopic, coherence c_v 0,520257 menunjukkan bahwa kata-kata topik cukup koheren untuk interpretasi. Outlier rate 21,90% menunjukkan sebagian dokumen masih tidak masuk cluster utama, tetapi tingkat outlier tersebut masih dapat diterima untuk pembacaan eksploratif. Nilai DBCV sampled -0,013278 perlu dibaca hati-hati karena menunjukkan struktur densitas cluster belum ideal secara absolut. Dengan demikian, BERTopic digunakan sebagai alat bantu interpretabilitas, bukan sebagai dasar penentuan kebenaran informasi.

Analisis c-TF-IDF menunjukkan topic exclusivity 0,913889 dan category exclusivity 0,945833. Nilai ini mendukung bahwa banyak kata/frasa bersifat diskriminatif terhadap topik atau kategori tertentu. Namun, rata-rata coverage keyword 0,069279 menunjukkan bahwa pencocokan keyword kategori belum sepenuhnya kuat untuk semua topik, sehingga interpretasi topik tetap perlu dilihat sebagai informasi pendukung.

## 4.12 Keterbatasan

Keterbatasan penelitian ini adalah sebagai berikut.

1. Dataset berasal dari sumber yang berbeda untuk kelas hoaks dan non-hoaks, sehingga risiko bias sumber tetap ada.
2. Split data menggunakan stratified random split, bukan group split berbasis artikel, domain, atau sumber.
3. Dataset pelatihan tidak memiliki label eksplisit pada tingkat kalimat.
4. Sistem tidak melakukan evidence retrieval atau verifikasi klaim terhadap sumber eksternal.
5. BERTopic memiliki DBCV negatif tipis, sehingga struktur densitas cluster belum ideal secara absolut.
6. Sistem masih berupa prototipe dan belum mencakup monitoring produksi, database, logging pengguna, atau evaluasi usability formal.
7. Pengujian lintas sumber dan lintas waktu belum dilakukan.
