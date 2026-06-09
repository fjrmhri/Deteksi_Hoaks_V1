# Deteksi Hoaks Indonesia

## Ringkasan Proyek

Deteksi Hoaks Indonesia adalah sistem analisis berita berbahasa Indonesia yang memadukan klasifikasi hoaks berbasis IndoBERT dengan ekstraksi topik hibrida. Implementasi aktif di repository ini terdiri dari:

- backend inference berbasis FastAPI di folder `backend/`
- frontend statis berbasis HTML, CSS, dan JavaScript vanilla di folder `public/`
- artifact evaluasi dan analisis topik di folder `public/hasil/`

Input utama sistem adalah teks berita multi-paragraf. Backend memecah teks menjadi paragraf dan kalimat, menghitung probabilitas hoaks per kalimat, mengagregasikan verdict dokumen, lalu menurunkan topik per paragraf menggunakan kombinasi aturan kategori dan BERTopic. Frontend kemudian merender hasil tersebut sebagai highlight inline, banner verdict, dan rincian confidence.

## Arsitektur Sistem

Secara end-to-end, alurnya adalah sebagai berikut:

1. Pengguna menempelkan teks berita pada antarmuka di `public/index.html`.
2. `public/app.js` menormalkan paragraf, menghitung statistik input, lalu mengirim `POST /analyze` ke backend.
3. `backend/app.py` memuat model klasifikasi dari Hugging Face Hub melalui `AutoTokenizer` dan `AutoModelForSequenceClassification`.
4. Backend memecah teks menjadi paragraf dan kalimat, lalu melakukan inferensi per kalimat.
5. Label dokumen ditentukan dari agregasi hasil kalimat melalui majority vote dengan tie-breaking ke `hoax`.
6. Topik paragraf ditentukan secara hibrida:
   - rule-based matching melalui `PETA_KATEGORI`
   - fallback BERTopic + `SentenceTransformer` bila tidak ada kecocokan aturan
7. Backend mengembalikan struktur hasil yang mencakup `document`, `paragraphs`, `shared_topics`, `topics_global`, dan `meta`.
8. Frontend menampilkan verdict dokumen, highlight inline, ringkasan jumlah kalimat/paragraf, serta rincian confidence per unit teks.

Arsitektur ini memisahkan inference service dan UI secara tegas: backend berfokus pada prediksi dan struktur hasil, sedangkan frontend bertugas merender hasil serta menampilkan artifact evaluasi yang sudah tersedia di repository.

## Backend (`backend/`)

### Stack dan runtime

Backend dibangun dengan FastAPI dan dijalankan oleh Uvicorn. Dependensi utamanya di `backend/requirements.txt` mencakup:

- `fastapi`, `uvicorn[standard]`
- `transformers`, `torch`, `accelerate`
- `huggingface_hub`
- `bertopic`, `sentence-transformers`, `umap-learn`, `hdbscan`
- `numpy`, `pydantic`, `scikit-learn`

`backend/Dockerfile` menggunakan `python:3.11-slim`, memasang dependensi dari `requirements.txt`, lalu menjalankan `uvicorn app:app --host 0.0.0.0 --port 7860`.

### Cara model dimuat

`backend/app.py` memuat classifier dari `MODEL_ID`, dengan default:

- `MODEL_ID = fjrmhri/deteksi_hoaks_indobert`
- `MODEL_SUBFOLDER` opsional
- `MAX_LENGTH = 256`

Konfigurasi inferensi tambahan dibaca dari `inference_config.json`. Mekanismenya:

1. backend mencoba membaca `backend/inference_config.json`
2. bila tidak tersedia, backend fallback ke `public/hasil/inference_config.json`
3. bila file lokal tidak tersedia, backend mencoba mengambil `inference_config.json` dari Hugging Face Hub

Artifact `public/hasil/inference_config.json` saat ini memuat metadata berikut:

- `model_name`: `indolem/indobert-base-uncased`
- `metric_for_best_model`: `f1`
- `max_length`: `256`
- `threshold_default`: `0.5`
- `threshold_optimal`: `0.3`
- `transformers_version`: `5.0.0`
- `torch_version`: `2.10.0+cu128`
- `training_date`: `2026-05-14`

