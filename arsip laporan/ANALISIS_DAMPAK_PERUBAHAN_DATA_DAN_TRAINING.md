# ANALISIS_DAMPAK_PERUBAHAN_DATA_DAN_TRAINING

Judul skripsi: **DETEKSI HOAKS BERITA BERBAHASA INDONESIA BERBASIS FINE-TUNING INDOBERT PADA TINGKAT KALIMAT DAN PEMODELAN TOPIK BERTOPIC**

Dokumen ini merupakan audit dampak perubahan dataset dan training terbaru. Audit ini tidak melakukan rewrite BAB I–V, tetapi mengunci dampak revisi yang harus dilakukan agar seluruh naskah konsisten dengan eksperimen terbaru.

---

## 1. TL;DR

- Perubahan dataset berdampak **besar** terhadap naskah: file `Summarized_2020+.csv`/data tambahan besar tidak lagi dipakai; dataset terbaru hanya memakai empat sumber utama CNN, Detik, Kompas, dan TurnBackHoax.
- Jumlah data turun dari **172.174 data bersih** menjadi **24.598 data bersih**. Distribusi label berubah drastis dari sangat tidak seimbang menjadi relatif seimbang: `not_hoax = 12.645`, `hoax = 11.953`, rasio hoaks **48,6%**.
- Split tetap **stratified random split 70/15/15**, tetapi ukuran berubah menjadi train **17.218**, validation **3.690**, dan test **3.690**.
- Oversampling masih digunakan, tetapi dampaknya jauh lebih ringan: training set hanya dinaikkan dari **17.218** menjadi **17.702** karena selisih label train kecil.
- Threshold runtime berubah dari **0,34** menjadi **0,30** berdasarkan validation set dan telah sinkron dengan `public/hasil/inference_config.json`, `backend/app.py`, dan panel frontend.
- Metrik IndoBERT dan BERTopic berubah. Nilai lama seperti test accuracy `0,998413`, F1 hoaks `0,988499`, coherence `0,439093`, DBCV `0,660416`, dan outlier rate `39,92%` harus diganti.
- BAB III dan BAB IV terdampak paling besar karena memuat dataset, split, balancing, konfigurasi training, metrik model, threshold, evaluasi BERTopic, c-TF-IDF, dan gambar artefak.
- Risiko metodologis berubah: dataset lebih kecil tetapi lebih mudah dipertanggungjawabkan; bias sumber tetap ada karena non-hoaks berasal dari portal berita, sedangkan hoaks berasal dari TurnBackHoax.

---

## 2. Inventaris Sumber yang Dianalisis

| Sumber/File | Status | Relevansi | Catatan |
|---|---|---|---|
| `/mnt/data/Final_V4_DBCS.ipynb` terbaru | Dianalisis | Sumber utama dataset, training, evaluasi IndoBERT, threshold, BERTopic, c-TF-IDF, dan artefak | Notebook terbaru tidak memuat `Summarized_2020+.csv`; file aktual di notebook adalah `CNN.csv`, `Detik.csv`, `Kompas.csv`, `TurnBackHoax.csv`. |
| Repository `fjrmhri/Deteksi_Hoaks_V1` | Dianalisis | Verifikasi backend, frontend, README, dan artefak publik | `README.md` masih memiliki bagian yang tidak sinkron dengan artefak terbaru, sehingga hanya dipakai untuk arsitektur umum. |
| `public/hasil/inference_config.json` | Dianalisis | Source of truth threshold runtime, model dasar, label map, max length, versi library, tanggal training | Mengunci `threshold_optimal = 0.3`, `threshold_default = 0.5`, training date `2026-05-14`. |
| `public/hasil/evaluasi_ctfidf_topik.csv` | Dianalisis sebagian | Source of truth struktur c-TF-IDF dan kata pembeda topik | CSV memiliki kolom `Topik_ID`, `Kategori`, `Nama_Topik`, `Rank`, `Kata`, `Skor_cTFIDF`, `Keyword_Ditemukan`, `Coverage`, `Keyword_Kategori_Lengkap`; ringkasan jumlah baris dikunci dari notebook. |
| `backend/app.py` | Dianalisis | Perilaku runtime API: FastAPI, endpoint, threshold, segmentasi, agregasi, topik | Backend memakai FastAPI, model Hugging Face Hub, `POST /analyze`, majority vote, tie ke `hoax`, dan topic strategy `bertopic+rules`. |
| `public/index.html` | Dianalisis | Panel UI, metrik yang tampil, threshold, tanggal training, visualisasi evaluasi | Panel terbaru menampilkan threshold `0.30`, tanggal training 14 Mei 2026, metrik IndoBERT dan BERTopic terbaru. |
| `public/app.js` | Dianalisis | Komunikasi frontend-backend dan rendering hasil | Frontend memanggil `POST /analyze`, memakai confidence cutoff 0,65, toggle kalimat/paragraf, dan toggle topik per paragraf. |
| `public/styles.css` | Dianalisis tingkat struktur | Relevan untuk tampilan highlight, verdict, card, dan tab evaluasi | Tidak mengubah fakta metodologis. |
| `LOCKED_FACTS_SKRIPSI.md` lama | Dianalisis | Dokumen lama yang perlu diganti | Masih memuat dataset lama 172.174, threshold 0,34, dan metrik lama. |
| `ABSTRAK_DAN_ABSTRACT.md` lama | Dianalisis | Perlu update angka dan narasi dataset/balancing | Masih memakai threshold 0,34 dan metrik lama. |
| `BAB_I_Pendahuluan.md` lama | Dianalisis | Dampak ringan-sedang | Rumusan masalah tetap, tetapi narasi imbalance perlu dilunakkan. |
| `BAB_II_Landasan_Teori.md` lama | Dianalisis | Dampak ringan | Teori tetap, bagian oversampling perlu wording adjustment karena data terbaru lebih seimbang. |
| `BAB_III_Metodologi_Penelitian.md` lama | Dianalisis | Dampak besar | Dataset, sumber data, tabel split, oversampling, corpus BERTopic, dan checkpoint harus diganti. |
| `BAB_IV_Hasil_dan_Pembahasan.md` lama | Dianalisis | Dampak besar | Semua tabel dataset, metrik, threshold, BERTopic, c-TF-IDF, dan gambar artefak harus diperbarui. |
| `BAB_V_Kesimpulan_dan_Saran.md` lama | Dianalisis | Dampak sedang | Angka kesimpulan dan interpretasi DBCV/outlier harus diganti. |
| `Blueprint_Skripsi_Deteksi_Hoaks.md` lama | Dianalisis | Dampak besar | Ringkasan teknis dan mapping lama perlu diperbarui. |
| `DIAGRAM_SKRIPSI_DETEKSI_HOAKS.md` lama | Dianalisis | Dampak sedang | Diagram alur tetap, tetapi angka threshold, corpus BERTopic, dan catatan balancing harus diubah. |
| `AUDIT_KONSISTENSI_SKRIPSI.md` lama | Dianalisis | Dampak besar | Audit lama tidak valid sebagai audit final karena angka source of truth berubah. |
| `BUKU PEDOMAN TUGAS AKHIR.pdf` | Dianalisis sebagai acuan format | Struktur bab, gambar, tabel, abstrak, daftar pustaka | Tidak terdampak oleh perubahan eksperimen. |
| `Pra Proposal.pdf` | Dianalisis sebagai sumber latar belakang | Judul, masalah, state of the art, metode awal | Tidak menjadi source of truth angka eksperimen. |

