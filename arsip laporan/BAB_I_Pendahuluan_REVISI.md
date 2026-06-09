# BAB I
# PENDAHULUAN

## 1.1 Latar Belakang

Penyebaran hoaks berbahasa Indonesia masih menjadi permasalahan penting dalam ekosistem informasi digital. Informasi keliru dapat beredar dalam bentuk berita, judul, narasi panjang, potongan teks, maupun pesan yang disebarkan ulang melalui berbagai kanal digital. Narasi yang tampak meyakinkan dapat memengaruhi persepsi dan keputusan masyarakat, terutama ketika berkaitan dengan isu kesehatan, politik, bencana, keamanan publik, dan isu sosial lain yang memiliki dampak langsung terhadap kehidupan masyarakat. Dalam konteks tersebut, deteksi hoaks berbasis teks menjadi salah satu pendekatan yang relevan untuk membantu pengguna memperoleh indikasi awal terhadap kebenaran suatu informasi.

Secara umum, deteksi hoaks dapat dipandang sebagai bagian dari klasifikasi teks, yaitu proses menetapkan label terhadap teks berdasarkan pola yang dipelajari dari data berlabel. Pendekatan klasik seperti TF-IDF, n-gram, Support Vector Machine, dan Naive Bayes dapat digunakan untuk klasifikasi teks, tetapi representasinya cenderung bertumpu pada kemunculan kata dan belum sepenuhnya menangkap konteks semantik yang lebih kompleks. Kajian deteksi berita palsu juga menunjukkan bahwa persoalan hoaks tidak hanya berkaitan dengan pemisahan label benar dan salah, tetapi juga dipengaruhi oleh karakter konten, konteks, sumber data, dan validitas proses evaluasi model (Zhou & Zafarani, 2020). Oleh karena itu, pengembangan sistem deteksi hoaks perlu memperhatikan kemampuan model dalam memahami konteks bahasa serta batasan metodologis dari data yang digunakan.

Perkembangan model bahasa pra-latih berbasis Transformer memberikan peluang untuk meningkatkan performa klasifikasi teks. Transformer menggunakan mekanisme *self-attention* untuk memodelkan hubungan antarkata secara fleksibel (Vaswani et al., 2017). BERT kemudian memperkenalkan model bahasa pra-latih berbasis Transformer encoder yang dapat di-*fine-tune* untuk berbagai tugas pemrosesan bahasa alami (Devlin et al., 2019). Untuk bahasa Indonesia, IndoBERT menjadi relevan karena dikembangkan dalam konteks sumber daya bahasa Indonesia dan telah digunakan sebagai dasar eksperimen NLP Indonesia (Koto et al., 2020). Dengan demikian, fine-tuning IndoBERT dapat digunakan untuk membangun model klasifikasi hoaks dan non-hoaks pada teks berita berbahasa Indonesia.

Meskipun model klasifikasi dapat menghasilkan label akhir pada tingkat dokumen atau artikel, keluaran seperti itu belum selalu cukup bagi pengguna. Label akhir dapat memberi kesimpulan cepat, tetapi belum menunjukkan bagian teks mana yang perlu dicermati. Pada teks berita yang panjang, indikasi hoaks dapat muncul pada satu atau beberapa kalimat tertentu, sementara bagian lain mungkin hanya berisi konteks umum. Oleh karena itu, penelitian ini menekankan kebutuhan keluaran yang lebih interpretatif melalui segmentasi, inferensi, visualisasi, dan agregasi berbasis kalimat pada saat sistem berjalan. Istilah “tingkat kalimat” dalam penelitian ini digunakan secara hati-hati, yaitu merujuk pada proses runtime sistem yang memecah teks menjadi kalimat, melakukan prediksi terhadap unit kalimat, menampilkan *highlight*, dan mengagregasikan hasilnya menjadi verdict dokumen. Penelitian ini tidak mengklaim bahwa dataset pelatihan merupakan dataset berlabel kalimat secara eksplisit.