Backend juga memetakan label eksplisit ke skema:

- `0 -> not_hoax`
- `1 -> hoax`

### Endpoint utama

Implementasi aktif di `backend/app.py` menyediakan endpoint:

- `GET /`
  Mengembalikan metadata runtime seperti `model_id`, threshold, status BERTopic, dan daftar kategori rule-based.
- `GET /health`
  Health check sederhana dengan status backend dan kesiapan BERTopic.
- `POST /predict`
  Prediksi untuk satu teks.
- `POST /predict-batch`
  Prediksi batch untuk beberapa teks.
- `POST /analyze`
  Endpoint utama untuk analisis multi-paragraf. Responsnya mencakup hasil level dokumen, paragraf, kalimat, topik global, dan metadata inferensi.

### Logika inferensi dan agregasi

Pipeline inferensi aktif tidak berhenti pada level dokumen mentah. Backend melakukan:

1. pemisahan paragraf dengan blank line atau line break
2. pemisahan kalimat dengan regex
3. inferensi probabilitas per kalimat
4. penentuan label kalimat dengan threshold yang dapat dikonfigurasi
5. agregasi kembali ke level dokumen

Keputusan penting di sisi backend:

- Threshold utama label berasal dari `threshold_optimal` pada `inference_config.json`.
- Untuk teks sangat pendek, `_to_canonical_label` memakai threshold khusus `THRESH_KALIMAT_PENDEK = 0.70` jika jumlah kata di bawah `MIN_KATA_KALIMAT = 8`.
- `_aggregate_verdict` memakai majority vote per kalimat, dengan aturan tie `hoax`.
- `p_hoax_doc` dihitung sebagai rata-rata probabilitas hoaks seluruh kalimat.
- `confidence` dokumen diambil dari sisi yang menang:
  - bila verdict akhir `hoax`, confidence adalah rata-rata `P(hoax)` pada kalimat berlabel `hoax`
  - bila verdict akhir `not_hoax`, confidence adalah rata-rata `P(fakta)` pada kalimat berlabel `not_hoax`

Pendekatan ini dipakai agar satu kalimat ekstrem tidak langsung mendominasi verdict dokumen. Komentar implementasi di `backend/app.py` secara eksplisit menunjukkan bahwa aturan lama yang terlalu sensitif terhadap satu kalimat berprobabilitas sangat tinggi sudah diganti dengan agregasi mayoritas.

### Risk level

Backend juga menurunkan `risk_level` dan `risk_explanation` dari probabilitas hoaks dokumen:

- `high` jika `P(hoax) > THRESH_HIGH`
- `medium` jika `P(hoax)` melewati `max(THRESH_MED, threshold_optimal)`
- `low` selain itu

Selain itu, teks yang sangat pendek (`< 5 kata`) diberi peringatan tambahan karena prediksinya dianggap kurang stabil.

### Ekstraksi topik

Topik paragraf dihasilkan dengan strategi hibrida:

1. **Rule-based categorization**
   Fungsi `_kategorisasi_teks` mencocokkan teks paragraf terhadap `PETA_KATEGORI`. Peta ini berisi kategori seperti `Kesehatan`, `Politik`, `Ekonomi & Bisnis`, `Internasional`, `Pendidikan`, `Transportasi & Infrastruktur`, dan lainnya.

