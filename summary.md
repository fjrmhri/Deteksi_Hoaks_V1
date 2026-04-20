# 1. PENDAHULUAN

Proyek ini dibuat untuk membantu proses deteksi hoaks pada berita berbahasa Indonesia dengan pendekatan pembelajaran mesin modern. Inti utama sistem adalah model IndoBERT yang berfungsi sebagai pengklasifikasi berita hoaks dan non-hoaks. Di samping itu, proyek ini juga dilengkapi dengan BERTopic sebagai fitur tambahan untuk membantu melihat pola topik, tema dominan, dan pengelompokan isi berita.

Pendekatan ini dipilih karena kebutuhan sistem tidak hanya berhenti pada keputusan akhir apakah suatu teks tergolong hoaks atau tidak, tetapi juga membutuhkan cara untuk memahami kecenderungan isi berita yang masuk. Dengan demikian, sistem ini tidak hanya bersifat prediktif, tetapi juga analitis. Hasil akhirnya adalah sebuah layanan backend berbasis FastAPI yang dapat menerima teks, menjalankan inferensi model, lalu mengembalikan hasil prediksi dalam bentuk yang dapat dipakai aplikasi lain.

# 2. ARSITEKTUR SISTEM

Arsitektur sistem dibangun dengan pembagian peran yang cukup jelas. Bagian pertama adalah model IndoBERT yang bertugas melakukan klasifikasi utama. Bagian kedua adalah BERTopic yang berfungsi sebagai analisis topik tambahan. Bagian ketiga adalah backend FastAPI yang menghubungkan input pengguna dengan model yang sudah dilatih. Di atas backend ini, sistem dapat menerima permintaan dari aplikasi atau pengguna lain melalui API.

Secara alur, teks berita pertama kali masuk ke backend. Setelah itu backend meneruskan teks ke model IndoBERT untuk mendapatkan probabilitas hoaks dan non-hoaks. Hasil probabilitas tersebut kemudian dibandingkan dengan threshold optimal yang disimpan pada file konfigurasi inferensi. Dari proses ini sistem menentukan label akhir. Jika diperlukan analisis tambahan, backend juga dapat memanggil BERTopic untuk membantu melihat kecenderungan topik dari teks atau paragraf yang diberikan.

Dengan desain seperti ini, IndoBERT tetap menjadi model utama untuk pengambilan keputusan, sedangkan BERTopic berperan sebagai alat bantu interpretasi. Pemisahan ini penting karena klasifikasi dan analisis topik memiliki tujuan yang berbeda. IndoBERT dipakai untuk menjawab pertanyaan “apakah teks ini hoaks atau tidak”, sedangkan BERTopic dipakai untuk menjawab pertanyaan “teks ini paling dekat dengan tema apa”.

# 3. PENJELASAN INDO-BERT

IndoBERT adalah model bahasa yang sudah terlebih dahulu belajar memahami pola bahasa Indonesia dari data yang sangat besar. Setelah itu model ini dilatih ulang secara khusus untuk tugas deteksi hoaks, sehingga ia tidak hanya memahami kata-kata, tetapi juga mulai mengenali pola kalimat, susunan narasi, dan kecenderungan bahasa yang sering muncul pada berita hoaks maupun berita non-hoaks.

Dalam proyek ini, IndoBERT menjadi inti keputusan sistem. Ketika ada teks baru masuk, model akan membaca teks tersebut dalam bentuk token, lalu menghitung peluang untuk dua kelas, yaitu hoax dan not_hoax. Keputusan akhir tidak langsung diambil dari tebakan terbesar secara mentah, tetapi menggunakan threshold optimal hasil evaluasi. Dengan cara ini, sistem menjadi lebih hati-hati dan lebih sesuai dengan kondisi model terbaru.

Keunggulan IndoBERT dalam proyek ini adalah kemampuannya memahami konteks kalimat dalam bahasa Indonesia dengan baik. Hal ini membuat model lebih kuat dibandingkan pendekatan yang hanya mengandalkan kata kunci. Selain itu, model ini juga stabil dari sisi evaluasi, sehingga layak dijadikan fondasi utama sistem.

