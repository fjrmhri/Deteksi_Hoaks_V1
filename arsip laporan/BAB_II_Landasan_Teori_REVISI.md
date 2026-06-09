# BAB II
# LANDASAN TEORI

## 2.1 Tinjauan Pustaka

Tinjauan pustaka berfungsi untuk menunjukkan posisi penelitian ini terhadap penelitian terdahulu. Penelitian deteksi hoaks dan klasifikasi teks telah berkembang dari pendekatan berbasis fitur klasik, seperti TF-IDF dan *machine learning*, menuju pendekatan *deep learning* dan model bahasa pra-latih berbasis Transformer. Di sisi lain, penelitian pemodelan topik berkembang dari model probabilistik seperti LDA menuju pendekatan berbasis embedding seperti BERTopic. Penelitian ini berada pada irisan antara klasifikasi teks berbahasa Indonesia, fine-tuning IndoBERT, interpretabilitas keluaran melalui inferensi dan visualisasi tingkat kalimat, pemodelan topik BERTopic, serta implementasi sistem web berbasis API.

Zhou dan Zafarani (2020) meninjau deteksi berita palsu dari berbagai sudut, termasuk karakteristik konten, pola penyebaran, dan tantangan evaluasi. Kajian tersebut menunjukkan bahwa deteksi hoaks tidak cukup dilihat sebagai persoalan klasifikasi sederhana, karena sumber data, konteks sosial, dan pola distribusi informasi dapat memengaruhi performa model. Guo et al. (2022) membahas *automated fact-checking* sebagai rangkaian proses yang dapat mencakup deteksi klaim, pencarian bukti, dan verifikasi klaim. Penelitian ini tidak melakukan *evidence retrieval* atau verifikasi berbasis bukti eksternal, tetapi memanfaatkan dasar konseptual bahwa sistem pendukung deteksi hoaks perlu memberi keluaran yang dapat ditafsirkan pengguna.

Pada ranah klasifikasi teks, Minaee et al. (2021) menunjukkan bahwa *deep learning* banyak digunakan untuk berbagai tugas klasifikasi, termasuk analisis sentimen, klasifikasi dokumen, dan deteksi berita palsu. Nasir et al. (2021) mengusulkan pendekatan hibrida CNN-RNN untuk deteksi berita palsu. Pendekatan CNN-RNN dapat menangkap pola lokal dan urutan, tetapi model sekuensial tetap memiliki keterbatasan dalam menangkap hubungan jarak jauh secara efisien. Perkembangan Transformer yang diperkenalkan oleh Vaswani et al. (2017) menjadi dasar penting karena mekanisme *self-attention* memungkinkan model memperhitungkan relasi antarkata tanpa bergantung pada pemrosesan berurutan seperti RNN.

BERT yang diperkenalkan oleh Devlin et al. (2019) menggunakan Transformer encoder dan strategi pra-pelatihan dua arah sehingga dapat di-*fine-tune* untuk berbagai tugas NLP. Untuk konteks bahasa Indonesia, Koto et al. (2020) memperkenalkan IndoLEM dan IndoBERT sebagai sumber daya serta model bahasa untuk bahasa Indonesia. Wilie et al. (2020) melalui IndoNLU menyediakan benchmark pemahaman bahasa Indonesia yang memperkuat dasar penggunaan model pra-latih Indonesia. Cahyawijaya et al. (2023) melalui NusaCrowd menunjukkan bahwa pengembangan NLP untuk Indonesia dan kawasan Nusantara perlu mempertimbangkan keragaman bahasa, variasi sumber data, dan keterbatasan dataset.

Pada sisi pemodelan topik, Blei et al. (2003) memperkenalkan Latent Dirichlet Allocation (LDA) sebagai model probabilistik yang menganggap dokumen sebagai campuran topik dan topik sebagai distribusi kata. BERTopic yang diperkenalkan oleh Grootendorst (2022) memanfaatkan embedding dokumen, UMAP, HDBSCAN, dan c-TF-IDF untuk membentuk topik yang lebih mudah diinterpretasikan pada korpus modern. UMAP digunakan untuk reduksi dimensi embedding (McInnes et al., 2018), sedangkan HDBSCAN digunakan untuk clustering berbasis densitas yang dapat menghasilkan cluster berbentuk arbitrer dan outlier (McInnes et al., 2017). Untuk evaluasi cluster berbasis densitas, DBCV lebih sesuai daripada elbow method karena elbow method umumnya berkaitan dengan pemilihan jumlah cluster pada metode seperti K-Means, sedangkan HDBSCAN tidak mensyaratkan jumlah cluster eksplisit (Moulavi et al., 2014).