---

## 3. Fakta Teknis Lama vs Baru

| Item | Nilai Lama | Nilai Baru | Sumber Baru | Dampak ke Skripsi |
|---|---:|---:|---|---|
| File dataset | 5 file: CNN, Detik, Kompas, TurnBackHoax, `Summarized_2020+.csv`/merged extra | 4 file: `CNN.csv`, `Detik.csv`, `Kompas.csv`, `TurnBackHoax.csv` | `Final_V4_DBCS.ipynb` terbaru | BAB III dan BAB IV wajib diubah. |
| `Summarized_2020+.csv` | Dipakai | Tidak ditemukan/dipakai di notebook terbaru | `Final_V4_DBCS.ipynb` terbaru | Semua narasi `merged_extra` harus dihapus. |
| Dataset Kaggle | `fjrmhri/dataset-berita` | `fjrmhri/dataset-skripsi` di notebook terbaru | `Final_V4_DBCS.ipynb` terbaru | Sumber dataset di BAB III/BAB IV perlu diperbarui. |
| Total data mentah | 173.229 | 24.675 | `Final_V4_DBCS.ipynb` terbaru | Tabel preprocessing harus diganti. |
| Baris kosong dibuang | UNKNOWN/lama tidak ditulis eksplisit | 0 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan ke tabel preprocessing. |
| Label NaN dibuang | UNKNOWN/lama tidak ditulis eksplisit | 0 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan ke tabel preprocessing jika diperlukan. |
| Duplikat `(text,label)` dihapus | 1.055 | 77 | `Final_V4_DBCS.ipynb` terbaru | Tabel preprocessing harus diganti. |
| Konflik label | 0 | 0 | `Final_V4_DBCS.ipynb` terbaru | Tetap 0; angka tetap aman. |
| Data bersih | 172.174 | 24.598 | `Final_V4_DBCS.ipynb` terbaru | Semua bab yang menyebut jumlah data harus diganti. |
| `not_hoax = 0` | 160.221 | 12.645 | `Final_V4_DBCS.ipynb` terbaru | Tabel distribusi label harus diganti. |
| `hoax = 1` | 11.953 | 11.953 | `Final_V4_DBCS.ipynb` terbaru | Jumlah hoaks tetap, tetapi konteks rasio berubah. |
| Rasio hoaks | 6,9% | 48,6% | `Final_V4_DBCS.ipynb` terbaru | Narasi imbalance lama tidak berlaku; harus dilunakkan. |
| Distribusi sumber | CNN 4.216, Detik 4.213, Kompas 4.216, merged_extra 147.576, TurnBackHoax 11.953 | CNN 4.216, Detik 4.213, Kompas 4.216, TurnBackHoax 11.953 | `Final_V4_DBCS.ipynb` terbaru | Hapus merged_extra. Risiko bias sumber tetap ada. |
| Statistik panjang teks | UNKNOWN | count 24.598, mean 1.029,0, std 1.172,7, min 1, median 573,5, max 29.140 | `Final_V4_DBCS.ipynb` terbaru | Bisa ditambahkan di BAB IV sebagai tabel pendukung. |
| Split | Train 120.521, validation 25.826, test 25.827 | Train 17.218, validation 3.690, test 3.690 | `Final_V4_DBCS.ipynb` terbaru | Tabel split harus diganti. |
| Metode split | Stratified random split 70/15/15 | Stratified random split 70/15/15 | `Final_V4_DBCS.ipynb` terbaru | Metode tetap, angka berubah. |
| Train sebelum balancing | label 0 = 112.154, label 1 = 8.367 | label 0 = 8.851, label 1 = 8.367 | `Final_V4_DBCS.ipynb` terbaru | Oversampling tidak lagi ekstrem. |
| Train setelah balancing | label 0 = 112.154, label 1 = 112.154, total 224.308 | label 0 = 8.851, label 1 = 8.851, total 17.702 | `Final_V4_DBCS.ipynb` terbaru | Narasi balancing harus diganti. |
| Validation/test balancing | Tidak dibalancing | Tidak dibalancing | `Final_V4_DBCS.ipynb` terbaru | Tetap. |
| Corpus BERTopic | 120.521 train pra-oversampling | 17.218 train pra-oversampling | `Final_V4_DBCS.ipynb` terbaru | Semua narasi BERTopic corpus harus diganti. |
| Model dasar | `indolem/indobert-base-uncased` | `indolem/indobert-base-uncased` | Notebook dan `inference_config.json` | Tetap. |
| Model runtime | `fjrmhri/deteksi_hoaks_indobert` | `fjrmhri/deteksi_hoaks_indobert` | `backend/app.py` | Tetap. |
| Max length | 256 | 256 | Notebook dan `inference_config.json` | Tetap. |
| Training date | 2026-04-27 | 2026-05-14 | Notebook dan `inference_config.json` | Tabel konfigurasi training harus diganti. |
| Checkpoint terbaik | `checkpoint-3507` | `checkpoint-186` | `Final_V4_DBCS.ipynb` terbaru | Tabel konfigurasi training harus diganti. |
| Threshold default | 0,50 | 0,50 | Notebook dan `inference_config.json` | Tetap. |
| Threshold optimal/runtime | 0,34 | 0,30 | Notebook, `inference_config.json`, `backend/app.py`, `public/index.html` | Semua bab/abstrak/diagram harus diganti. |
| Validation accuracy default | 0,998683 | 0,995393 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik default harus diganti. |
| Validation precision hoaks default | 0,992166 | 0,998876 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik harus diganti. |
| Validation recall hoaks default | 0,988846 | 0,991634 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik harus diganti. |
| Validation F1 hoaks default | 0,990503 | 0,995242 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik harus diganti. |
| Validation weighted F1 default | 0,998682 | 0,995392 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik harus diganti. |
| Validation AUC default | 0,998175 | 0,999804 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik harus diganti. |
| Test accuracy default | 0,998413 | 0,996748 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik dan abstrak harus diganti. |
| Test precision hoaks default | 0,994357 | 0,999439 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik dan abstrak harus diganti. |
| Test recall hoaks default | 0,982711 | 0,993865 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik dan abstrak harus diganti. |
| Test F1 hoaks default | 0,988499 | 0,996644 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik dan abstrak harus diganti. |
| Test weighted F1 default | 0,998408 | 0,996748 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik dan abstrak harus diganti. |
| Test AUC default | 0,997440 | 0,999817 | `Final_V4_DBCS.ipynb` terbaru | Tabel metrik dan abstrak harus diganti. |
| Validation @ threshold optimal | threshold 0,34, F1 0,9908 | threshold 0,30; accuracy 0,995935; precision 0,998878; recall 0,992750; F1 0,995804; AUC 0,999804; TP 1780; FP 2; FN 13; TN 1895 | `Final_V4_DBCS.ipynb` terbaru | Tabel threshold calibration harus diganti. |
| Test @ threshold optimal | F1 @ 0,34 = 0,9879 | threshold 0,30; accuracy 0,996748; precision 0,998880; recall 0,994423; F1 0,996646; AUC 0,999817; TP 1783; FP 2; FN 10; TN 1895 | `Final_V4_DBCS.ipynb` terbaru | Tabel threshold calibration dan pembahasan test harus diganti. |
| Embedding BERTopic | MiniLM multilingual | MiniLM multilingual | Notebook dan `backend/app.py` | Tetap. |
| UMAP | n_neighbors 30, min_dist 0,1 | n_neighbors 12, n_components 5, min_dist 0,0, metric cosine | `Final_V4_DBCS.ipynb` terbaru | Tabel BERTopic harus diganti. |
| HDBSCAN | min_cluster_size 30, EOM | min_cluster_size 12, min_samples 2, metric euclidean, selection leaf | `Final_V4_DBCS.ipynb` terbaru | Tabel BERTopic harus diganti. |
| CountVectorizer | min_df 10, max_df 0,8 | ngram 1–2, min_df 3, max_df 0,75, max_features 20.000, stopwords khusus BERTopic | `Final_V4_DBCS.ipynb` terbaru | Tabel BERTopic/c-TF-IDF harus diganti. |
| Guided topic modeling | Aktif/seed topic disebut pada draft lama | `AKTIFKAN_GUIDED = False` | `Final_V4_DBCS.ipynb` terbaru | Narasi guided topic modeling harus dihapus/dibatasi. |
| Strategi final outlier | UNKNOWN/lama final non-outlier 75 | `reduce_probabilities` | `Final_V4_DBCS.ipynb` terbaru | BAB IV harus menjelaskan strategi final. |
| Total dokumen BERTopic | 120.521 | 17.218 | `Final_V4_DBCS.ipynb` terbaru | Semua bagian BERTopic diganti. |
| Jumlah topik final non-outlier | 75 | 79 | Notebook dan `public/index.html` | Tabel BERTopic dan panel frontend diganti. |
| Jumlah outlier | 48.115 | 3.771 | Notebook dan `public/index.html` | Tabel BERTopic diganti. |
| Outlier rate | 39,92% | 21,90% | Notebook dan `public/index.html` | BAB IV/V/Abstrak diganti. |
| Coherence c_v | 0,439093 | 0,520257 | Notebook dan `public/index.html` | BAB IV/V/Abstrak diganti. |
| DBCV sampled | 0,660416 | -0,013278 | Notebook dan `public/index.html` | Pembahasan harus berubah: DBCV negatif tipis, bukan positif kuat. |
| DBCV mode | sampled | sampled | `Final_V4_DBCS.ipynb` terbaru | Tetap. |
| DBCV titik dipakai | UNKNOWN | 3.000 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan di BAB IV jika perlu. |
| DBCV cluster dipakai | UNKNOWN | 79 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan di BAB IV jika perlu. |
| HDBSCAN relative validity | UNKNOWN | 0,218550 | `Final_V4_DBCS.ipynb` terbaru | Bisa masuk tabel evaluasi BERTopic. |
| c-TF-IDF rows | 750 | 790 | Notebook dan CSV | BAB IV dan README/blueprint harus diganti. |
| c-TF-IDF columns | 9 | 9 | Notebook dan CSV | Tetap 9 kolom. |
| Kata/frasa unik | 658 | 720 | `Final_V4_DBCS.ipynb` terbaru | BAB IV c-TF-IDF diganti. |
| Topic exclusivity | UNKNOWN/lama tidak dikunci rinci | 0,913889 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan jika dibahas. |
| Category exclusivity | UNKNOWN/lama tidak dikunci rinci | 0,945833 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan jika dibahas. |
| Keyword coverage | UNKNOWN/lama tidak dikunci rinci | 0,069279 | `Final_V4_DBCS.ipynb` terbaru | Tambahkan jika dibahas. |
| Backend framework | FastAPI | FastAPI | `backend/app.py` | Tidak berubah. |
| Endpoint utama | `POST /analyze` | `POST /analyze` | `backend/app.py` | Tidak berubah. |
| Endpoint tambahan | Ada GET `/`, `/health`, POST `/predict`, `/predict-batch` | Tetap ada | `backend/app.py` | Endpoint table bisa diperbarui bila belum lengkap. |
| Runtime threshold backend | 0,34 lama | 0,30 dari config | `backend/app.py`, `inference_config.json` | Semua narasi runtime harus diganti. |
| Frontend metrics | Lama 99,84%, threshold 0,34 | Baru: accuracy 99,67%, F1 hoaks 99,66%, AUC 99,98%, precision 99,89%, recall 99,44%, weighted F1 99,67%, coherence 0,5203, DBCV -0,0133, outlier 21,90%, topik final 79 | `public/index.html` | Screenshot panel metrik harus diambil ulang. |

