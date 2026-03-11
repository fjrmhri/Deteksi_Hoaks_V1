# Deteksi Hoaks Indonesia

Deteksi Hoaks Indonesia adalah sistem end-to-end untuk klasifikasi berita berbahasa Indonesia dengan backbone IndoBERT. Training utama dilakukan di notebook `notebooks/Deteksi_Hoax_V1.ipynb` pada level dokumen, lalu backend FastAPI memecah input multi-paragraf menjadi paragraf dan kalimat untuk analisis inferensi yang lebih rinci, termasuk topik ringan per paragraf dan highlight inline di frontend.

## Fitur Utama
- Deteksi hoaks tingkat kalimat pada input multi-paragraf dengan model IndoBERT yang sama seperti classifier dokumen.
- Highlight inline di frontend: merah untuk `Hoaks`, hijau untuk `Fakta`, dan oranye untuk confidence di bawah `65%`.
- Topik per paragraf berbasis keyword TF-IDF dari backend.
- Arsitektur deployment sederhana: backend FastAPI untuk Hugging Face Spaces dan frontend statis untuk Vercel.

## Struktur Repo
```text
Deteksi_Hoaks/
|-- backend/
|   |-- app.py
|   |-- Dockerfile
|   `-- requirements.txt
|-- dataset/
|   |-- Summarized_2020+.csv
|   |-- Summarized_CNN.csv
|   |-- Summarized_Detik.csv
|   |-- Summarized_Kompas.csv
|   `-- Summarized_TurnBackHoax.csv
|-- notebooks/
|   `-- Deteksi_Hoax_V1.ipynb
|-- preview/
|   |-- confusion-matrix-test.png
|   `-- confusion-matrix-validation.png
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- DOCUMENTATION.md
|-- README.md
|-- vercel.json
|-- package.json
`-- LICENSE
```

## Dataset
Dataset training berada di folder `dataset/` dan dipakai oleh `notebooks/Deteksi_Hoax_V1.ipynb`.

- `dataset/Summarized_CNN.csv`: berita sumber `cnn`; dipetakan sebagai non-hoaks saat kolom `hoax` kosong (notebook cell 3-4).
- `dataset/Summarized_Detik.csv`: berita sumber `detik`; dipetakan sebagai non-hoaks saat kolom `hoax` kosong (notebook cell 3-4).
- `dataset/Summarized_Kompas.csv`: berita sumber `kompas`; dipetakan sebagai non-hoaks saat kolom `hoax` kosong (notebook cell 3-4).
- `dataset/Summarized_TurnBackHoax.csv`: data sumber `turnbackhoax`; dipetakan sebagai hoaks saat kolom `hoax` kosong (notebook cell 3-4).
- `dataset/Summarized_2020+.csv`: data tambahan `merged_extra`; memiliki kolom ekstra `source_file` dan dipetakan sebagai non-hoaks saat kolom `hoax` kosong (notebook cell 3-4, output cell 9).

Catatan label dan teks training:
- Notebook menyelaraskan kolom ke skema standar `url`, `judul`, `tanggal`, `isi_berita`, `Narasi`, `Clean Narasi`, `hoax`, `summary` (cell 3).
- Teks training dipilih dengan prioritas `Clean Narasi -> Narasi -> isi_berita -> judul`, lalu disimpan ke kolom `text` (cell 4).

## Cara Menjalankan

### 1. Training di Google Colab
Gunakan `notebooks/Deteksi_Hoax_V1.ipynb`.

1. Buka notebook di Google Colab dan aktifkan runtime GPU jika tersedia.
2. Pastikan lima file CSV tersedia di `/content/dataset/` karena `Config` notebook menunjuk ke path itu (cell 1).
3. Untuk mengambil dataset otomatis, jalankan cell 2 yang mengunduh Kaggle dataset `fjrmhri/dataset-berita` lalu menyalin file ke `/content/dataset/`.
4. Jika tidak memakai KaggleHub, upload file CSV secara manual atau mount Google Drive lalu copy file ke `/content/dataset/`.
5. Jalankan cell 0-11 untuk instal dependensi, load data, preprocessing, split, training, evaluasi, dan menyimpan model.
6. Jalankan cell 12 bila ingin mengunduh zip artefak model.
7. Jalankan cell 18 bila ingin mengunggah artefak ke Hugging Face; token dibaca dari Colab Secrets `HF_TOKEN`, bukan ditulis di notebook.

### 2. Backend ke Hugging Face Spaces (Docker)
Backend ada di folder `backend/`.

1. Gunakan isi folder `backend/` sebagai root Space Docker, atau build lokal dengan context folder itu:
   ```bash
   docker build -f backend/Dockerfile backend
   ```
2. `backend/Dockerfile` menjalankan `uvicorn app:app --host 0.0.0.0 --port 7860` dan `backend/requirements.txt` memasang dependency FastAPI, Transformers, Torch, NumPy, Accelerate, Pydantic, dan scikit-learn.
3. Env var penting di backend:
   - `MODEL_ID` default `fjrmhri/TA-FINAL`
   - `MODEL_SUBFOLDER` default kosong
   - `MAX_LENGTH` default `256`
   - `PREDICT_BATCH_SIZE` default `64`
   - `SENTENCE_BATCH_SIZE` default `64`
   - `HOAX_THRESH_HIGH` default `0.98`
   - `HOAX_THRESH_MED` default `0.60`
   - `SENTENCE_AMBER_CONF` default `0.70`
4. Verifikasi `GET /health` dan `POST /analyze` setelah deploy.

### 3. Frontend ke Vercel
Frontend statis ada di folder `public/`.

1. `package.json` memakai build command `npm run build` untuk menyalin `public/` ke `dist/`.
2. `vercel.json` mengarahkan Vercel ke hasil build `dist` melalui `@vercel/static-build`.
3. URL backend default sudah di-hardcode di `public/app.js` sebagai `https://fjrmhri-ta-final-space.hf.space`.
4. Jika ingin mengganti backend tanpa mengubah kode, gunakan query string `?api=https://your-backend.example` atau set `window.__HOAX_API_BASE_URL__` sebelum `app.js` dimuat.

## API Singkat
- `GET /health` -> health check sederhana: `{ "status": "ok" }`
- `POST /analyze` -> menerima `{ "text": "..." }` dan mengembalikan hasil level dokumen, daftar paragraf, daftar kalimat, topik per paragraf, dan metadata model.

## Artefak Hugging Face
- Repo model hasil training: [https://huggingface.co/fjrmhri/TA-FINAL](https://huggingface.co/fjrmhri/TA-FINAL)
  - Sumber: notebook cell 18 (`id_repositori_target = "fjrmhri/TA-FINAL"`) dan default `MODEL_ID` di `backend/app.py`.
- Folder lokal yang diunggah: `indobert_hoax_model_v3` (notebook cell 1, 11, 18).
- Repo topik terpisah: tidak ada di file repo ini; topik dihitung saat runtime dengan TF-IDF keyword, bukan dimuat dari repo model lain.
- Halaman repo Hugging Face Space: `UNKNOWN (slug repo Space tidak tertulis di file; yang tersedia hanya runtime URL default https://fjrmhri-ta-final-space.hf.space di public/app.js)`

## Lisensi
Project ini memakai lisensi MIT. Lihat `LICENSE`.