Selain informasi label dan *highlight*, konteks topik juga penting untuk membantu pengguna memahami tema utama dari teks yang dianalisis. Pemodelan topik dapat digunakan untuk mengekstraksi tema dari kumpulan dokumen atau teks. BERTopic merupakan metode pemodelan topik yang memanfaatkan *sentence embedding*, reduksi dimensi, clustering, dan c-TF-IDF untuk menghasilkan topik serta kata atau frasa pembeda (Grootendorst, 2022). Pada penelitian ini, BERTopic digunakan sebagai pendukung interpretabilitas topik, bukan sebagai penentu label hoaks. Informasi topik global dan topik per paragraf diharapkan dapat membantu pengguna memahami konteks tematik dari teks berita yang dianalisis.

Dari sisi implementasi, model deteksi hoaks perlu dikemas dalam sistem yang dapat digunakan secara praktis. Oleh karena itu, penelitian ini mengembangkan sistem web yang terdiri atas backend FastAPI dan frontend web statis. Backend berperan menerima teks berita, melakukan segmentasi paragraf dan kalimat, menjalankan model IndoBERT, menerapkan threshold, melakukan agregasi verdict, serta menyediakan response dalam format JSON. Frontend berperan menyediakan antarmuka input berita, menampilkan statistik teks, verdict dokumen, confidence, *highlight* kalimat atau paragraf, topik global, topik per paragraf, dan panel metrik evaluasi.

Validitas evaluasi juga menjadi perhatian dalam penelitian berbasis machine learning. Dataset aktual penelitian ini menggunakan empat sumber utama, yaitu CNN, Detik, Kompas, dan TurnBackHoax. Penghapusan data tambahan `Summarized_2020+.csv` membuat jumlah data lebih kecil, tetapi sumber data menjadi lebih mudah dipertanggungjawabkan. Setelah pembersihan, distribusi label relatif seimbang dengan rasio hoaks 48,6%. Meskipun demikian, risiko bias sumber tetap ada karena data non-hoaks berasal dari portal berita, sedangkan data hoaks berasal dari TurnBackHoax. Pada penelitian ini, pembagian dataset dilakukan menggunakan stratified random split, oversampling ringan hanya diterapkan pada training set, dan hasil evaluasi dibahas dengan mempertimbangkan bias sumber serta keterbatasan split random. Dengan demikian, sistem yang dikembangkan diposisikan sebagai alat bantu deteksi berbasis model, bukan sebagai sistem verifikasi fakta absolut.

Berdasarkan uraian tersebut, penelitian ini mengembangkan sistem deteksi hoaks berita berbahasa Indonesia berbasis fine-tuning IndoBERT, inferensi dan visualisasi tingkat kalimat pada runtime sistem, serta pemodelan topik BERTopic. Sistem ini diharapkan dapat memberikan keluaran yang lebih informatif melalui verdict dokumen, probabilitas atau confidence, *highlight* bagian teks, topik global, dan topik per paragraf.

## 1.2 Identifikasi Masalah

Berdasarkan latar belakang yang telah diuraikan, identifikasi masalah pada penelitian ini adalah sebagai berikut.

1. Penyebaran hoaks berbahasa Indonesia dalam bentuk berita, narasi, judul, dan teks panjang masih menjadi masalah yang membutuhkan pendekatan analisis berbasis teks.
2. Sistem deteksi hoaks yang hanya memberikan label akhir pada tingkat dokumen belum cukup membantu pengguna mengetahui bagian kalimat atau paragraf yang perlu dicermati.
3. Diperlukan model klasifikasi yang mampu memanfaatkan konteks bahasa Indonesia, sehingga fine-tuning IndoBERT menjadi pendekatan yang relevan untuk dikaji.
4. Diperlukan mekanisme interpretasi hasil melalui segmentasi kalimat dan paragraf, *highlight*, confidence, topik global, dan topik per paragraf.
5. Diperlukan pemodelan topik untuk membantu membaca konteks tematik dari teks berita, tetapi topik tidak dapat dijadikan pengganti label klasifikasi hoaks.
6. Dataset hoaks dan non-hoaks memiliki risiko bias sumber karena berasal dari jenis sumber yang berbeda, sehingga hasil evaluasi model perlu ditulis secara hati-hati.
7. Sistem deteksi perlu diintegrasikan ke dalam aplikasi web agar model dapat digunakan melalui antarmuka yang lebih mudah diakses.