2. **Fallback BERTopic**
   Jika rule-based tidak menemukan kecocokan, backend memakai BERTopic dari `TOPIC_BERTOPIC_MODEL_ID = fjrmhri/deteksi_hoaks_bertopic` dan embedder `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.

3. **Fallback akhir**
   Jika inferensi topik tidak tersedia atau gagal, backend memakai `topik_umum`.

Metadata respons menandai strategi ini sebagai `topic_model_used = "bertopic+rules"`.

## Frontend (`public/`)

### `public/index.html`

`public/index.html` adalah antarmuka utama pengguna. Perannya:

- menyediakan textarea input berita
- menampilkan statistik input (`Paragraf`, `Kalimat`, `Kata`)
- menyediakan tombol `Deteksi` dan `Reset`
- menyediakan toggle mode render `Deteksi per kalimat`
- menyediakan toggle opsional `Tampilkan topik per paragraf`
- menampilkan banner verdict dan hasil highlight inline
- menampilkan panel informasi model dan artifact evaluasi statis dari `public/hasil/`

File ini juga memuat tab visualisasi untuk:

- confusion matrix
- ROC curve
- topik BERTopic
- heatmap dan distribusi c-TF-IDF
- kalibrasi threshold

### `public/app.js`

`public/app.js` menangani seluruh interaksi sisi klien. Tanggung jawab utamanya:

- menentukan API base URL
- mengirim request ke backend dengan timeout
- merender banner verdict dokumen
- merender highlight inline per kalimat atau per paragraf
- merender label topik per paragraf bila toggle topik aktif
- merender rincian confidence
- menjaga statistik input tetap sinkron saat pengguna mengetik

Komunikasi frontend ke backend dilakukan ke endpoint `POST /analyze`. API base URL ditentukan dengan urutan berikut:

1. query string `?api=...`
2. `window.__HOAX_API_BASE_URL__`
3. default `https://fjrmhri-ta-final-space.hf.space`

Jika backend menolak payload dengan status `422`, frontend mengulangi request dengan body minimal `{ text }`.

### `public/styles.css`

`public/styles.css` mendefinisikan:

- tata letak halaman berbasis card
- styling verdict banner
- styling input, tombol, dan tab evaluasi
- kelas highlight `hl--red`, `hl--green`, dan `hl--orange`
- tampilan rincian confidence dan elemen responsif

### Bagaimana hasil analisis dirender

Render hasil saat ini mengikuti implementasi berikut:

- Verdict dokumen diambil dari `payload.document`.
- Banner verdict menampilkan:
  - label akhir (`Terindikasi Hoaks` atau `Terindikasi Fakta`)
  - `Confidence`
  - `P(hoaks)`
  - topik global bila tersedia pada `topics_global`
- Highlight inline dibentuk ulang di frontend dari daftar kalimat pada `payload.paragraphs[*].sentences`.
- Jika toggle topik aktif, frontend menampilkan label topik dari `payload.paragraphs[*].topic` untuk setiap paragraf.
- Rincian confidence menampilkan:
  - `Conf`
  - `P(hoaks)`
  - `P(fakta)`
  - potongan teks kalimat atau paragraf

### Confidence dan highlight

Frontend aktif saat ini menggunakan `CONFIDENCE_CUTOFF = 0.65` untuk menentukan tampilan oranye:

- merah untuk unit teks berlabel hoaks
- hijau untuk unit teks berlabel fakta dengan confidence memadai
- oranye untuk unit teks dengan confidence di bawah `0.65`

Perlu dicatat bahwa backend juga mengirim field `color` pada analisis kalimat, tetapi UI saat ini menghitung kelas highlight sendiri dari label dan confidence. Dengan kata lain, tampilan warna di browser dikendalikan oleh logika `public/app.js`.

### Catatan tentang topik di UI

Backend mengembalikan `topic` per paragraf, `shared_topics`, dan `topics_global`. UI aktif menampilkan `topics_global` pada banner verdict, serta dapat menampilkan label topik per paragraf ketika toggle `Tampilkan topik per paragraf` diaktifkan.

## Alur Analisis / Inferensi

Alur inferensi yang relevan bagi developer adalah:

1. pengguna memasukkan teks berita multi-paragraf
2. frontend menormalkan line break
3. frontend memanggil `POST /analyze`
4. backend memecah teks menjadi paragraf dan kalimat
5. classifier menghitung `P(hoax)` dan `P(not_hoax)` per kalimat
6. backend memberi label kalimat memakai threshold inferensi aktif
7. backend menyusun verdict dokumen dari agregasi mayoritas kalimat
8. backend menurunkan topik per paragraf dan topik global
9. frontend merender:
   - verdict dokumen
   - highlight inline
   - topik per paragraf bila toggle topik aktif
   - ringkasan jumlah kalimat/paragraf
   - rincian confidence

## Hasil Evaluasi Model

