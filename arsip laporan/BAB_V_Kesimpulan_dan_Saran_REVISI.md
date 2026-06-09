# BAB V
# KESIMPULAN DAN SARAN

Bab ini menyajikan kesimpulan dan saran berdasarkan hasil penelitian yang telah diuraikan pada bab sebelumnya. Kesimpulan disusun untuk menjawab rumusan masalah penelitian, sedangkan saran disusun sebagai arahan pengembangan lanjutan berdasarkan keterbatasan sistem dan hasil evaluasi yang telah diperoleh.

## 5.1 Kesimpulan

Berdasarkan implementasi, pengujian, dan pembahasan sistem deteksi hoaks berita berbahasa Indonesia berbasis fine-tuning IndoBERT pada tingkat kalimat dan pemodelan topik BERTopic, diperoleh beberapa kesimpulan sebagai berikut.

1. Fine-tuning IndoBERT berhasil diterapkan untuk klasifikasi berita berbahasa Indonesia ke dalam dua kelas, yaitu `hoax` dan `not_hoax`. Model dasar yang digunakan adalah `indolem/indobert-base-uncased`, sedangkan model runtime yang digunakan pada sistem web dimuat melalui `fjrmhri/deteksi_hoaks_indobert`. Proses pelatihan dilakukan setelah praproses data, pembagian dataset, dan penanganan perbedaan jumlah kelas melalui oversampling ringan hanya pada training set.

2. Dataset aktual berasal dari Kaggle `fjrmhri/dataset-skripsi` dan menggunakan empat file utama, yaitu `CNN.csv`, `Detik.csv`, `Kompas.csv`, dan `TurnBackHoax.csv`. Setelah praproses, dataset bersih berjumlah 24.598 data dengan distribusi `not_hoax` sebanyak 12.645 dan `hoax` sebanyak 11.953. Rasio hoaks sebesar 48,6% menunjukkan bahwa dataset relatif seimbang. Namun, hasil tetap perlu dibaca hati-hati karena data hoaks dan non-hoaks berasal dari jenis sumber berbeda.

3. Model IndoBERT dievaluasi menggunakan accuracy, precision, recall, F1-score, weighted F1, ROC/AUC, dan confusion matrix. Pada test set dengan threshold runtime 0,30, model menghasilkan accuracy sebesar 0,996748, precision kelas hoaks sebesar 0,998880, recall kelas hoaks sebesar 0,994423, F1-score kelas hoaks sebesar 0,996646, dan AUC sebesar 0,999817. Nilai tersebut menunjukkan performa klasifikasi yang tinggi pada dataset uji yang digunakan, tetapi tidak boleh ditafsirkan sebagai jaminan generalisasi lintas sumber karena split yang digunakan adalah stratified random split, bukan group split berbasis artikel atau sumber.

4. Threshold runtime sebesar 0,30 digunakan pada sistem berdasarkan hasil kalibrasi pada validation set. Pemilihan threshold dilakukan untuk mengoptimalkan F1-score kelas hoaks pada validation set. Pada validation set, threshold 0,30 menghasilkan F1 hoaks 0,995804. Pada test set, threshold yang sama menghasilkan F1 hoaks 0,996646. Dengan demikian, threshold 0,30 diposisikan sebagai konfigurasi runtime berbasis validasi.

5. Segmentasi kalimat dan paragraf berhasil diterapkan pada tahap runtime sistem untuk mendukung inferensi, visualisasi, highlight, dan agregasi verdict dokumen. Teks berita yang dimasukkan pengguna diproses menjadi paragraf dan kalimat, kemudian hasil prediksi pada unit kalimat digunakan untuk menampilkan bagian teks yang perlu dicermati serta membentuk verdict dokumen melalui agregasi. Istilah “tingkat kalimat” dalam penelitian ini merujuk pada segmentasi, inferensi, visualisasi, dan agregasi pada runtime sistem, bukan pada penggunaan dataset training berlabel kalimat eksplisit.

6. BERTopic berhasil digunakan sebagai pendukung interpretabilitas topik melalui sentence embedding, UMAP, HDBSCAN, dan c-TF-IDF. Pemodelan topik menggunakan 17.218 dokumen train pra-oversampling dan menghasilkan 79 topik final non-outlier. Evaluasi topik menghasilkan coherence c_v sebesar 0,520257, DBCV sampled sebesar -0,013278, outlier rate 21,90%, dan HDBSCAN relative validity 0,218550. Nilai DBCV negatif tipis menunjukkan bahwa struktur cluster berbasis densitas belum ideal secara absolut. Namun, coherence, outlier rate, dan hasil c-TF-IDF tetap menunjukkan bahwa BERTopic dapat digunakan sebagai informasi pendukung untuk memahami konteks tematik teks.