---

## 4. Perubahan Wajib per Dokumen

| Dokumen | Tingkat Dampak | Bagian/Subbab yang Harus Diubah | Jenis Perubahan | Catatan |
|---|---|---|---|---|
| `LOCKED_FACTS_SKRIPSI.md` | BESAR | Seluruh tabel fakta teknis dataset, split, balancing, threshold, metrik, BERTopic, c-TF-IDF | Ganti angka lama dengan source of truth baru | Buat versi revisi terlebih dahulu sebelum rewrite bab. |
| `ABSTRAK_DAN_ABSTRACT.md` | BESAR | Bagian metode dan hasil | Ganti threshold, metrik test, coherence, DBCV, outlier rate; lunakkan narasi oversampling | Jangan menyebut data sangat tidak seimbang. |
| `BAB_I_Pendahuluan.md` | SEDANG | Latar belakang, identifikasi masalah, batasan masalah | Wording adjustment tentang imbalance dan bias sumber | Rumusan masalah, tujuan, manfaat tetap. |
| `BAB_II_Landasan_Teori.md` | RINGAN | Bagian ketidakseimbangan kelas dan oversampling | Lunakkan teori oversampling karena data terbaru relatif seimbang | Teori utama tetap. |
| `BAB_III_Metodologi_Penelitian.md` | BESAR | 3.3, 3.4, 3.6, 3.7, 3.8, 3.9, diagram/tabel dataset | Ganti sumber dataset, jumlah data, split, balancing, checkpoint, konfigurasi BERTopic | Hapus `Summarized_2020+.csv` dan merged_extra. |
| `BAB_IV_Hasil_dan_Pembahasan.md` | BESAR | 4.1 sampai 4.7, 4.9 panel metrik, 4.11, 4.12 | Ganti hampir semua tabel hasil, metrik, threshold, gambar artefak, pembahasan BERTopic | Bagian backend/frontend struktur tetap, angka tampil berubah. |
| `BAB_V_Kesimpulan_dan_Saran.md` | SEDANG | Kesimpulan poin 2, 3, 5; saran terkait dataset/oversampling | Ganti angka dan interpretasi DBCV/outlier | Saran group split, dataset kalimat, evidence retrieval tetap sebagai saran. |
| `Blueprint_Skripsi_Deteksi_Hoaks.md` | BESAR | TL;DR, ringkasan notebook, locked numbers, mapping BAB IV, daftar tabel/gambar | Ganti seluruh angka teknis lama | Blueprint lama tidak boleh dipakai sebagai source angka. |
| `DIAGRAM_SKRIPSI_DETEKSI_HOAKS.md` | SEDANG | Diagram alur praproses, training, threshold, BERTopic, evaluasi, caption | Update threshold 0,30, corpus 17.218, topik 79; hapus angka lama | Arsitektur, use case, deployment sebagian besar tetap. |
| `AUDIT_KONSISTENSI_SKRIPSI.md` | BESAR | Seluruh audit angka dan status konsistensi | Audit lama harus diganti setelah revisi dokumen | Audit lama menyatakan angka lama aman; tidak valid lagi. |

