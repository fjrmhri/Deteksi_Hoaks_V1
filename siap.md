# 1. GAMBARAN BESAR SISTEM

Sistem ini dibuat untuk membantu mendeteksi apakah sebuah berita atau potongan teks cenderung hoaks atau bukan. Inti utamanya ada pada model IndoBERT. IndoBERT dipakai sebagai “mesin keputusan” karena tugas utamanya memang menentukan label akhir: hoax atau not_hoax.

Selain itu, sistem ini juga memakai BERTopic. Perannya berbeda dengan IndoBERT. BERTopic tidak dipakai untuk memutuskan hoaks atau tidak, tetapi untuk membantu melihat berita itu cenderung membahas topik apa. Jadi kalau IndoBERT menjawab pertanyaan “ini hoaks atau bukan?”, maka BERTopic membantu menjawab “kalau dilihat dari isinya, berita ini dekat dengan tema apa?”.

Backend FastAPI menjadi penghubung antara pengguna dan model. Pengguna mengirim teks ke API, lalu backend meneruskan teks itu ke model, mengambil hasilnya, dan mengembalikan jawaban dalam format JSON. Jadi secara sederhana, sistem ini punya tiga bagian: IndoBERT sebagai model utama, BERTopic sebagai analisis tambahan, dan FastAPI sebagai jembatan layanan.

Kenapa dipakai IndoBERT dan BERTopic sekaligus? Karena dua alat ini menyelesaikan dua kebutuhan yang berbeda. IndoBERT kuat untuk klasifikasi, sedangkan BERTopic membantu interpretasi tema. Dengan kombinasi ini, sistem tidak hanya bisa memberi keputusan, tetapi juga memberi gambaran isi.

# 2. PENJELASAN KONSEP PENTING

## 2.1 Kenapa BERTopic tidak bisa memberi nama topik?

BERTopic sebenarnya tidak benar-benar “mengerti judul topik” seperti manusia. BERTopic hanya mengelompokkan dokumen yang mirip, lalu mencari kata-kata yang paling mewakili kelompok itu. Karena itu, hasil awalnya biasanya hanya berupa kumpulan kata, misalnya `corona, virus, covid, positif`.

Analoginya seperti ini: bayangkan ada banyak berita di meja, lalu seseorang diminta mengelompokkan berita yang isinya mirip. Setelah selesai, dia bisa bilang, “Kelompok ini sering berisi kata corona, virus, pasien.” Tetapi dia belum otomatis memberi nama “Kesehatan”. Nama seperti itu biasanya masih perlu ditentukan manusia atau aturan tambahan.

Itu juga alasan kenapa muncul `Topik Umum`. Kadang ada cluster yang isi katanya terlalu campur, terlalu umum, atau tidak cukup kuat untuk dimasukkan ke satu kategori tertentu. Daripada dipaksa masuk ke kategori yang salah, sistem menaruhnya di `Topik Umum`.

Karena itu, kategori manual tetap diperlukan. BERTopic membantu membentuk kelompok, tetapi manusia atau aturan tambahan masih perlu membantu memberi label kategori yang lebih mudah dipahami, seperti politik, kesehatan, ekonomi, atau kriminal.

## 2.2 Cara kerja IndoBERT

IndoBERT bisa dibayangkan sebagai model yang sudah belajar membaca dan memahami pola bahasa Indonesia. Saat diberi sebuah teks, IndoBERT tidak hanya melihat kata satu per satu, tetapi mencoba memahami konteks kalimat secara keseluruhan.

Ketika teks masuk, sistem mengubah teks itu menjadi bentuk yang bisa dibaca model. Lalu IndoBERT menghitung dua kemungkinan: seberapa besar peluang teks itu hoax, dan seberapa besar peluang teks itu not_hoax. Setelah itu, sistem membandingkan peluang hoax dengan threshold yang sudah ditentukan. Kalau peluang hoax melewati threshold, hasilnya hoax. Kalau tidak, hasilnya not_hoax.

Jadi IndoBERT bekerja seperti pembaca yang mencoba memahami isi kalimat, bukan sekadar menghitung kata-kata tertentu.

## 2.3 Cara kerja BERTopic

BERTopic bekerja seperti alat pengelompok berita. Kalau ada banyak berita yang isinya mirip, BERTopic akan berusaha menaruhnya dalam kelompok yang sama. Misalnya berita tentang corona, virus, pasien, dan lockdown cenderung akan berkumpul dalam kelompok yang mirip.

Kenapa bisa muncul banyak topik? Karena isi berita di data memang beragam. Ada berita tentang politik, kesehatan, kriminal, ekonomi, bencana, olahraga, dan lain-lain. Bahkan dalam satu tema besar pun bisa muncul beberapa subkelompok. Misalnya tema kesehatan bisa terpecah menjadi COVID, obat, kanker, dan masker.