7. Sistem web berhasil mengintegrasikan model klasifikasi IndoBERT dan pemodelan topik BERTopic ke dalam arsitektur backend FastAPI dan frontend statis. Backend menangani segmentasi teks, inferensi model, thresholding, agregasi verdict, pemetaan topik, dan response JSON. Frontend menampilkan input berita, verdict dokumen, confidence, highlight kalimat atau paragraf, topik global, topik per paragraf, serta panel metrik evaluasi.

8. Sistem yang dikembangkan merupakan alat bantu deteksi berbasis model, bukan sistem verifikasi fakta absolut. Sistem tidak melakukan evidence retrieval, pencarian bukti eksternal, atau verifikasi klaim terhadap sumber primer. Oleh karena itu, output sistem harus dipahami sebagai prediksi model dan konteks topik yang dapat membantu pengguna melakukan penilaian awal, bukan sebagai keputusan final atas kebenaran suatu informasi.

## 5.2 Saran

Berdasarkan hasil penelitian dan keterbatasan sistem, beberapa saran pengembangan yang dapat dilakukan pada penelitian berikutnya adalah sebagai berikut.

1. Penelitian lanjutan disarankan menggunakan dataset yang lebih beragam, baik dari sisi sumber hoaks maupun non-hoaks. Keseimbangan sumber data penting untuk mengurangi risiko model mempelajari ciri sumber tertentu, seperti gaya penulisan, format narasi, atau pola metadata, bukan semata-mata karakteristik semantik hoaks.

2. Evaluasi model sebaiknya diperluas dengan pengujian lintas sumber dan lintas waktu. Pengujian lintas sumber dapat digunakan untuk menilai kemampuan model ketika menghadapi data dari media atau sumber cek fakta yang tidak muncul pada data pelatihan. Pengujian lintas waktu dapat digunakan untuk melihat ketahanan model terhadap perubahan isu, gaya narasi, dan topik berita.

3. Penelitian berikutnya disarankan menerapkan group split berbasis artikel, sumber, atau domain apabila metadata yang memadai tersedia. Strategi ini dapat membantu mengurangi risiko kebocoran pola sumber dan memberikan estimasi generalisasi yang lebih ketat dibanding stratified random split.

4. Jika penelitian ingin memperkuat klaim deteksi tingkat kalimat, dataset berlabel kalimat eksplisit perlu dibangun. Dataset tersebut dapat memuat anotasi kalimat yang mengandung klaim bermasalah, kalimat pendukung konteks, dan kalimat netral. Dengan demikian, evaluasi tingkat kalimat dapat dilakukan secara langsung, bukan hanya melalui inferensi dan visualisasi runtime.

5. Sistem dapat dikembangkan dengan modul evidence retrieval agar mampu mencari bukti eksternal dari sumber terpercaya. Pengembangan ini akan menggeser sistem dari klasifikasi hoaks berbasis teks menuju pendekatan fact-checking otomatis yang lebih lengkap, yaitu mencakup deteksi klaim, pencarian bukti, dan penilaian dukungan bukti terhadap klaim.

6. Penelitian berikutnya dapat membandingkan strategi oversampling ringan dengan class weight atau tanpa balancing. Perbandingan ini penting karena dataset terbaru relatif seimbang, sehingga perlu diketahui apakah balancing tetap memberikan manfaat yang signifikan terhadap performa kelas hoaks.

7. Pemodelan topik BERTopic dapat ditingkatkan melalui eksplorasi parameter UMAP, HDBSCAN, stopwords, dan strategi reduksi outlier. Perbaikan diarahkan terutama untuk meningkatkan stabilitas cluster dan nilai DBCV, mengingat nilai DBCV sampled pada eksperimen ini masih negatif tipis.

8. Evaluasi antarmuka pengguna perlu dilakukan melalui uji usability. Pengujian ini dapat menilai apakah verdict dokumen, highlight, confidence, topik global, dan topik per paragraf benar-benar membantu pengguna memahami hasil sistem.

9. Untuk deployment produksi, sistem perlu dilengkapi dengan monitoring, logging, rate limiting, dokumentasi API, serta mekanisme pembaruan model. Komponen tersebut belum menjadi fokus penelitian ini, tetapi penting untuk pengembangan sistem yang lebih stabil dan aman.
