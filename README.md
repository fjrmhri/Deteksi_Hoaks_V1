# Deteksi Hoaks Berita

Situs statis untuk memeriksa teks berita berbahasa Indonesia. Pengguna menempelkan teks, situs mengirimnya ke backend
API, lalu menampilkan verdict dokumen (hoaks atau fakta), sorotan per kalimat atau per paragraf, rincian keyakinan,
topik paragraf, dan artikel cek fakta Mafindo (TurnBackHoax) yang mirip.

Backend (model IndoBERT, BERTopic, dan RAG) berada di Hugging Face Space `fjrmhri/TA-FINAL-SPACE`:
`https://fjrmhri-ta-final-space.hf.space`.

## Struktur

```
README.md
LICENSE
.gitignore
package.json              skrip build: salin public/ ke dist/
vercel.json               konfigurasi Vercel (static-build, distDir dist)
public/
  index.html              halaman tunggal
  styles.css              tampilan
  app.js                  titik masuk modul: input, tombol, dan alur analisis
  js/
    konfigurasi.js        alamat backend dan konstanta
    utilitas.js           fungsi murni: format, normalisasi label dan teks, ringkasan, sorotan
    api.js                permintaan ke /analyze dan /health
    tampilan.js           menampilkan verdict, bukti, sorotan, dan rincian keyakinan ke halaman
```

## Fungsi setiap berkas

| Berkas | Fungsi |
|---|---|
| `public/index.html` | Formulir teks, statistik paragraf/kalimat/kata, tombol Analisis/Rapikan/Reset, sakelar mode per kalimat dan topik per paragraf, area hasil |
| `public/styles.css` | Gaya halaman, warna sorotan (hijau = fakta, merah = hoaks, oranye = ragu) |
| `public/app.js` | Mendaftarkan event tombol dan input, menjalankan analisis, menampilkan jumlah artikel referensi RAG |
| `public/js/konfigurasi.js` | `DEFAULT_API_BASE_URL`, batas waktu request, ambang keyakinan "ragu" (0,65), daftar kategori topik yang boleh tampil |
| `public/js/utilitas.js` | Normalisasi label backend, pemecahan paragraf/kalimat untuk statistik, ringkasan jumlah hoaks/fakta/ragu, pembagian ulang kalimat bila backend mengembalikan satu paragraf |
| `public/js/api.js` | `POST /analyze` dengan batas waktu; `GET /health` untuk jumlah artikel RAG |
| `public/js/tampilan.js` | Semua penulisan ke DOM |
| `package.json`, `vercel.json` | Build dan deploy Vercel |

Kunci JSON yang dibaca dari backend: `document` (`label`, `confidence`, `hoax_probability`, `risk_explanation`,
`verdict_source`, `evidence_matches`), `paragraphs` (`paragraph_index`, `text`, `label`, `confidence`, `topic`,
`sentences`), `topics_global`, dan `rag_evidence.n_articles` dari `/health`.

## Alamat backend

Urutan sumber alamat:
1. Parameter URL `?api=...`, mis. `https://<situs>/?api=http://127.0.0.1:7860` (tautan halaman Space
   `https://huggingface.co/spaces/<user>/<space>` otomatis diubah ke `https://<user>-<space>.hf.space`).
2. Variabel global `window.__HOAX_API_BASE_URL__` bila didefinisikan sebelum `app.js` dimuat.
3. `DEFAULT_API_BASE_URL` di `public/js/konfigurasi.js`.

Untuk mengganti alamat secara permanen, ubah `DEFAULT_API_BASE_URL`. Backend harus mengizinkan origin situs lewat
variabel `ALLOWED_ORIGINS` di Space.

## Menjalankan secara lokal

Halaman memakai modul ES, jadi harus disajikan lewat HTTP (bukan dibuka langsung sebagai berkas):

```bash
python -m http.server 8000 -d public
```

Buka `http://localhost:8000`, atau `http://localhost:8000/?api=http://127.0.0.1:7860` untuk backend lokal.
Alternatif: `npm install` lalu `npm run build` dan `npm start` (menyajikan `dist/`).

## Deploy ke Vercel

Vercel terhubung ke repo GitHub ini dan membangun ulang setiap push ke `main`. Build menjalankan `npm run build`
(`cp -r public dist`) dan menerbitkan isi `dist/` sebagai situs statis. Tidak ada environment variable yang dibutuhkan.

## Catatan

- Space gratis bisa tertidur; analisis pertama setelahnya bisa melewati batas waktu 25 detik. Ulangi setelah Space aktif.
- Bila RAG nonaktif atau tidak ada artikel yang cukup mirip, panel artikel cek fakta disembunyikan.
- Badge "Verdict dari evidence RAG" muncul bila verdict dokumen diganti oleh bukti RAG; sorotan kalimat tetap mengikuti
  IndoBERT.
- Label "Ragu" dipakai untuk kalimat atau paragraf dengan keyakinan di bawah 65%.
