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

1. backend mencoba mengambil file dari Hugging Face Hub
2. bila gagal, backend fallback ke file lokal
3. kandidat fallback lokal mencakup `public/hasil/inference_config.json`

Artifact `public/hasil/inference_config.json` saat ini memuat metadata berikut:

- `model_name`: `indolem/indobert-base-uncased`
- `metric_for_best_model`: `f1`
- `max_length`: `256`
- `threshold_optimal`: `0.79`
- `transformers_version`: `5.0.0`

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

Backend mengembalikan `topic` per paragraf dan `shared_topics`, tetapi UI aktif saat ini hanya menampilkan `topics_global` pada banner verdict. Toggle yang terlihat di halaman mengubah mode render highlight, bukan menyalakan tampilan topik per paragraf.

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
   - ringkasan jumlah kalimat/paragraf
   - rincian confidence

## Hasil Evaluasi Model

Artifact evaluasi yang tersedia di `public/hasil/` menunjukkan bahwa repository ini menyimpan hasil evaluasi model secara eksplisit, bukan hanya kode inferensi. File yang relevan antara lain:

- `public/hasil/confusion_matrix_validation.png`
- `public/hasil/confusion_matrix_test.png`
- `public/hasil/roc_curve_validation.png`
- `public/hasil/roc_curve_test.png`
- `public/hasil/kalibrasi_threshold_validation.png`
- `public/hasil/kurva_training.png`
- `public/hasil/inference_config.json`
- `public/hasil/analisis_arsitektur.txt`

Ringkasan metrik yang konsisten muncul di artifact evaluasi:

- validation:
  - accuracy `0.9984`
  - F1-hoax `0.9883`
  - AUC `0.9994`
- test:
  - accuracy `0.9983`
  - F1-hoax `0.9874`
  - AUC `0.9992`

Secara praktis, metrik tersebut menunjukkan dua hal:

- classifier sangat baik dalam memisahkan berita hoaks dan non-hoaks
- kualitas pemeringkatan probabilitas juga sangat tinggi, karena AUC mendekati `1.0`

### Catatan threshold: artifact evaluasi vs konfigurasi runtime

Repository saat ini menyimpan dua sumber informasi threshold yang perlu dibedakan:

1. **Artifact evaluasi statis**
   `public/index.html` dan `public/hasil/analisis_arsitektur.txt` mendokumentasikan threshold kalibrasi `0.62` pada validation set.

2. **Konfigurasi inferensi aktif**
   `public/hasil/inference_config.json`, yang memang dibaca backend saat startup jika tersedia, saat ini memuat `threshold_optimal = 0.79`.

Konsekuensinya, README ini membedakan antara:

- threshold yang ditampilkan oleh panel evaluasi statis
- threshold yang benar-benar dipakai backend runtime melalui `meta.threshold_used`

Alasan teknis dari pola ini tetap sama: threshold dipakai untuk mengonversi probabilitas ke label akhir, dan penyimpanannya di file konfigurasi membuat penyesuaian threshold bisa dilakukan tanpa mengubah logika inti inferensi.

## Analisis cTFIDF

Analisis topik di repository ini dapat diverifikasi dari:

- `public/hasil/evaluasi_ctfidf_topik.csv`
- `public/hasil/ctfidf_heatmap.png`
- `public/hasil/ctfidf_distribusi_topik.png`

### Struktur file cTFIDF

`public/hasil/evaluasi_ctfidf_topik.csv` berisi:

- `750` baris
- `9` kolom
- `75` topik unik
- `16` kategori unik
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
  - Topik 2: `corona`, `virus`, `virus corona`, `covid`, `positif`
  - Topik 12: `kesehatan`, `sehat`, `dokter`, `bpjs`, `rumah sakit`
- `Kriminal & Hukum`
  - Topik 15: `polisi`, `hakim`, `penjara`, `ditangkap`, `jaksa`
- `Pendidikan`
  - Topik 19: `sekolah`, `pelajar`, `mahasiswa`, `siswa`, `guru`
- `Ekonomi & Bisnis`
  - Topik 54: `saham`, `investasi`, `ihsg`, `indeks`, `harga`