# 4. PENJELASAN BERTopic

BERTopic digunakan sebagai fitur analisis topik untuk membantu melihat pengelompokan berita berdasarkan kemiripan isi. Jika IndoBERT berfokus pada keputusan klasifikasi, maka BERTopic berfokus pada struktur tema yang muncul di dalam kumpulan data. Dengan kata lain, BERTopic membantu membaca peta besar dari berita-berita yang ada.

Dalam pengerjaan proyek ini, BERTopic tidak dipakai untuk menggantikan IndoBERT. BERTopic hanya menjadi lapisan tambahan agar sistem lebih mudah dianalisis. Hasilnya berupa kelompok topik dengan kumpulan kata yang paling mewakili isi cluster tersebut. Dari sana, topik-topik itu kemudian dipetakan ke kategori yang lebih mudah dipahami, seperti kesehatan, politik, ekonomi, kriminal, internasional, dan lain-lain.

BERTopic juga mengalami beberapa perbaikan penting selama proyek ini berjalan. Tahap preprocessing diperketat agar kata-kata artifisial seperti “extra”, “com”, dan “news” tidak lagi mengganggu hasil topik. Selain itu, beberapa topik yang terlalu mirip juga digabung secara konservatif agar struktur hasil menjadi lebih rapi dan tidak terlalu terfragmentasi.

# 5. HASIL EVALUASI MODEL

Hasil evaluasi menunjukkan bahwa model IndoBERT berada pada kondisi yang sangat baik. Pada data validasi, model mencapai akurasi sekitar 0.9985 dengan F1-score kelas hoax sekitar 0.9891. Pada data uji, model mencapai akurasi sekitar 0.9983 dengan F1-score kelas hoax sekitar 0.9876. Nilai ini menunjukkan bahwa model mampu membedakan berita hoaks dan non-hoaks dengan konsisten.

Selain melihat akurasi umum, proyek ini juga melakukan kalibrasi threshold. Nilai default 0.5 tidak langsung dipakai begitu saja. Dari hasil evaluasi, threshold optimal yang dipilih adalah 0.79. Pada data validasi, threshold ini menaikkan F1-score hoax menjadi sekitar 0.9899. Pada data uji, threshold ini tetap menjaga performa dengan menurunkan false positive dan hanya menambah false negative dalam jumlah kecil. Dengan kata lain, sistem menjadi lebih hati-hati sebelum memberi label hoax.

Keputusan untuk memakai threshold 0.79 penting karena dalam konteks deteksi hoaks, kesalahan menuduh berita valid sebagai hoaks bisa cukup sensitif. Oleh sebab itu, sistem diatur agar lebih yakin terlebih dahulu sebelum menyatakan sebuah teks sebagai hoaks.

# 6. HASIL BERTopic

Setelah preprocessing diperbaiki dan beberapa topic digabung, hasil BERTopic menunjukkan perubahan yang cukup baik. Jumlah topic turun dari 80 menjadi 76 secara total, dengan 75 topic valid dan 1 kelompok outlier. Ini menunjukkan bahwa proses merge yang dilakukan memang berhasil mengurangi sebagian fragmentasi topik tanpa merusak struktur besarnya.

Dari sisi kualitas kata kunci, hasil terbaru jauh lebih bersih dibanding kondisi sebelumnya. Kata-kata artifisial yang dulu sering muncul kini tidak lagi dominan. Beberapa topic juga menjadi lebih mudah dipahami. Misalnya, cluster COVID menjadi lebih jelas melalui kata-kata seperti “corona”, “virus”, “virus corona”, “covid”, dan “positif”. Topic lain seperti politik, kriminal, bencana, kesehatan, dan pemerintahan juga mulai terlihat lebih koheren.

Namun, hasil BERTopic belum sepenuhnya sempurna. Topic 0 memang sudah diperlakukan sebagai topic noise agar tidak mendominasi visualisasi utama, tetapi ukurannya masih cukup besar. Selain itu, jumlah outlier juga masih tinggi. Beberapa topic juga masih jatuh ke kategori “Topik Umum” karena keyword yang muncul belum cukup kuat untuk dipetakan ke kategori yang lebih spesifik. Artinya, BERTopic pada proyek ini sudah berguna sebagai fitur analisis, tetapi belum sekuat model utama untuk pengambilan keputusan inti.

