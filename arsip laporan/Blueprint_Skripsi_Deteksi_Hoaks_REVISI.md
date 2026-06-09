# Blueprint Skripsi Deteksi Hoaks Berita Berbahasa Indonesia Berbasis Fine-Tuning IndoBERT pada Tingkat Kalimat dan Pemodelan Topik BERTopic_REVISI

## Catatan Validasi Sumber

Blueprint revisi ini disusun berdasarkan:

1. `LOCKED_FACTS_SKRIPSI_REVISI_FINAL.md`
2. `ANALISIS_DAMPAK_PERUBAHAN_DATA_DAN_TRAINING.md`
3. `Final_V4_DBCS.ipynb` terbaru
4. Repository `fjrmhri/Deteksi_Hoaks_V1`
5. `BUKU PEDOMAN TUGAS AKHIR.pdf`
6. `Pra Proposal.pdf`
7. Dokumen lama BAB I–V, Abstrak, Diagram, dan Audit Konsistensi

Jika ada konflik, angka final mengikuti locked facts revisi final.

---

# 1. TL;DR

- Skripsi tetap berfokus pada sistem deteksi hoaks berita berbahasa Indonesia berbasis fine-tuning IndoBERT, inferensi/visualisasi tingkat kalimat runtime, dan pemodelan topik BERTopic.
- Dataset terbaru memakai Kaggle `fjrmhri/dataset-skripsi` dengan empat file: `CNN.csv`, `Detik.csv`, `Kompas.csv`, dan `TurnBackHoax.csv`.
- Data tambahan `Summarized_2020+.csv` tidak digunakan. Narasi `merged_extra` harus dihapus dari seluruh naskah.
- Data bersih terbaru berjumlah 24.598 dengan distribusi `not_hoax = 12.645` dan `hoax = 11.953`, sehingga dataset relatif seimbang.
- Split tetap stratified random split 70/15/15: train 17.218, validation 3.690, test 3.690.
- Oversampling hanya pada training set dan bersifat ringan: total train menjadi 17.702.
- Threshold runtime terbaru adalah 0,30.
- Pada test set dengan threshold 0,30, model memperoleh accuracy 0,996748, precision hoaks 0,998880, recall hoaks 0,994423, F1 hoaks 0,996646, dan AUC 0,999817.
- BERTopic memakai 17.218 dokumen train pra-oversampling, menghasilkan 79 topik final, coherence c_v 0,520257, DBCV sampled -0,013278, dan outlier rate 21,90%.
- DBCV negatif tipis wajib dibahas hati-hati: struktur cluster berbasis densitas belum ideal secara absolut, tetapi topik tetap dapat digunakan sebagai pendukung interpretabilitas.

---

# 2. Posisi Penelitian

Penelitian ini adalah penelitian aplikasi AI/NLP berbasis pengembangan sistem. Kontribusi utamanya bukan pada pembuatan dataset baru atau fact-checking berbasis bukti eksternal, melainkan pada integrasi:

1. fine-tuning IndoBERT untuk klasifikasi hoaks/non-hoaks,
2. segmentasi dan inferensi tingkat kalimat pada runtime,
3. agregasi prediksi kalimat menjadi verdict dokumen,
4. pemodelan topik BERTopic sebagai pendukung interpretabilitas,
5. backend FastAPI,
6. frontend statis HTML/CSS/JavaScript,
7. panel evaluasi dan artefak eksperimen.

---

# 3. Locked Numbers

| Kelompok | Nilai Kunci |
|---|---|
| Dataset | 24.675 mentah; 24.598 bersih; 77 duplikat dihapus; konflik label 0 |
| Label | `not_hoax = 12.645`; `hoax = 11.953`; rasio hoaks 48,6% |
| Split | train 17.218; validation 3.690; test 3.690 |
| Balancing | train setelah oversampling 17.702; label 0 = 8.851; label 1 = 8.851 |
| Model | `indolem/indobert-base-uncased`; runtime `fjrmhri/deteksi_hoaks_indobert` |
| Training | max_length 256; effective batch 192; LR 2e-5; epoch 3; seed 42; checkpoint 186 |
| Threshold | default 0,50; runtime 0,30 |
| Test @0,30 | accuracy 0,996748; precision 0,998880; recall 0,994423; F1 0,996646; AUC 0,999817 |
| BERTopic | 17.218 dokumen; 79 topik; 3.771 outlier; outlier rate 21,90% |
| Evaluasi topik | coherence 0,520257; DBCV -0,013278; relative validity 0,218550 |
| c-TF-IDF | 790 baris; 9 kolom; 720 kata/frasa unik; topic exclusivity 0,913889; category exclusivity 0,945833 |

---

# 4. Mapping Revisi BAB

| Bab/Dokumen | Fokus Revisi | Status Dampak |
|---|---|---|
| Abstrak/Abstract | Ganti threshold, metrik test, coherence, DBCV, outlier rate, dataset | BESAR |
| BAB I | Sesuaikan narasi dataset relatif seimbang dan empat sumber utama | SEDANG |
| BAB II | Lunakkan oversampling; tambahkan interpretasi DBCV negatif | RINGAN |
| BAB III | Ganti dataset, split, balancing, training config, BERTopic config | BESAR |
| BAB IV | Ganti semua tabel hasil, metrik, threshold, BERTopic, c-TF-IDF, frontend metrics | BESAR |
| BAB V | Ganti angka kesimpulan dan interpretasi DBCV | SEDANG |
| Diagram | Update diagram dataset, threshold, training, BERTopic, evaluasi BERTopic | SEDANG |
| Audit final | Audit ulang semua angka dan klaim | BESAR |