Kenapa ada outlier `-1`? Karena tidak semua berita cocok dimasukkan ke cluster tertentu. Ada berita yang terlalu unik, terlalu campuran, atau tidak cukup dekat dengan kelompok mana pun. BERTopic lalu menaruhnya di `-1`, artinya “dokumen ini belum cocok masuk topik tertentu”.

## 2.4 Apa arti angka Topik, misalnya 21, 23, 40?

Angka-angka itu adalah ID cluster. Itu hanya penanda kelompok, bukan ranking.

Jadi `Topic 21` bukan berarti lebih penting dari `Topic 5`. Itu hanya nomor identitas supaya cluster bisa dibedakan.

Kenapa tidak berurutan rapi? Karena selama proses clustering, penggabungan topic, dan pembersihan, beberapa topic bisa hilang, bergabung, atau tidak dipakai lagi. Akibatnya, nomor yang tersisa bisa terlihat lompat-lompat.

Jadi kalau melihat angka topic, anggap saja seperti nomor loker. Fungsinya untuk identitas, bukan untuk menunjukkan urutan kualitas.

## 2.5 Cara kerja backend

Alurnya sederhana. Pengguna mengirim teks ke API. Backend menerima teks itu lalu menyiapkannya agar bisa dibaca model.

Setelah itu, teks masuk ke proses tokenisasi. Tokenisasi artinya teks dipecah menjadi bagian-bagian kecil yang bisa dipahami oleh model. Lalu hasil tokenisasi diberikan ke IndoBERT.

IndoBERT mengeluarkan probabilitas dua kelas: hoax dan not_hoax. Backend kemudian membaca `threshold_optimal` dari `inference_config.json`, yaitu `0.79`. Kalau probabilitas hoax sama dengan atau lebih besar dari 0.79, label akhirnya hoax. Kalau tidak, labelnya not_hoax.

Setelah label diputuskan, backend membungkus hasil itu menjadi output JSON. Di dalam JSON ada label akhir, confidence, dan probabilitas tiap kelas. Kalau endpoint analisis dipakai, backend juga bisa menambahkan hasil analisis kalimat atau topik.

Jadi kalau diceritakan seperti alur manusia: user kirim teks, API menerima, model membaca, threshold memutuskan, lalu API menjawab kembali.

# 3. PENJELASAN METRIK EVALUASI

**Confusion Matrix** adalah tabel untuk melihat seberapa banyak prediksi model yang benar dan salah. Isinya biasanya menunjukkan empat kemungkinan: berita hoaks yang ditebak hoaks, berita tidak hoaks yang ditebak tidak hoaks, berita tidak hoaks yang salah ditebak hoaks, dan berita hoaks yang salah ditebak tidak hoaks. Dari sini kita bisa tahu salah modelnya di mana.

**Accuracy** adalah persentase tebakan yang benar dari seluruh data. Kalau ada 100 berita dan 98 di antaranya ditebak benar, maka accuracy-nya 98%. Metrik ini mudah dipahami, tetapi tidak selalu cukup jika data tidak seimbang.

**Precision** menjawab pertanyaan: “Dari semua berita yang dituduh hoaks oleh model, berapa banyak yang benar-benar hoaks?” Precision penting kalau kita ingin sistem tidak asal menuduh berita normal sebagai hoaks.

**Recall** menjawab pertanyaan: “Dari semua berita hoaks yang benar-benar ada, berapa banyak yang berhasil ditangkap model?” Recall penting kalau kita ingin hoaks tidak banyak lolos.

**F1-score** adalah nilai yang mencoba menyeimbangkan precision dan recall. Kalau salah satu terlalu tinggi tetapi yang lain rendah, F1-score akan ikut terpengaruh. Karena itu, F1-score sering dipakai saat kita ingin melihat keseimbangan performa model.

**ROC Curve** adalah grafik yang menunjukkan bagaimana perilaku model berubah saat ambang keputusan diubah. Dengan kata lain, ROC Curve membantu melihat kemampuan model membedakan dua kelas pada berbagai threshold.

**AUC** adalah angka ringkas dari ROC Curve. Nilainya biasanya antara 0 dan 1. Semakin dekat ke 1, semakin baik kemampuan model membedakan hoaks dan non-hoaks.

**c-TF-IDF** adalah alat khusus di BERTopic untuk mencari kata yang paling mewakili suatu cluster. Misalnya kalau satu cluster banyak berisi berita tentang corona, virus, dan pasien, maka kata-kata itu akan mendapat skor tinggi. Jadi c-TF-IDF bukan untuk menilai akurasi, tetapi untuk membantu memahami isi topic.