## 1.3 Rumusan Masalah

Rumusan masalah pada penelitian ini adalah sebagai berikut.

1. Bagaimana menerapkan fine-tuning IndoBERT untuk mendeteksi hoaks dan non-hoaks pada berita berbahasa Indonesia?
2. Bagaimana menerapkan segmentasi kalimat dan paragraf pada tahap inferensi dan visualisasi agar hasil deteksi lebih interpretatif bagi pengguna?
3. Bagaimana menerapkan BERTopic untuk menghasilkan konteks topik global dan topik per paragraf sebagai pendukung interpretabilitas sistem?
4. Bagaimana mengevaluasi performa model IndoBERT dan BERTopic pada dataset yang digunakan?
5. Bagaimana mengintegrasikan model IndoBERT dan BERTopic ke dalam sistem web berbasis backend FastAPI dan frontend statis?

## 1.4 Batasan Masalah

Batasan masalah pada penelitian ini adalah sebagai berikut.

1. Dataset aktual berasal dari Kaggle `fjrmhri/dataset-skripsi` dan hanya menggunakan empat file utama, yaitu `CNN.csv`, `Detik.csv`, `Kompas.csv`, dan `TurnBackHoax.csv`.
2. Data tambahan `Summarized_2020+.csv` tidak digunakan pada eksperimen terbaru.
3. Klasifikasi hanya dilakukan untuk dua label, yaitu `not_hoax = 0` dan `hoax = 1`.
4. Istilah tingkat kalimat merujuk pada segmentasi, inferensi, visualisasi, dan agregasi pada runtime sistem, bukan dataset training berlabel kalimat eksplisit.
5. Pembagian data menggunakan stratified random split 70/15/15, bukan group split berbasis artikel, sumber, atau domain.
6. Oversampling hanya diterapkan pada training set. Validation set dan test set tidak di-oversampling.
7. Sistem tidak melakukan evidence retrieval, pencarian bukti eksternal, atau verifikasi klaim terhadap sumber primer.
8. BERTopic digunakan untuk interpretabilitas topik, bukan sebagai penentu label hoaks.
9. Sistem yang dikembangkan merupakan prototipe alat bantu deteksi berbasis model, bukan sistem verifikasi fakta absolut.

## 1.5 Tujuan Penelitian

Tujuan penelitian ini adalah sebagai berikut.

1. Menerapkan fine-tuning IndoBERT untuk klasifikasi hoaks dan non-hoaks pada berita berbahasa Indonesia.
2. Menerapkan segmentasi kalimat dan paragraf pada tahap inferensi dan visualisasi sistem.
3. Menerapkan agregasi hasil prediksi kalimat menjadi verdict dokumen.
4. Menerapkan BERTopic untuk menghasilkan topik global dan topik per paragraf sebagai pendukung interpretabilitas.
5. Mengevaluasi performa IndoBERT menggunakan accuracy, precision, recall, F1-score, weighted F1, AUC, dan confusion matrix.
6. Mengevaluasi BERTopic menggunakan coherence score, DBCV, outlier rate, dan analisis c-TF-IDF.
7. Mengintegrasikan model klasifikasi dan pemodelan topik ke dalam sistem web berbasis FastAPI dan frontend statis.

## 1.6 Manfaat Penelitian

Manfaat penelitian ini adalah sebagai berikut.

1. Memberikan kontribusi implementasi sistem deteksi hoaks berbahasa Indonesia berbasis model bahasa pra-latih IndoBERT.
2. Menyediakan rancangan keluaran yang lebih interpretatif melalui highlight kalimat/paragraf, confidence, dan konteks topik.
3. Menjadi referensi teknis untuk pengembangan sistem NLP berbasis backend FastAPI dan frontend statis.
4. Menyediakan pembahasan metodologis mengenai risiko bias sumber, split random, oversampling ringan, dan interpretasi evaluasi topic modeling.
5. Menjadi dasar pengembangan lanjutan menuju evaluasi lintas sumber, dataset berlabel kalimat eksplisit, atau integrasi evidence retrieval pada penelitian berikutnya.