---

# 5. Rekomendasi Struktur BAB III

1. 3.1 Tinjauan Umum Objek Penelitian
2. 3.2 Metode Penelitian
3. 3.3 Pengumpulan Data
4. 3.4 Praproses Data
5. 3.5 Segmentasi Kalimat dan Paragraf
6. 3.6 Pembagian Dataset
7. 3.7 Penanganan Kelas Minoritas
8. 3.8 Perancangan Model IndoBERT
9. 3.9 Perancangan Pemodelan Topik BERTopic
10. 3.10 Perancangan Backend FastAPI
11. 3.11 Perancangan Frontend
12. 3.12 Rancangan Pengujian
13. 3.13 Rancangan Deployment

---

# 6. Rekomendasi Struktur BAB IV

1. 4.1 Implementasi Dataset dan Praproses
2. 4.2 Implementasi Fine-Tuning IndoBERT
3. 4.3 Hasil Evaluasi IndoBERT
4. 4.4 Kalibrasi Threshold
5. 4.5 Implementasi Pemodelan Topik BERTopic
6. 4.6 Evaluasi BERTopic
7. 4.7 Analisis c-TF-IDF
8. 4.8 Implementasi Backend FastAPI
9. 4.9 Implementasi Frontend dan Panel Metrik
10. 4.10 Pengujian Fungsional Sistem
11. 4.11 Pembahasan Hasil
12. 4.12 Keterbatasan

---

# 7. Daftar Tabel yang Direkomendasikan

| Lokasi | Nama Tabel |
|---|---|
| BAB III | Komponen objek penelitian |
| BAB III | Sumber dataset penelitian |
| BAB III | Distribusi sumber data |
| BAB III | Ringkasan praproses data |
| BAB III | Distribusi label data bersih |
| BAB III | Split train/validation/test |
| BAB III | Distribusi training sebelum dan setelah balancing |
| BAB III | Konfigurasi training IndoBERT |
| BAB III | Konfigurasi BERTopic |
| BAB III | Endpoint backend |
| BAB IV | Hasil preprocessing dataset |
| BAB IV | Distribusi label |
| BAB IV | Distribusi sumber |
| BAB IV | Statistik panjang teks |
| BAB IV | Split train/validation/test |
| BAB IV | Balancing training set |
| BAB IV | Konfigurasi training IndoBERT |
| BAB IV | Metrik validation/test default |
| BAB IV | Evaluasi threshold validation/test |
| BAB IV | Konfigurasi BERTopic |
| BAB IV | Evaluasi BERTopic |
| BAB IV | Ringkasan c-TF-IDF |
| BAB IV | Endpoint backend |
| BAB IV | Panel metrik frontend |
| BAB IV | Pengujian black-box |

---

# 8. Daftar Gambar yang Direkomendasikan

| Lokasi | Gambar |
|---|---|
| BAB II | Kerangka pemikiran penelitian |
| BAB III | Arsitektur umum objek penelitian |
| BAB III | Alur penelitian |
| BAB III | Alur praproses data |
| BAB III | Alur training IndoBERT |
| BAB III | Alur BERTopic |
| BAB IV | Distribusi dataset |
| BAB IV | Kurva training |
| BAB IV | Confusion matrix validation/test |
| BAB IV | ROC curve validation/test |
| BAB IV | Kalibrasi threshold validation |
| BAB IV | Distribusi topik BERTopic |
| BAB IV | Topik per label |
| BAB IV | Heatmap c-TF-IDF |
| BAB IV | Distribusi c-TF-IDF |
| BAB IV | Screenshot halaman utama |
| BAB IV | Screenshot hasil analisis |
| BAB IV | Screenshot panel metrik evaluasi |

---

# 9. Risiko Metodologis

1. Dataset lebih kecil tetapi lebih mudah dipertanggungjawabkan karena tidak memakai data tambahan besar.
2. Risiko bias sumber tetap ada karena kelas `not_hoax` dan `hoax` berasal dari jenis sumber berbeda.
3. Oversampling tidak lagi ekstrem; narasi imbalance harus dilunakkan.
4. Performa klasifikasi sangat tinggi, tetapi tetap dibaca hati-hati karena split random.
5. DBCV negatif tipis menunjukkan struktur cluster densitas belum ideal secara absolut.
6. BERTopic tetap berguna untuk interpretabilitas karena coherence, outlier rate, dan c-TF-IDF masih informatif.
7. Sistem tidak melakukan evidence retrieval dan tidak boleh ditulis sebagai verifikasi fakta absolut.
8. Klaim tingkat kalimat harus dibatasi pada runtime.

---

# 10. Rekomendasi Penulisan

- Gunakan istilah `hoaks` untuk narasi, `hoax` hanya untuk label teknis.
- Gunakan `not_hoax = 0` dan `hoax = 1` pada tabel teknis.
- Gunakan `DBCV`, bukan `DBCS`, kecuali menyebut nama file `Final_V4_DBCS.ipynb`.
- Hindari klaim “dataset sangat tidak seimbang”.
- Hindari klaim “training tingkat kalimat”.
- Hindari klaim “sistem memverifikasi fakta”.
- Tulis bahwa sistem adalah alat bantu prediksi berbasis model.
- Semua screenshot panel metrik harus diambil ulang setelah frontend menampilkan angka terbaru.