# 4. KALIBRASI & THRESHOLD

Threshold adalah ambang batas keputusan. Dalam sistem ini, threshold dipakai untuk menentukan kapan probabilitas hoax dianggap cukup kuat untuk diberi label hoax.

Kenapa tidak langsung pakai 0.5? Karena 0.5 hanya nilai default umum. Nilai itu tidak otomatis menjadi nilai terbaik untuk semua model. Setiap model punya karakter yang berbeda, jadi threshold terbaik harus dicari dari hasil evaluasi.

Kenapa dipilih 0.79? Karena dari evaluasi pada beberapa threshold, nilai ini memberi trade-off yang paling masuk akal untuk model terbaru. Saat threshold dinaikkan ke 0.79, false positive turun. Artinya sistem jadi lebih jarang menuduh berita normal sebagai hoaks. Walaupun false negative sedikit naik, kenaikannya masih kecil dan masih bisa diterima.

Cara sistem mendapatkannya adalah dengan membandingkan beberapa threshold pada data validasi. Dari situ dilihat precision, recall, dan F1-score. Nilai 0.79 dipilih karena memberi keseimbangan yang baik untuk kebutuhan sistem.

Analoginya seperti alarm keamanan. Kalau alarm terlalu sensitif, angin sedikit saja bisa membuat alarm berbunyi. Itu seperti threshold terlalu rendah: banyak false positive. Kalau alarm terlalu tidak sensitif, orang masuk pun kadang tidak terdeteksi. Itu seperti threshold terlalu tinggi: false negative naik. Jadi threshold adalah pengaturan seberapa sensitif sistem dalam membuat keputusan.

# 5. MASALAH NYATA DI SISTEM

Sistem ini sudah kuat di sisi IndoBERT, tetapi masih punya kelemahan di sisi BERTopic. Outlier masih sekitar 40%, jadi cukup banyak dokumen yang belum masuk cluster dengan rapi. Ini menunjukkan bahwa topic modeling memang belum sempurna.

Topic 0 juga masih cukup besar. Artinya masih ada satu cluster yang isinya terlalu campur atau terlalu dominan, walaupun sekarang sudah diperlakukan sebagai noise topic supaya tidak merusak analisis utama.

Selain itu, masih banyak `Topik Umum`. Ini menunjukkan ada cukup banyak cluster yang belum punya identitas tema yang kuat. Jadi hasil BERTopic sudah lebih baik, tetapi belum benar-benar bersih.

Mapping kategori juga belum sempurna. Beberapa topic sudah masuk kategori yang masuk akal, tetapi masih ada topic yang terasa campuran atau belum pas.

Apakah ini normal? Untuk topic modeling, ini masih cukup normal. Topic modeling memang lebih sulit daripada klasifikasi dua kelas. Jadi keadaan ini bukan berarti sistem gagal, tetapi menunjukkan bahwa bagian BERTopic masih bisa ditingkatkan lagi. Yang penting, IndoBERT sebagai model utama sudah stabil dan akurat.

# 6. FAKTA PENTING

- IndoBERT adalah model utama untuk deteksi hoaks.
- BERTopic hanya fitur tambahan untuk analisis topik.
- Backend memakai FastAPI.
- Threshold optimal yang dipakai adalah `0.79`.
- Keputusan akhir hoax atau tidak ditentukan dengan threshold, bukan argmax mentah.
- Label utama sistem adalah `hoax` dan `not_hoax`.
- BERTopic menghasilkan ID cluster, bukan nama topik otomatis.
- `-1` pada BERTopic berarti outlier.
- `Topik Umum` dipakai untuk cluster yang belum cukup kuat dipetakan ke kategori spesifik.
- Hasil IndoBERT sangat kuat, sedangkan BERTopic masih perlu penyempurnaan.
- Sistem sudah hampir siap, tetapi belum sempurna di sisi analisis topik.

# 7. KEMUNGKINAN PERTANYAAN DOSEN

## 1. Apa itu hoaks?
Hoaks adalah informasi salah atau menyesatkan yang disebarkan seolah-olah benar.

## 2. Apa tujuan sistem yang Anda buat?
Tujuannya untuk mendeteksi apakah sebuah teks berita cenderung hoaks atau tidak, lalu memberi analisis topik tambahan.

## 3. Kenapa pakai IndoBERT?
Karena IndoBERT memang kuat untuk memahami bahasa Indonesia dan cocok untuk tugas klasifikasi teks.

## 4. Kenapa tidak pakai model yang lebih sederhana?
Model sederhana bisa dipakai, tetapi biasanya kurang kuat dalam memahami konteks kalimat dibanding IndoBERT.