Artifact evaluasi yang tersedia di `public/hasil/` menunjukkan bahwa repository ini menyimpan hasil evaluasi model secara eksplisit, bukan hanya kode inferensi. File yang relevan antara lain:

- `public/hasil/confusion_matrix_validation.png`
- `public/hasil/confusion_matrix_test.png`
- `public/hasil/confusion_matrix_threshold_optimal_validation.png`
- `public/hasil/confusion_matrix_threshold_optimal_test.png`
- `public/hasil/roc_curve_validation.png`
- `public/hasil/roc_curve_test.png`
- `public/hasil/kalibrasi_threshold_validation.png`
- `public/hasil/kurva_training.png`
- `public/hasil/inference_config.json`
- `public/hasil/evaluasi_ctfidf_topik.csv`

Ringkasan metrik yang konsisten muncul di artifact evaluasi:

- validation default/argmax:
  - accuracy `0.995393`
  - F1-hoax `0.995242`
  - AUC `0.999804`
- test default/argmax:
  - accuracy `0.996748`
  - F1-hoax `0.996644`
  - AUC `0.999817`
- test dengan threshold optimal:
  - threshold `0.30`
  - accuracy `0.996748`
  - precision-hoax `0.998880`
  - recall-hoax `0.994423`
  - F1-hoax `0.996646`
  - AUC `0.999817`

Secara praktis, metrik tersebut menunjukkan dua hal:

- classifier sangat baik dalam memisahkan berita hoaks dan non-hoaks
- kualitas pemeringkatan probabilitas juga sangat tinggi, karena AUC mendekati `1.0`

Ringkasan BERTopic terbaru:

- strategi final outlier reduction: `reduce_probabilities`
- jumlah topik valid non-outlier: `79`
- jumlah outlier: `3.771` dari `17.218` dokumen (`21.90%`)
- topik terbesar: Topic `0` dengan `2.787` dokumen (`16.19%`)
- coherence c_v: `0.520257`
- DBCV sampled: `-0.013278`
- HDBSCAN relative validity: `0.21855`
- topic exclusivity rate: `0.913889`
- keyword coverage rata-rata: `0.069279`
- jumlah `Topik Umum`: `3`

DBCV masih negatif tipis, sehingga struktur density clustering belum ideal secara absolut. Namun, kandidat final dipilih karena menjadi kompromi terbaik dibanding alternatif lain: outlier tidak dipaksa menjadi `0%`, coherence paling tinggi, DBCV paling mendekati nol, dan distribusi topik masih terkendali.

### Catatan threshold

Repository saat ini memakai threshold yang sudah sinkron antara artifact evaluasi, panel publik, dan konfigurasi runtime:

- `threshold_default = 0.5`
- `threshold_optimal = 0.3`
- threshold optimal dipilih berdasarkan F1-score pada validation set
- backend melaporkan threshold runtime melalui `meta.threshold_used`

Alasan teknis dari pola ini tetap sama: threshold dipakai untuk mengonversi probabilitas ke label akhir, dan penyimpanannya di file konfigurasi membuat penyesuaian threshold bisa dilakukan tanpa mengubah logika inti inferensi.

## Analisis cTFIDF

Analisis topik di repository ini dapat diverifikasi dari:

- `public/hasil/evaluasi_ctfidf_topik.csv`
- `public/hasil/ctfidf_heatmap.png`
- `public/hasil/ctfidf_distribusi_topik.png`

### Struktur file cTFIDF

`public/hasil/evaluasi_ctfidf_topik.csv` berisi:

- `790` baris
- `9` kolom
- `79` topik unik
- `17` kategori unik
- `10` kata berperingkat untuk setiap topik

Kolom yang paling relevan untuk interpretasi adalah:

- `Topik_ID`
- `Kategori`
- `Nama_Topik`
- `Rank`
- `Kata`
- `Skor_cTFIDF`
- `Keyword_Ditemukan`
- `Coverage`
- `Keyword_Kategori_Lengkap`

Di file ini, `Skor_cTFIDF` adalah dasar utama untuk membaca kata yang paling mewakili topik, sedangkan `Coverage` berguna sebagai sinyal tambahan untuk melihat seberapa kuat topik tersebut cocok dengan kamus kategori.