---

## 5. Detail Revisi BAB I

### Bagian yang Perlu Disesuaikan

1. **Latar belakang**
   - Narasi umum hoaks, IndoBERT, BERTopic, dan interpretabilitas tetap.
   - Paragraf tentang ketidakseimbangan kelas perlu disesuaikan. Dataset terbaru tidak lagi sangat timpang karena rasio hoaks 48,6%.
   - Ubah dari “ketidakseimbangan kelas menjadi masalah utama” menjadi “terdapat sedikit perbedaan distribusi kelas pada training set sehingga oversampling ringan diterapkan hanya pada training set”.

2. **Identifikasi masalah**
   - Poin tentang risiko bias sumber tetap harus dipertahankan.
   - Poin tentang kelas minoritas boleh ditulis lebih hati-hati: kelas `hoax` sedikit lebih kecil pada training set, bukan sangat minoritas.

3. **Rumusan masalah**
   - Tidak perlu berubah.
   - Rumusan masalah tetap relevan: fine-tuning IndoBERT, segmentasi runtime, BERTopic, evaluasi, integrasi web.

4. **Batasan masalah**
   - Tetap cantumkan:
     - tidak ada evidence retrieval,
     - output bukan verifikasi fakta absolut,
     - tingkat kalimat adalah runtime,
     - stratified random split, bukan group split,
     - bias sumber tetap ada.
   - Tambahkan bahwa dataset terbaru hanya memakai empat sumber utama dan tidak memakai data tambahan `2020+`.

5. **Narasi imbalance**
   - Ganti frasa “dataset sangat tidak seimbang” menjadi “dataset bersih relatif seimbang, tetapi training set tetap diseimbangkan secara eksplisit menggunakan oversampling ringan”.
   - Penjelasan ini penting agar tidak bertentangan dengan rasio hoaks 48,6%.

---

## 6. Detail Revisi BAB II

### Teori yang Tetap

- Hoaks dan berita palsu.
- NLP.
- Klasifikasi teks.
- Transformer, BERT, IndoBERT.
- Fine-tuning.
- Tokenisasi.
- Confusion matrix, accuracy, precision, recall, F1, weighted F1, ROC/AUC.
- Threshold.
- Segmentasi kalimat dan paragraf.
- Topic modeling, BERTopic, sentence embedding, UMAP, HDBSCAN, c-TF-IDF.
- Coherence score.
- DBCV.
- FastAPI, frontend statis, Vercel, Hugging Face Spaces.
- Teori data leakage dan validasi machine learning.

### Teori yang Perlu Wording Adjustment

1. **Ketidakseimbangan kelas dan oversampling**
   - Teori tetap digunakan, tetapi jangan membuat pembaca mengira dataset terbaru sangat tidak seimbang.
   - Jelaskan bahwa oversampling tetap dapat digunakan ketika ada perbedaan jumlah kelas pada training set, meskipun ketimpangannya tidak ekstrem.
   - Bandingkan secara singkat dengan class weight jika diperlukan, tetapi jangan mengklaim class weight digunakan.

2. **Evaluasi BERTopic**
   - Tambahkan wording bahwa DBCV bisa bernilai negatif.
   - Nilai DBCV negatif tipis tidak otomatis berarti model tidak berguna; interpretasinya harus dibandingkan dengan kandidat konfigurasi lain serta coherence, outlier rate, dan interpretasi c-TF-IDF.

3. **Guided topic modeling**
   - Jika BAB II menyebut seed topic/guided topic modeling sebagai teori, boleh dipertahankan sebagai teori umum.
   - Namun, pada metode dan hasil, tulis bahwa eksperimen terbaru **tidak mengaktifkan guided topic modeling** (`AKTIFKAN_GUIDED = False`).

### Daftar Pustaka

- Tidak berubah secara substansi.
- Tetap perlu verifikasi metadata APA.
- Tidak perlu menambah referensi baru hanya karena dataset berubah, kecuali ingin menambahkan rujukan khusus oversampling/class weight.

---

## 7. Detail Revisi BAB III

### 3.3 Pengumpulan Data

Wajib diganti:

- Hapus `Summarized_2020+.csv`.
- Hapus `merged_extra`.
- Ganti dataset source menjadi dataset Kaggle terbaru yang pada notebook terbaca sebagai `fjrmhri/dataset-skripsi`.
- Tabel sumber dataset terbaru:

| No | File di Notebook | Padanan Narasi Dataset | Label Dominan |
|---:|---|---|---|
| 1 | `CNN.csv` | CNN / `Summarized_CNN.csv` jika nama publik dataset memakai prefix tersebut | `not_hoax` |
| 2 | `Detik.csv` | Detik / `Summarized_Detik.csv` | `not_hoax` |
| 3 | `Kompas.csv` | Kompas / `Summarized_Kompas.csv` | `not_hoax` |
| 4 | `TurnBackHoax.csv` | TurnBackHoax / `Summarized_TurnBackHoax.csv` | `hoax` |