## 5. Apa peran IndoBERT dalam sistem?
IndoBERT adalah model utama yang menentukan label akhir hoax atau not_hoax.

## 6. Apa peran BERTopic dalam sistem?
BERTopic dipakai untuk analisis topik, bukan untuk keputusan utama hoaks atau tidak.

## 7. Kenapa harus ada BERTopic kalau sudah ada IndoBERT?
Karena IndoBERT memberi keputusan, sedangkan BERTopic memberi gambaran tema isi berita.

## 8. Kenapa BERTopic tidak memberi nama topik otomatis?
Karena BERTopic hanya menghasilkan cluster dan kata-kata representatif, bukan nama kategori yang benar-benar dipahami seperti manusia.

## 9. Kenapa ada banyak Topik Umum?
Karena ada cluster yang katanya belum cukup kuat atau terlalu campur, sehingga lebih aman dimasukkan ke kategori umum.

## 10. Kenapa ada outlier -1?
Karena ada dokumen yang tidak cukup dekat dengan cluster mana pun, jadi dianggap outlier.

## 11. Apakah banyak outlier itu normal?
Masih cukup normal pada topic modeling, apalagi jika data sangat beragam. Tetapi tetap menunjukkan ruang perbaikan.

## 12. Apa arti angka topic seperti 21 atau 40?
Itu hanya ID cluster, bukan ranking dan bukan urutan kualitas.

## 13. Kenapa nomor topic bisa lompat-lompat?
Karena ada cluster yang digabung, dihapus, atau tidak aktif lagi setelah proses modeling.

## 14. Apa itu confusion matrix?
Confusion matrix adalah tabel yang menunjukkan jumlah prediksi benar dan salah untuk tiap kelas.

## 15. Kenapa tidak cukup pakai accuracy saja?
Karena accuracy tidak selalu menunjukkan kualitas model secara utuh, terutama jika distribusi kelas tidak seimbang.

## 16. Kenapa pakai F1-score?
Karena F1-score membantu melihat keseimbangan antara precision dan recall.

## 17. Apa itu precision?
Precision menunjukkan seberapa tepat model saat memberi label hoaks.

## 18. Apa itu recall?
Recall menunjukkan seberapa banyak hoaks yang berhasil ditangkap model.

## 19. Apa itu AUC?
AUC adalah ukuran seberapa baik model membedakan dua kelas secara umum.

## 20. Kenapa threshold tidak pakai 0.5?
Karena 0.5 hanya default. Threshold terbaik harus ditentukan dari evaluasi model terbaru.

## 21. Kenapa dipilih 0.79?
Karena nilai itu memberi trade-off yang lebih baik: false positive turun, sedangkan false negative hanya naik sedikit.

## 22. Apa dampak threshold yang lebih tinggi?
Sistem jadi lebih hati-hati menyebut hoaks, sehingga false positive turun, tetapi ada risiko false negative sedikit naik.

## 23. Apakah model ini overfitting?
Dari hasil evaluasi validasi dan test yang sama-sama sangat tinggi dan dekat, tanda overfitting berat tidak terlihat.

## 24. Bagaimana alur sistem bekerja?
User kirim teks ke API, backend memproses teks, IndoBERT menghitung probabilitas, threshold menentukan label, lalu API mengembalikan JSON.

## 25. Apa kelemahan sistem ini?
Kelemahan utamanya ada di BERTopic: outlier masih tinggi, topic umum masih banyak, dan mapping kategori belum sempurna.

## 26. Kalau data berubah, apa yang harus dilakukan?
Model perlu dievaluasi ulang, dan jika perubahan datanya besar, bisa perlu fine-tuning ulang atau penyesuaian threshold.

## 27. Bagaimana cara meningkatkan BERTopic?
Bisa dengan memperbaiki preprocessing, membersihkan noise lebih jauh, mengevaluasi merge topic, dan memperbaiki mapping kategori.

## 28. Apakah BERTopic bisa dipakai sebagai model utama?
Tidak disarankan untuk tugas ini. BERTopic lebih cocok sebagai alat analisis tema, bukan pengambil keputusan utama hoaks atau tidak.

## 29. Kenapa IndoBERT dianggap model utama?
Karena IndoBERT langsung dilatih untuk tugas klasifikasi hoaks, sehingga perannya paling penting dalam hasil akhir sistem.

## 30. Kesimpulan singkat proyek ini apa?
IndoBERT sudah sangat kuat untuk deteksi hoaks, backend sudah sinkron dengan threshold optimal, dan BERTopic sudah membantu analisis, tetapi masih perlu penyempurnaan.