### Kata paling berpengaruh per kategori/topik

Beberapa topik dengan sinyal kata yang sangat jelas antara lain:

- `Kesehatan`
  - Topik 17: `vaksin`, `virus`, `covid`, `corona`, `virus corona`
- `Kriminal & Hukum`
  - Topik 7: `hakim`, `pengadilan`, `kasus`, `perkara`, `suap`
- `Pendidikan`
  - Topik 23: `sekolah`, `mahasiswa`, `siswa`, `kampus`, `sekolah rakyat`
- `Ekonomi & Bisnis`
  - Topik 15: `tarif`, `trump`, `impor`, `persen`, `amerika`
- `Transportasi & Infrastruktur`
  - Topik 3: `kendaraan`, `lalu lintas`, `lintas`, `arus`, `tol`
- `Internasional`
  - Topik 10: `israel`, `palestina`, `gaza`, `serangan`, `hamas`
- `Keamanan & Pertahanan`
  - Topik 28: `nuklir`, `tni`, `angkatan`, `serangan`, `prajurit`
- `Bencana & Cuaca`
  - Topik 1: `gempa`, `banjir`, `hujan`, `tsunami`, `wilayah`
- `Klaim & Pemeriksaan Fakta`
  - Topik 6: `akun`, `facebook`, `akun facebook`, `unggahan`, `tautan`

Pada level kategori, agregasi `Skor_cTFIDF` menunjukkan penanda yang kuat, misalnya:

- `Kesehatan`: `kesehatan`, `pasien`, `kanker`, `lockdown`
- `Ekonomi & Bisnis`: `tarif`, `impor`, `harga`, `pasar`, `rupiah`
- `Pendidikan`: `sekolah`, `pelajar`, `mahasiswa`, `siswa`, `guru`
- `Kriminal & Hukum`: `hakim`, `pengadilan`, `kasus`, `suap`
- `Transportasi & Infrastruktur`: `kereta`, `pesawat`, `bandara`, `kapal`

### Kata pembeda antar kategori

File cTFIDF menunjukkan pemisahan topik yang cukup kuat:

- terdapat `720` kata/frasa unik
- `658` kata (`91.39%`) hanya muncul pada satu topik
- `681` kata (`94.58%`) hanya muncul pada satu kategori

Artinya, mayoritas token pada file ini memang bersifat diskriminatif. Kata seperti `sekolah`, `mahasiswa`, `saham`, `kereta`, `polisi`, `rusia`, dan `militer` membedakan kategori karena:

- skor `Skor_cTFIDF` mereka tinggi pada topik terkait
- frekuensi kemunculannya lintas kategori rendah

Sebaliknya, beberapa kata overlap antar topik/kategori sehingga daya pembedanya lebih lemah, misalnya:

- `harga` muncul pada `8` topik dan `3` kategori
- `alat` muncul pada `3` topik dan `3` kategori
- `covid` muncul pada `3` topik dan `2` kategori
- `pelaku` muncul pada `3` topik dan `2` kategori

Kata overlap semacam ini masih informatif, tetapi tidak sekuat kata yang hanya muncul pada satu topik atau satu kategori.

### Coverage kategori dan area lemah

Coverage keyword tertinggi muncul pada topik-topik berikut:

- Topik 5 `Agama & Sosial`: `8/16`
- Topik 20 `Agama & Sosial`: `5/16`
- Topik 6 `Klaim & Pemeriksaan Fakta`: `4/14`
- Topik 1 `Bencana & Cuaca`: `13/54`
- Topik 28 `Keamanan & Pertahanan`: `12/60`

Temuan penting lain:

- kategori `Topik Umum` turun menjadi `3` topik
- `76` dari `79` topik memiliki keyword hit pada kamus kategori
- Topic `0` adalah topik valid, sedangkan outlier BERTopic direpresentasikan sebagai topic `-1`
- artefak seperti `ditampilkan`, `breaking`, `traduction`, `traduit`, `sic`, `turnbackhoax`, dan `mafindo` sudah tidak mendominasi top words