Evaluasi topik tidak cukup hanya mengandalkan jumlah topik. Newman et al. (2010) dan Röder et al. (2015) membahas *topic coherence* sebagai ukuran keterkaitan kata-kata dalam topik. Pada penelitian ini, coherence score digunakan untuk membaca kualitas keterkaitan kata dalam topik, sedangkan DBCV digunakan untuk membaca struktur cluster berbasis densitas. DBCV dapat bernilai negatif apabila struktur densitas antarcluster belum terpisah kuat; karena itu, nilai DBCV perlu dibaca bersama coherence, outlier rate, dan interpretasi kata topik. c-TF-IDF digunakan untuk membaca kata atau frasa yang paling membedakan setiap topik, bukan sebagai metrik klasifikasi hoaks.

Selain performa model, penelitian machine learning perlu memperhatikan validitas evaluasi. Kapoor dan Narayanan (2022) membahas risiko kebocoran data dan krisis reprodusibilitas pada sains berbasis machine learning. Dalam penelitian ini, langkah yang terverifikasi untuk mengurangi risiko kebocoran meliputi deduplikasi pasangan `(text,label)`, pemeriksaan konflik label, stratified random split sebelum oversampling, dan penerapan oversampling hanya pada training set. Namun, penelitian ini tidak mengklaim adanya group split berbasis artikel atau sumber karena proses tersebut tidak ditemukan sebagai fakta yang terverifikasi.

## 2.2 Dasar Teori

### 2.2.1 Hoaks dan Berita Palsu

Hoaks dapat dipahami sebagai informasi keliru atau menyesatkan yang disebarkan sehingga dapat memengaruhi persepsi pembaca. Dalam konteks berita, hoaks tidak selalu hanya berbentuk pernyataan eksplisit yang salah, tetapi dapat muncul dalam narasi, judul, pilihan kata, atau struktur penyajian yang menyesatkan. Oleh karena itu, deteksi hoaks berbasis teks perlu memperhatikan konteks bahasa dan sumber data.

### 2.2.2 Klasifikasi Teks

Klasifikasi teks adalah proses menetapkan satu atau lebih label pada dokumen berdasarkan pola yang dipelajari dari data berlabel. Pada penelitian ini, klasifikasi dilakukan secara biner dengan label teknis `not_hoax = 0` dan `hoax = 1`. Metrik evaluasi yang digunakan meliputi accuracy, precision, recall, F1-score, weighted F1, AUC, dan confusion matrix.

### 2.2.3 Transformer, BERT, dan IndoBERT

Transformer menggunakan mekanisme *self-attention* untuk memodelkan hubungan antarkata tanpa pemrosesan sekuensial seperti RNN. BERT merupakan model berbasis Transformer encoder yang dapat di-*fine-tune* untuk berbagai tugas NLP. IndoBERT adalah model bahasa pra-latih yang relevan untuk bahasa Indonesia dan digunakan sebagai model dasar penelitian ini melalui `indolem/indobert-base-uncased`.

### 2.2.4 Fine-Tuning

Fine-tuning adalah proses melatih ulang model pra-latih pada tugas spesifik. Dalam penelitian ini, IndoBERT di-*fine-tune* untuk klasifikasi biner hoaks dan non-hoaks. Fine-tuning memanfaatkan representasi bahasa yang telah dipelajari model dasar, kemudian menyesuaikannya terhadap data berita berbahasa Indonesia yang telah diberi label.

### 2.2.5 Tokenisasi dan Max Length

Tokenisasi mengubah teks menjadi representasi token yang dapat diproses model. Pada model BERT, tokenisasi menghasilkan `input_ids` dan `attention_mask`. Panjang input dibatasi menggunakan `max_length` agar sesuai dengan kapasitas model dan kebutuhan komputasi.

### 2.2.6 Oversampling

Oversampling adalah teknik menyeimbangkan kelas dengan menggandakan sampel dari kelas yang jumlahnya lebih kecil. Teknik ini lazim dipakai ketika distribusi kelas tidak seimbang. Pada penelitian ini, oversampling tetap digunakan walaupun ketimpangan tidak ekstrem, karena training set masih memiliki perbedaan jumlah antara label `not_hoax` dan `hoax`. Oversampling hanya boleh diterapkan pada training set agar validation set dan test set tetap mencerminkan distribusi data asli.

### 2.2.7 Threshold Klasifikasi

Model klasifikasi biner menghasilkan probabilitas. Threshold digunakan untuk mengubah probabilitas menjadi label. Threshold default umumnya 0,50, tetapi threshold dapat dikalibrasi pada validation set untuk mengoptimalkan metrik tertentu seperti F1-score kelas positif. Pada penelitian ini, threshold runtime dipilih berdasarkan validation set.

### 2.2.8 Segmentasi Kalimat dan Paragraf

Segmentasi kalimat dan paragraf digunakan untuk memecah teks panjang menjadi unit yang lebih kecil pada tahap inferensi. Segmentasi ini membantu sistem menampilkan highlight lokal dan mengagregasikan prediksi unit kalimat menjadi verdict dokumen. Segmentasi tidak berarti dataset pelatihan memiliki label kalimat eksplisit.

### 2.2.9 BERTopic