- `Transportasi & Infrastruktur`
  - Topik 38: `kereta`, `kereta api`, `api`, `metro`, `stasiun`
- `Internasional`
  - Topik 31: `rusia`, `ukraina`, `eropa`, `italia`, `spanyol`
- `Keamanan & Pertahanan`
  - Topik 53: `perang`, `militer`, `tentara`, `prajurit`, `pasukan`
- `Bencana & Cuaca`
  - Topik 14: `banjir`, `gempa`, `hujan`, `sungai`, `jembatan`

Pada level kategori, agregasi `Skor_cTFIDF` menunjukkan penanda yang kuat, misalnya:

- `Kesehatan`: `kesehatan`, `pasien`, `kanker`, `lockdown`
- `Ekonomi & Bisnis`: `harga`, `pasar`, `impor`, `gaji`, `rupiah`
- `Pendidikan`: `sekolah`, `pelajar`, `mahasiswa`, `siswa`, `guru`
- `Kriminal & Hukum`: `tersangka`, `polisi`, `hakim`, `seksual`
- `Transportasi & Infrastruktur`: `kereta`, `pesawat`, `bandara`, `kapal`

### Kata pembeda antar kategori

File cTFIDF menunjukkan pemisahan topik yang cukup kuat:

- terdapat `658` kata/frasa unik
- `579` kata (`87.99%`) hanya muncul pada satu topik
- `606` kata (`92.10%`) hanya muncul pada satu kategori

Artinya, mayoritas token pada file ini memang bersifat diskriminatif. Kata seperti `sekolah`, `mahasiswa`, `saham`, `kereta`, `polisi`, `rusia`, dan `militer` membedakan kategori karena:

- skor `Skor_cTFIDF` mereka tinggi pada topik terkait
- frekuensi kemunculannya lintas kategori rendah

Sebaliknya, beberapa kata overlap antar topik/kategori sehingga daya pembedanya lebih lemah, misalnya:

- `harga` muncul pada `8` topik dan `3` kategori
- `licitud` muncul pada `4` topik dan `3` kategori
- `alat` muncul pada `3` topik dan `3` kategori
- `covid` muncul pada `3` topik dan `2` kategori
- `pelaku` muncul pada `3` topik dan `2` kategori

Kata overlap semacam ini masih informatif, tetapi tidak sekuat kata yang hanya muncul pada satu topik atau satu kategori.

### Coverage kategori dan area lemah

Coverage keyword tertinggi muncul pada topik-topik berikut:

- Topik 15 `Kriminal & Hukum`: `9/57`
- Topik 14 `Bencana & Cuaca`: `6/49`
- Topik 19 `Pendidikan`: `7/64`
- Topik 54 `Ekonomi & Bisnis`: `7/80`
- Topik 31 `Internasional`: `7/81`

Temuan penting lain:

- kategori `Topik Umum` memiliki `29` topik dan seluruhnya tidak memiliki keyword hit (`Coverage` nol)
- `Topik Noise (Topic 0)` juga tidak memiliki keyword hit
- beberapa token tampak artefaktual atau kurang interpretatif, misalnya `spares`, `licitud`, `ndiricis`, `covid covid`, `bukan bukan`

Secara praktis, ini berarti hasil cTFIDF sangat berguna untuk membaca topik yang tematik dan terstruktur, tetapi tetap perlu kehati-hatian pada topik umum/noise karena kosakatanya lebih lemah atau kurang stabil.

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

Artifact evaluasi di `public/hasil/` menunjukkan performa klasifikasi yang sangat tinggi pada validation dan test set. Sementara itu, file cTFIDF memperlihatkan bahwa mayoritas kata topik bersifat cukup diskriminatif, walaupun kategori `Topik Umum` dan `Topik Noise` tetap perlu dibaca lebih hati-hati karena coverage keyword-nya lemah.

Dengan demikian, repository ini tidak hanya menyimpan model inference, tetapi juga menyimpan jejak evaluasi, visualisasi, dan analisis topik yang cukup lengkap untuk dipahami dari sisi implementasi maupun interpretasi hasil.