Secara praktis, ini berarti hasil cTFIDF sangat berguna untuk membaca topik yang tematik dan terstruktur, tetapi tetap perlu kehati-hatian pada `Topik Umum` dan outlier `-1` karena kosakatanya dapat lebih lemah atau kurang stabil.

## Alasan Teknis / Keputusan Desain

### Mengapa FastAPI

FastAPI dipakai karena implementasi ini membutuhkan service inference yang:

- ringan dan langsung memetakan request JSON ke schema Pydantic
- mudah diekspos sebagai endpoint tunggal untuk frontend statis
- mudah dijalankan di Docker/Uvicorn
- cocok untuk memisahkan UI dan model tanpa ketergantungan framework frontend

### Mengapa verdict dokumen dibangun dari kalimat

Backend tidak langsung melabeli teks utuh sebagai satu unit tunggal. Dokumen dipecah ke kalimat agar:

- kalimat problematik bisa ditandai secara lokal di UI
- pengguna mendapat alasan visual, bukan hanya satu label akhir
- satu kalimat ekstrem tidak otomatis mengambil alih verdict seluruh dokumen

Itu sebabnya implementasi aktif memakai majority vote pada level kalimat, lalu mengembalikan `summary` jumlah kalimat hoaks dan non-hoaks.

### Mengapa threshold dikonfigurasi lewat file

Threshold adalah bagian dari keputusan inferensi, bukan sekadar angka dekoratif. Menyimpannya di `inference_config.json` memberi dua keuntungan:

- nilai threshold dapat dikalibrasi dan diubah tanpa mengubah kode inti
- backend dapat melaporkan threshold yang benar-benar dipakai lewat `meta.threshold_used`

### Mengapa frontend dibuat statis

Frontend di `public/` cukup menggunakan HTML, CSS, dan JavaScript vanilla karena:

- kebutuhan utamanya adalah input teks, fetch API, dan render hasil
- deployment menjadi sederhana di Vercel
- surface area bug lebih kecil dibanding menambah framework frontend
- backend tetap bisa diganti melalui query string `?api=` atau global variable

### Mengapa memakai TF-IDF / cTFIDF untuk topik

cTFIDF dipakai untuk menjelaskan topik karena pendekatan ini menonjolkan kata yang:

- sering muncul di dalam satu topik
- tetapi tidak dominan di topik lain

Dengan demikian, cTFIDF lebih tepat untuk membaca kata pembeda topik daripada sekadar menghitung frekuensi mentah.

## Cara Menjalankan / Deployment Ringkas

### Backend

Menjalankan backend secara lokal:

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
```

Menjalankan backend via Docker:

```bash
docker build -f backend/Dockerfile backend
```

Backend default berjalan di port `7860`.

### Frontend statis

Repository ini memakai `package.json` dan `vercel.json` untuk deployment statis:

- `npm run build` menyalin isi `public/` ke `dist/`
- `npm start` menjalankan `serve dist`
- `vercel.json` memakai `@vercel/static-build` dengan `distDir = dist`

Untuk mengganti backend tanpa mengubah source frontend, gunakan:

- query string `?api=https://alamat-backend`
- atau `window.__HOAX_API_BASE_URL__` sebelum `app.js` dimuat

## Kesimpulan

Implementasi aktif repository ini adalah sistem inference hoaks yang memadukan:

- classifier IndoBERT untuk probabilitas hoaks
- agregasi verdict dokumen berbasis kalimat
- topik hibrida rule-based + BERTopic
- frontend statis yang menampilkan highlight dan confidence secara langsung

Artifact evaluasi di `public/hasil/` menunjukkan performa klasifikasi yang sangat tinggi pada validation dan test set. Sementara itu, file cTFIDF memperlihatkan bahwa mayoritas kata topik bersifat cukup diskriminatif, `Topik Umum` sudah jauh berkurang, dan outlier BERTopic tetap diperlakukan sebagai topic `-1`.

Dengan demikian, repository ini tidak hanya menyimpan model inference, tetapi juga menyimpan jejak evaluasi, visualisasi, dan analisis topik yang cukup lengkap untuk dipahami dari sisi implementasi maupun interpretasi hasil.