Catatan: karena notebook terbaru memakai nama `CNN.csv`, `Detik.csv`, `Kompas.csv`, dan `TurnBackHoax.csv`, naskah final sebaiknya mengikuti nama aktual notebook. Jika di Kaggle nama file tampil dengan prefix `Summarized_`, tambahkan catatan “nama file pada notebook setelah ekstraksi”.

### 3.4 Praproses Data

Update tabel:

| Tahap | Nilai Baru |
|---|---:|
| Total data mentah | 24.675 |
| Baris teks kosong dibuang | 0 |
| Label NaN dibuang | 0 |
| Duplikat `(text,label)` dihapus | 77 |
| Konflik label | 0 |
| Total data bersih | 24.598 |

Fallback kolom teks tetap dapat ditulis jika masih ada di notebook. Jangan menambahkan stemming, lemmatization, atau normalisasi agresif.

### 3.6 Pembagian Dataset

Update tabel:

| Subset | Jumlah |
|---|---:|
| Train | 17.218 |
| Validation | 3.690 |
| Test | 3.690 |

Metode tetap: stratified random split 70/15/15. Jangan menulis group split.

### 3.7 Penanganan Kelas Minoritas

Update narasi:

- Dataset bersih relatif seimbang.
- Training set sebelum balancing: label 0 = 8.851, label 1 = 8.367.
- Oversampling hanya menaikkan label 1 menjadi 8.851.
- Total train setelah balancing: 17.702.
- Validation/test tidak dibalancing.

Narasi aman:

> Oversampling tetap digunakan untuk membuat distribusi kelas pada training set benar-benar seimbang, tetapi tidak lagi bersifat ekstrem karena selisih jumlah kelas pada dataset terbaru relatif kecil.

### 3.8 Perancangan Model IndoBERT

Update:

- Training date: 2026-05-14.
- Checkpoint terbaik: `indobert_hoax_model_v3/checkpoint-186`.
- Threshold runtime: 0,30.
- Konfigurasi lain tetap: max_length 256, batch 96/384, gradient accumulation 2, effective batch 192, lr 2e-5, weight decay 0,01, epoch 3, seed 42, scheduler linear, warmup 0,06.

### 3.9 Perancangan BERTopic

Update:

| Komponen | Nilai Baru |
|---|---|
| Corpus | 17.218 dokumen train pra-oversampling |
| Embedding | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| UMAP | n_neighbors 12, n_components 5, min_dist 0,0, metric cosine |
| HDBSCAN | min_cluster_size 12, min_samples 2, metric euclidean, cluster_selection_method leaf |
| CountVectorizer | ngram 1–2, min_df 3, max_df 0,75, max_features 20.000 |
| Guided topic modeling | Tidak aktif (`AKTIFKAN_GUIDED = False`) |
| Outlier strategy | `reduce_probabilities`, threshold 0,10 |
| Target nr_topics | 80 |

### Diagram BAB III yang Terdampak

| Diagram | Dampak |
|---|---|
| Alur penelitian | Angka tidak perlu dimasukkan; tetap. Jika ada threshold, ubah ke 0,30. |
| Alur praproses data | Hapus 5 CSV; ubah menjadi 4 CSV. |
| Alur training IndoBERT | Update jumlah train dan balancing bila angka ada di diagram. |
| Alur threshold | Update 0,34 menjadi 0,30. |
| Alur BERTopic | Update corpus 17.218 dan parameter baru bila tertulis. |
| Alur evaluasi BERTopic | Update DBCV/coherence/outlier jika angka ada di caption. |

---

## 8. Detail Revisi BAB IV

### 4.1 Implementasi Dataset dan Praproses

Wajib update:

- Dataset lima file menjadi empat file.
- Total mentah 24.675.
- Duplikat 77.
- Konflik label 0.
- Data bersih 24.598.
- Distribusi label:
  - `not_hoax`: 12.645
  - `hoax`: 11.953
  - rasio hoaks 48,6%
- Distribusi sumber:
  - CNN 4.216
  - Detik 4.213
  - Kompas 4.216
  - TurnBackHoax 11.953
- Narasi lama “dataset sangat tidak seimbang” harus dihapus.
- Narasi baru: dataset relatif seimbang, tetapi bias sumber tetap ada.

### 4.2 Implementasi Fine-Tuning IndoBERT

Wajib update:

- Tanggal training: 14 Mei 2026.
- Checkpoint terbaik: `checkpoint-186`.
- Total train setelah balancing: 17.702.
- Konfigurasi training lain tetap.
- Tambahkan bahwa oversampling ringan dilakukan hanya pada training set.

### 4.3 Hasil Evaluasi IndoBERT

Ganti tabel validation default:

| Metrik | Nilai Baru |
|---|---:|
| Accuracy | 0,995393 |
| Precision hoax | 0,998876 |
| Recall hoax | 0,991634 |
| F1 hoax | 0,995242 |
| Weighted F1 | 0,995392 |
| AUC | 0,999804 |

Ganti tabel test default:

| Metrik | Nilai Baru |
|---|---:|
| Accuracy | 0,996748 |
| Precision hoax | 0,999439 |
| Recall hoax | 0,993865 |
| F1 hoax | 0,996644 |
| Weighted F1 | 0,996748 |
| AUC | 0,999817 |

### 4.4 Analisis Kalibrasi Threshold

Ganti semua `0,34` menjadi `0,30`.

Tabel threshold optimal validation:

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

Tabel threshold optimal test:

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

Pembahasan lama bahwa threshold 0,50 sedikit lebih baik pada test tidak boleh dipertahankan kecuali notebook terbaru memang menunjukkan itu. Pada data terbaru, F1 threshold optimal test `0,996646` sangat dekat dan sedikit di atas F1 default `0,996644`.

### 4.5 Implementasi Pemodelan Topik BERTopic

Ganti parameter dan corpus:

- Corpus 17.218.
- Guided topic modeling tidak aktif.
- UMAP n_neighbors 12, min_dist 0,0.
- HDBSCAN min_cluster_size 12, min_samples 2, selection leaf.
- CountVectorizer min_df 3, max_df 0,75.
- Strategi final: `reduce_probabilities`.

### 4.6 Evaluasi BERTopic

Ganti tabel evaluasi:

| Metrik | Nilai Baru |
|---|---:|
| Total dokumen BERTopic | 17.218 |
| Topik final non-outlier | 79 |
| Jumlah topik utama | 79 |
| Dokumen outlier | 3.771 |
| Outlier rate | 21,90% |
| Topik terbesar | 0 |
| Dokumen topik terbesar | 2.787 |
| Persentase topik terbesar | 16,19% |
| DBCV HDBSCAN | -0,013278 |
| DBCV mode | sampled |
| DBCV titik dipakai | 3.000 |
| DBCV cluster dipakai | 79 |
| HDBSCAN relative validity | 0,218550 |
| Coherence c_v | 0,520257 |
| Coherence dokumen dipakai | 8.000 |
| Coherence topik dipakai | 79 |