BERTopic adalah metode pemodelan topik berbasis embedding yang menggabungkan sentence embedding, UMAP, HDBSCAN, dan c-TF-IDF. Sentence embedding digunakan untuk merepresentasikan dokumen, UMAP mereduksi dimensi embedding, HDBSCAN membentuk cluster berbasis densitas, dan c-TF-IDF menghasilkan kata/frasa pembeda topik.

### 2.2.10 UMAP dan HDBSCAN

UMAP digunakan untuk mereduksi dimensi embedding agar struktur lokal dan global data lebih mudah diproses oleh algoritma clustering. HDBSCAN membentuk cluster berbasis densitas dan dapat menghasilkan outlier. HDBSCAN tidak memerlukan penentuan jumlah cluster secara eksplisit, sehingga evaluasi seperti DBCV lebih relevan dibanding elbow method.

### 2.2.11 c-TF-IDF

c-TF-IDF adalah varian TF-IDF yang diterapkan pada kumpulan dokumen per cluster/topik. Tujuannya adalah menemukan kata atau frasa yang paling membedakan suatu topik dibanding topik lain. Dalam penelitian ini, c-TF-IDF digunakan untuk interpretasi topik, bukan untuk menentukan label hoaks.

### 2.2.12 DBCV dan Coherence

DBCV mengukur validitas cluster berbasis densitas. Nilai DBCV dapat bernilai negatif, mendekati nol, atau positif. Nilai negatif tipis perlu dibaca hati-hati karena menunjukkan separasi densitas cluster belum ideal. Coherence mengukur keterkaitan kata-kata dalam topik. Kombinasi DBCV, coherence, outlier rate, dan inspeksi c-TF-IDF digunakan untuk membaca kualitas topic modeling secara lebih utuh.

### 2.2.13 FastAPI dan Frontend Statis

FastAPI adalah framework Python untuk membangun API yang ringan dan mendukung validasi request/response. Frontend statis berbasis HTML, CSS, dan JavaScript digunakan untuk menampilkan input teks, verdict, confidence, highlight, topik, dan panel evaluasi. Arsitektur ini memisahkan logika inferensi di backend dari antarmuka pengguna di frontend.

## 2.3 Kerangka Pemikiran

Penelitian ini berangkat dari kebutuhan sistem deteksi hoaks yang tidak hanya memberi label dokumen, tetapi juga memberikan konteks lokal melalui highlight kalimat/paragraf dan konteks tematik melalui BERTopic. IndoBERT dipilih untuk klasifikasi karena mampu merepresentasikan konteks bahasa Indonesia, sedangkan BERTopic dipakai untuk menampilkan topik global dan topik per paragraf. Sistem diintegrasikan ke backend FastAPI dan frontend statis agar hasil dapat digunakan melalui antarmuka web.

## Daftar Pustaka

Blei, D. M., Ng, A. Y., & Jordan, M. I. (2003). Latent Dirichlet allocation. *Journal of Machine Learning Research, 3*, 993–1022.

Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. *NAACL-HLT*.

Grootendorst, M. (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure. *arXiv preprint arXiv:2203.05794*.

Guo, Z., Schlichtkrull, M., & Vlachos, A. (2022). A survey on automated fact-checking. *Transactions of the Association for Computational Linguistics*.

Kapoor, S., & Narayanan, A. (2022). Leakage and the reproducibility crisis in ML-based science. *arXiv preprint*.

Koto, F., Rahimi, A., Lau, J. H., & Baldwin, T. (2020). IndoLEM and IndoBERT: A benchmark dataset and pre-trained language model for Indonesian NLP. *COLING*.

McInnes, L., Healy, J., & Astels, S. (2017). hdbscan: Hierarchical density based clustering. *Journal of Open Source Software*.

McInnes, L., Healy, J., & Melville, J. (2018). UMAP: Uniform Manifold Approximation and Projection for dimension reduction. *arXiv preprint*.

Minaee, S., Kalchbrenner, N., Cambria, E., Nikzad, N., Chenaghlu, M., & Gao, J. (2021). Deep learning based text classification: A comprehensive review. *ACM Computing Surveys*.

Moulavi, D., Jaskowiak, P. A., Campello, R. J. G. B., Zimek, A., & Sander, J. (2014). Density-based clustering validation. *SDM*.

Nasir, J. A., Khan, O. S., & Varlamis, I. (2021). Fake news detection: A hybrid CNN-RNN based deep learning approach. *International Journal of Information Management Data Insights*.

Newman, D., Lau, J. H., Grieser, K., & Baldwin, T. (2010). Automatic evaluation of topic coherence. *NAACL-HLT*.

Röder, M., Both, A., & Hinneburg, A. (2015). Exploring the space of topic coherence measures. *WSDM*.

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. *NeurIPS*.

Wilie, B., et al. (2020). IndoNLU: Benchmark and resources for evaluating Indonesian natural language understanding. *AACL-IJCNLP*.

Zhou, X., & Zafarani, R. (2020). A survey of fake news: Fundamental theories, detection methods, and opportunities. *ACM Computing Surveys*.