# 7. MASALAH YANG MASIH ADA

Masalah terbesar yang masih terlihat ada pada sisi BERTopic, bukan pada IndoBERT. Outlier masih tinggi, sehingga cukup banyak dokumen yang belum benar-benar masuk ke cluster yang rapi. Di samping itu, masih ada beberapa topic yang maknanya belum stabil atau masih terlalu umum. Hal ini terlihat dari banyaknya topic yang berakhir di kategori “Topik Umum”.

Masalah lain adalah masih adanya beberapa mapping kategori yang terasa belum ideal. Meskipun kasus-kasus salah mapping yang paling ekstrem sudah banyak berkurang, tetap ada topic yang secara semantik terlihat campuran atau kurang pas dengan kategori akhirnya. Ini menunjukkan bahwa analisis topik memang jauh lebih sulit dibanding klasifikasi dua kelas.

Pada sisi backend dan IndoBERT, masalah yang tersisa jauh lebih kecil. Logika inferensi sudah disinkronkan dengan threshold terbaru, output API sudah konsisten, dan model utama tidak memerlukan perubahan arsitektur lagi. Dengan demikian, area yang paling layak diperbaiki ke depan adalah interpretasi topik, bukan model klasifikasi utama.

# 8. KEPUTUSAN AKHIR SISTEM

Secara keseluruhan, sistem dapat dinilai hampir siap untuk penggunaan production ringan atau demonstrasi akademik yang serius. IndoBERT sebagai model utama sudah sangat stabil dan performanya tinggi. Threshold inferensi juga sudah disesuaikan dengan hasil evaluasi terbaru sehingga keputusan model lebih masuk akal untuk penggunaan nyata.

BERTopic dalam sistem ini sebaiknya diposisikan sebagai fitur analisis tambahan, bukan sebagai sumber keputusan utama. Hasilnya sudah cukup membantu untuk eksplorasi tema berita dan interpretasi cluster, tetapi masih belum sepenuhnya bersih untuk dijadikan dasar keputusan otomatis yang sangat ketat. Oleh karena itu, keputusan akhir sistem adalah mempertahankan IndoBERT sebagai mesin utama deteksi hoaks, sementara BERTopic dipakai untuk mendukung analisis dan penjelasan tema.

# 9. PEMBELAJARAN PRIBADI

Selama mengerjakan proyek ini, saya belajar bahwa model yang akurat tidak selalu langsung berarti sistemnya selesai. Setelah model berhasil dilatih, masih ada pekerjaan penting lain seperti evaluasi ulang, kalibrasi threshold, penyelarasan backend, dan pemeriksaan apakah output sistem benar-benar sesuai dengan perilaku model terbaru. Dari sini saya memahami bahwa membangun sistem machine learning bukan hanya soal training, tetapi juga soal menjaga konsistensi dari data, model, konfigurasi, dan layanan API.

Saya juga belajar bahwa klasifikasi dan topic modeling adalah dua hal yang berbeda. Klasifikasi bisa sangat kuat untuk menjawab pertanyaan yang jelas, misalnya hoaks atau tidak. Sebaliknya, topic modeling lebih cocok untuk membantu memahami pola besar, tetapi hasilnya sering memerlukan interpretasi manusia. Dari pengalaman ini saya memahami bahwa tidak semua hasil model bisa langsung dianggap “jadi”, terutama saat model hanya menghasilkan kumpulan kata dan bukan nama topik yang benar-benar siap pakai.

Yang paling penting, proyek ini mengajarkan bahwa pendekatan yang stabil sering kali lebih baik daripada perubahan besar yang terlalu agresif. Perbaikan kecil tetapi aman, seperti membersihkan noise words, melakukan merge topic secara konservatif, dan menyinkronkan threshold ke backend, justru memberi dampak besar tanpa merusak sistem utama yang sudah berjalan baik.