Interpretasi penting:

- Coherence meningkat dibanding nilai lama.
- DBCV berubah menjadi negatif tipis. Jangan menulis “DBCV baik/kuat” secara absolut.
- Tulis bahwa konfigurasi final dipilih sebagai kompromi terbaik dibanding kandidat lain, karena mengurangi outlier dan menjaga coherence, meskipun struktur densitas cluster belum ideal secara absolut.

### 4.7 c-TF-IDF

Ganti ringkasan:

| Item | Nilai Baru |
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

### 4.8 Backend FastAPI

Struktur tetap:

- FastAPI.
- Endpoint utama `POST /analyze`.
- Endpoint tambahan `GET /`, `GET /health`, `POST /predict`, `POST /predict-batch`.
- Threshold runtime 0,30.
- Majority vote, tie ke hoaks.
- Topik hibrida rules + BERTopic.
- Tidak ada database.
- Tidak ada evidence retrieval.

### 4.9 Frontend Web

Update panel metrik frontend:

| Item Panel | Nilai Baru |
|---|---:|
| Threshold Runtime | 0,30 |
| Training Date | 14 Mei 2026 |
| Accuracy Test | 99,67% |
| F1 Hoaks | 99,66% |
| AUC-ROC | 99,98% |
| Precision Hoaks | 99,89% |
| Recall Hoaks | 99,44% |
| Weighted F1 Test | 99,67% |
| Coherence | 0,5203 |
| DBCV sampled | -0,0133 |
| Outlier Rate | 21,90% |
| Topik Final | 79 |

### 4.10 Pengujian Fungsional

Struktur pengujian tetap. Update ekspektasi pada panel metrik jika black-box test memeriksa angka UI.

### 4.11 Pembahasan Hasil

Wajib ubah:

- Hapus pembahasan dataset sangat tidak seimbang.
- Tulis bahwa dataset lebih seimbang karena data `merged_extra` dihapus.
- Tetap bahas bias sumber karena sumber label `not_hoax` dan `hoax` berbeda.
- Bahas performa tinggi dengan kehati-hatian karena split random bukan group split.
- Bahas DBCV negatif tipis secara hati-hati.
- Bahas outlier rate yang lebih rendah, tetapi tetap ada outlier.

### 4.12 Keterbatasan Sistem

Tetap:

- Tidak ada evidence retrieval.
- Bukan verifikasi fakta absolut.
- Tidak ada dataset training berlabel kalimat eksplisit.
- Tidak ada group split.
- Bias sumber tetap.
- Sistem prototype web.

Update:

- Dataset lebih kecil dari versi lama, sehingga generalisasi perlu diuji ulang lintas sumber/waktu.
- Oversampling tidak ekstrem; class imbalance bukan risiko utama seperti versi lama.

---

## 9. Detail Revisi BAB V

### Kesimpulan yang Harus Diubah

1. **Kesimpulan poin 2**
   - Ganti semua metrik test:
     - accuracy 0,996748
     - precision hoax 0,999439 untuk default, atau 0,998880 untuk threshold runtime 0,30
     - recall hoax 0,993865 default, atau 0,994423 threshold runtime
     - F1 hoax 0,996644 default, atau 0,996646 threshold runtime
     - weighted F1 0,996748
     - AUC 0,999817
   - Pilih satu basis pelaporan dan konsisten. Rekomendasi: gunakan metrik default pada tabel evaluasi utama, lalu jelaskan threshold runtime secara terpisah. Untuk sistem runtime, boleh gunakan metrik threshold 0,30.

2. **Kesimpulan poin 3**
   - Ganti threshold 0,34 menjadi 0,30.
   - Hapus pembahasan bahwa threshold 0,50 sedikit lebih baik pada test jika tidak didukung notebook terbaru.

3. **Kesimpulan poin 5**
   - Ganti:
     - coherence c_v 0,520257,
     - DBCV sampled -0,013278,
     - outlier rate 21,90%,
     - topik final 79.
   - Ubah interpretasi: struktur topik masih dapat digunakan untuk interpretasi, tetapi DBCV negatif tipis menunjukkan kualitas cluster berbasis densitas belum ideal secara absolut.

### Saran yang Tetap

- Dataset lebih beragam.
- Pengujian lintas sumber dan lintas waktu.
- Group split untuk penelitian lanjutan.
- Dataset berlabel kalimat eksplisit.
- Evidence retrieval sebagai pengembangan lanjutan.
- Segmentasi kalimat yang lebih kuat.
- Evaluasi usability.
- Deployment production.
- Logging/monitoring/database jika dikembangkan.

### Saran yang Perlu Disesuaikan

- Saran tentang “mengatasi ketidakseimbangan ekstrem” perlu diubah menjadi “membandingkan oversampling ringan dengan class weight atau tanpa balancing”.
- Saran BERTopic tetap, tetapi arahkan ke optimasi DBCV dan stabilitas cluster karena DBCV terbaru negatif tipis.

---

## 10. Dampak ke Diagram

| Diagram | Perlu Update Teks | Perlu Update Angka | Status |
|---|---|---|---|
| Kerangka Pemikiran | Tidak besar | Jika ada threshold lama, ganti | Umumnya tetap. |
| Alur Penelitian | Tidak besar | Jika ada angka dataset/threshold, update | Tetap secara alur. |
| Arsitektur Sistem | Tidak | Tidak | Tidak berubah. |
| Alur Praproses Data | Ya | Ya | Ubah 5 CSV menjadi 4 CSV; hapus `Summarized_2020+.csv`. |
| Alur Segmentasi Kalimat dan Paragraf | Tidak | Tidak | Tetap. |
| Alur Training IndoBERT | Ya | Ya | Update jumlah train, balancing, checkpoint bila ada. |
| Alur Kalibrasi Threshold dan Agregasi Verdict | Ya | Ya | Ganti threshold 0,34 menjadi 0,30. |
| Alur BERTopic | Ya | Ya | Update corpus 17.218, UMAP/HDBSCAN/vectorizer, guided false. |
| Alur Evaluasi BERTopic | Ya | Ya | Update coherence, DBCV, outlier rate, topik final. |
| Alur Inferensi Backend | Tidak besar | Threshold 0,30 | Perilaku mayoritas tetap. |
| Sequence Frontend–Backend | Tidak | Tidak | Tetap. |
| Deployment | Tidak | Tidak | Tetap Vercel + Hugging Face Spaces. |
| Use Case | Tidak | Tidak | Tetap. |
| Activity Diagram | Tidak | Tidak | Tetap. |
| Component Diagram | Tidak besar | Threshold jika tertulis | Komponen tetap. |

---

## 11. Dampak ke Screenshot dan `public/hasil`

Screenshot live website **perlu diambil ulang** jika screenshot lama menampilkan panel metrik evaluasi, threshold, tanggal training, atau visualisasi evaluasi. Alasannya:

1. Panel frontend terbaru menampilkan:
   - threshold runtime 0,30,
   - tanggal training 14 Mei 2026,
   - accuracy 99,67%,
   - F1 hoaks 99,66%,
   - AUC 99,98%,
   - precision 99,89%,
   - recall 99,44%,
   - weighted F1 99,67%,
   - coherence 0,5203,
   - DBCV -0,0133,
   - outlier rate 21,90%,
   - topik final 79.

2. Gambar artefak evaluasi yang perlu diganti atau dipastikan versi terbaru:
   - `public/hasil/distribusi_dataset.png`
   - `public/hasil/kurva_training.png`
   - `public/hasil/confusion_matrix_validation.png`
   - `public/hasil/confusion_matrix_test.png`
   - `public/hasil/confusion_matrix_threshold_optimal_validation.png`
   - `public/hasil/confusion_matrix_threshold_optimal_test.png`
   - `public/hasil/roc_curve_validation.png`
   - `public/hasil/roc_curve_test.png`
   - `public/hasil/kalibrasi_threshold_validation.png`
   - `public/hasil/distribusi_topik_bertopic.png`
   - `public/hasil/topik_per_label.png`
   - `public/hasil/ctfidf_heatmap.png`
   - `public/hasil/ctfidf_distribusi_topik.png`
   - `public/hasil/evaluasi_ctfidf_topik.csv`
   - `public/hasil/inference_config.json`

3. `public/hasil/inference_config.json` sudah sinkron dengan threshold runtime 0,30 dan training date 2026-05-14.

4. `README.md` belum sepenuhnya sinkron karena masih menyebut threshold dan angka lama pada beberapa bagian. Jangan gunakan README sebagai sumber angka final.

---

## 12. Daftar Angka Final yang Direkomendasikan untuk Dikunci

| Item | Nilai Final Baru | Sumber |
|---|---:|---|
| Dataset Kaggle | `fjrmhri/dataset-skripsi` | `Final_V4_DBCS.ipynb` terbaru |
| File dataset | `CNN.csv`, `Detik.csv`, `Kompas.csv`, `TurnBackHoax.csv` | `Final_V4_DBCS.ipynb` terbaru |
| `Summarized_2020+.csv` | Tidak dipakai | `Final_V4_DBCS.ipynb` terbaru |
| Total data mentah | 24.675 | `Final_V4_DBCS.ipynb` terbaru |
| Baris teks kosong dibuang | 0 | `Final_V4_DBCS.ipynb` terbaru |
| Label NaN dibuang | 0 | `Final_V4_DBCS.ipynb` terbaru |
| Duplikat `(text,label)` dihapus | 77 | `Final_V4_DBCS.ipynb` terbaru |
| Konflik label | 0 | `Final_V4_DBCS.ipynb` terbaru |
| Data bersih | 24.598 | `Final_V4_DBCS.ipynb` terbaru |
| `not_hoax = 0` | 12.645 | `Final_V4_DBCS.ipynb` terbaru |
| `hoax = 1` | 11.953 | `Final_V4_DBCS.ipynb` terbaru |
| Rasio hoaks | 48,6% | `Final_V4_DBCS.ipynb` terbaru |
| Train | 17.218 | `Final_V4_DBCS.ipynb` terbaru |
| Validation | 3.690 | `Final_V4_DBCS.ipynb` terbaru |
| Test | 3.690 | `Final_V4_DBCS.ipynb` terbaru |
| Train label 0 sebelum balancing | 8.851 | `Final_V4_DBCS.ipynb` terbaru |
| Train label 1 sebelum balancing | 8.367 | `Final_V4_DBCS.ipynb` terbaru |
| Train label 0 setelah balancing | 8.851 | `Final_V4_DBCS.ipynb` terbaru |
| Train label 1 setelah balancing | 8.851 | `Final_V4_DBCS.ipynb` terbaru |
| Total train setelah balancing | 17.702 | `Final_V4_DBCS.ipynb` terbaru |
| Corpus BERTopic | 17.218 | `Final_V4_DBCS.ipynb` terbaru |
| Model dasar | `indolem/indobert-base-uncased` | Notebook, `inference_config.json` |
| Model runtime | `fjrmhri/deteksi_hoaks_indobert` | `backend/app.py` |
| Max length | 256 | Notebook, `inference_config.json` |
| Threshold default | 0,50 | Notebook, `inference_config.json` |
| Threshold optimal/runtime | 0,30 | Notebook, `inference_config.json`, `backend/app.py`, `public/index.html` |
| Training date | 2026-05-14 | Notebook, `inference_config.json`, `public/index.html` |
| Checkpoint terbaik | `indobert_hoax_model_v3/checkpoint-186` | `Final_V4_DBCS.ipynb` terbaru |
| Validation accuracy default | 0,995393 | `Final_V4_DBCS.ipynb` terbaru |
| Validation precision hoax default | 0,998876 | `Final_V4_DBCS.ipynb` terbaru |
| Validation recall hoax default | 0,991634 | `Final_V4_DBCS.ipynb` terbaru |
| Validation F1 hoax default | 0,995242 | `Final_V4_DBCS.ipynb` terbaru |
| Validation weighted F1 default | 0,995392 | `Final_V4_DBCS.ipynb` terbaru |
| Validation AUC default | 0,999804 | `Final_V4_DBCS.ipynb` terbaru |
| Test accuracy default | 0,996748 | `Final_V4_DBCS.ipynb` terbaru |
| Test precision hoax default | 0,999439 | `Final_V4_DBCS.ipynb` terbaru |
| Test recall hoax default | 0,993865 | `Final_V4_DBCS.ipynb` terbaru |
| Test F1 hoax default | 0,996644 | `Final_V4_DBCS.ipynb` terbaru |
| Test weighted F1 default | 0,996748 | `Final_V4_DBCS.ipynb` terbaru |
| Test AUC default | 0,999817 | `Final_V4_DBCS.ipynb` terbaru |
| Validation F1 @0,30 | 0,995804 | `Final_V4_DBCS.ipynb` terbaru |
| Test F1 @0,30 | 0,996646 | `Final_V4_DBCS.ipynb` terbaru |
| BERTopic embedding model | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Notebook, `backend/app.py` |
| UMAP | n_neighbors 12, n_components 5, min_dist 0,0, metric cosine | `Final_V4_DBCS.ipynb` terbaru |
| HDBSCAN | min_cluster_size 12, min_samples 2, metric euclidean, selection leaf | `Final_V4_DBCS.ipynb` terbaru |
| CountVectorizer | ngram 1–2, min_df 3, max_df 0,75, max_features 20.000 | `Final_V4_DBCS.ipynb` terbaru |
| Guided topic modeling | Tidak aktif | `Final_V4_DBCS.ipynb` terbaru |
| Strategi final outlier | `reduce_probabilities` | `Final_V4_DBCS.ipynb` terbaru |
| Topik final non-outlier | 79 | Notebook, `public/index.html` |
| Dokumen outlier | 3.771 | Notebook, `public/index.html` |
| Outlier rate | 21,90% | Notebook, `public/index.html` |
| Coherence c_v | 0,520257 | Notebook, `public/index.html` |
| DBCV sampled | -0,013278 | Notebook, `public/index.html` |
| HDBSCAN relative validity | 0,218550 | `Final_V4_DBCS.ipynb` terbaru |
| c-TF-IDF rows | 790 | Notebook, `evaluasi_ctfidf_topik.csv` |
| c-TF-IDF columns | 9 | Notebook, `evaluasi_ctfidf_topik.csv` |
| Kata/frasa unik | 720 | `Final_V4_DBCS.ipynb` terbaru |
| Topic exclusivity | 0,913889 | `Final_V4_DBCS.ipynb` terbaru |
| Category exclusivity | 0,945833 | `Final_V4_DBCS.ipynb` terbaru |
| Keyword coverage | 0,069279 | `Final_V4_DBCS.ipynb` terbaru |

---

## 13. Risiko Metodologis Setelah Perubahan

1. **Data lebih kecil tetapi lebih mudah dipertanggungjawabkan.**  
   Penghapusan `Summarized_2020+.csv` mengurangi ukuran dataset secara besar, tetapi membuat dataset lebih jelas sumbernya: CNN, Detik, Kompas, dan TurnBackHoax.

2. **Risiko bias sumber tetap ada.**  
   Data non-hoaks berasal dari portal berita, sedangkan data hoaks berasal dari TurnBackHoax. Model masih berpotensi mempelajari gaya sumber, format narasi, atau karakter domain, bukan semata-mata ciri semantik hoaks.

3. **Data lebih seimbang sehingga oversampling tidak lagi ekstrem.**  
   Rasio hoaks 48,6% menunjukkan dataset bersih relatif seimbang. Oversampling hanya memperbaiki selisih kecil pada training set. Karena itu, pembahasan class imbalance harus lebih ringan.

4. **DBCV negatif tipis harus dibaca hati-hati.**  
   Nilai DBCV `-0,013278` menunjukkan struktur densitas cluster belum ideal secara absolut. Namun, konfigurasi final dapat tetap dipertahankan sebagai kandidat terbaik secara komparatif karena outlier rate lebih rendah dan coherence cukup baik.

5. **Performa masih tinggi, tetapi tidak boleh diklaim mutlak.**  
   Metrik test tetap tinggi, tetapi split yang digunakan adalah stratified random split, bukan group split berbasis sumber/artikel. Generalisasi lintas sumber dan lintas waktu belum dapat dipastikan.

6. **Klaim tingkat kalimat tetap harus dibatasi.**  
   Dataset training tidak boleh diklaim sebagai dataset berlabel kalimat eksplisit. Tingkat kalimat merujuk pada segmentasi, inferensi, visualisasi, dan agregasi pada runtime sistem.

7. **README tidak boleh menjadi source of truth angka.**  
   README terbaru masih memiliki bagian threshold dan metrik yang tidak sinkron dengan `inference_config.json`, notebook terbaru, dan `public/index.html`.

---

## 14. Rekomendasi Urutan Revisi

1. Update `LOCKED_FACTS_SKRIPSI.md`.
2. Update `ABSTRAK_DAN_ABSTRACT.md`.
3. Update `BAB_III_Metodologi_Penelitian.md`.
4. Update `BAB_IV_Hasil_dan_Pembahasan.md`.
5. Update `BAB_V_Kesimpulan_dan_Saran.md`.
6. Update `BAB_I_Pendahuluan.md`.
7. Update `BAB_II_Landasan_Teori.md`.
8. Update `DIAGRAM_SKRIPSI_DETEKSI_HOAKS.md`.
9. Update `Blueprint_Skripsi_Deteksi_Hoaks.md`.
10. Update `AUDIT_KONSISTENSI_SKRIPSI.md` sebagai audit final setelah semua revisi selesai.

---

## 15. Prompt Lanjutan untuk Rewrite

Gunakan prompt berikut setelah audit ini disetujui:

```text
Anda adalah academic thesis editor dan technical research analyst.

Saya sudah menyetujui audit `ANALISIS_DAMPAK_PERUBAHAN_DATA_DAN_TRAINING.md` dan ingin memperbarui dokumen skripsi berdasarkan eksperimen terbaru.

Gunakan `LOCKED_FACTS_SKRIPSI_REVISI_DRAFT.md` sebagai source of truth baru.

Tugas:
1. Perbarui `LOCKED_FACTS_SKRIPSI.md` menjadi versi final.
2. Perbarui `ABSTRAK_DAN_ABSTRACT.md`.
3. Perbarui BAB III sesuai dataset empat file, split, balancing ringan, threshold 0,30, checkpoint 186, dan BERTopic terbaru.
4. Perbarui BAB IV dengan semua tabel metrik IndoBERT, threshold calibration, evaluasi BERTopic, c-TF-IDF, frontend metrics, dan pembahasan risiko metodologis terbaru.
5. Perbarui BAB V dengan angka terbaru dan interpretasi DBCV negatif tipis.
6. Perbarui BAB I dan BAB II hanya pada bagian yang terdampak.
7. Perbarui diagram dan blueprint yang mengandung angka lama.
8. Buat audit konsistensi akhir baru.

Aturan:
- Jangan memakai angka lama kecuali sebagai catatan historis.
- Jangan mengklaim group split, evidence retrieval, dataset training berlabel kalimat eksplisit, atau verifikasi fakta absolut.
- Gunakan DBCV, bukan DBCS, kecuali ketika menyebut nama file notebook.
- Gunakan Bahasa Indonesia akademik.
```

---

## Keputusan Audit

Perubahan eksperimen terbaru berdampak **besar** pada naskah skripsi. Dokumen yang paling perlu diperbarui adalah `LOCKED_FACTS_SKRIPSI.md`, `BAB_III_Metodologi_Penelitian.md`, `BAB_IV_Hasil_dan_Pembahasan.md`, `ABSTRAK_DAN_ABSTRACT.md`, `Blueprint_Skripsi_Deteksi_Hoaks.md`, dan `AUDIT_KONSISTENSI_SKRIPSI.md`.

Naskah tidak perlu diubah pada aspek judul, rumusan masalah inti, tujuan inti, teori utama, arsitektur sistem, endpoint backend, frontend statis, deployment, dan batasan metodologis utama. Yang harus diganti adalah seluruh angka dataset, split, balancing, threshold, metrik IndoBERT, evaluasi BERTopic, c-TF-IDF, dan screenshot/panel metrik frontend.
