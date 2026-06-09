# LAPORAN POLISHING DOCX FINAL

File input: `Skripsi_Deteksi_Hoaks_IndoBERT_BERTopic_REVISI_FINAL_LENGKAP.docx`

File output: `Skripsi_Deteksi_Hoaks_IndoBERT_BERTopic_REVISI_FINAL_POLISHED.docx`

## 1. Numbering yang Diperbaiki

Daftar pada subbab berikut dikonversi menjadi penomoran eksplisit yang restart dari nomor 1 pada setiap subbab:

| Subbab | Jumlah Poin | Status |
|---|---:|---|
| 1.2 Identifikasi Masalah | 7 | Diperbaiki, mulai dari 1 |
| 1.3 Rumusan Masalah | 5 | Diperbaiki, mulai dari 1 |
| 1.4 Batasan Masalah | 9 | Diperbaiki, mulai dari 1 |
| 1.5 Tujuan Penelitian | 7 | Diperbaiki, mulai dari 1 |
| 1.6 Manfaat Penelitian | 5 | Diperbaiki, mulai dari 1 |
| 3.2 Metode Penelitian / Tahapan Penelitian | 12 | Diperbaiki, mulai dari 1 |
| 3.4 Praproses Data / Tahapan Praproses Data | 7 | Diperbaiki, mulai dari 1 |
| 3.12 Rancangan Pengujian | 4 | Diperbaiki, mulai dari 1 |
| 4.12 Keterbatasan | 7 | Diperbaiki, mulai dari 1 |
| 5.1 Kesimpulan | 8 | Diperbaiki, mulai dari 1 |
| 5.2 Saran | 9 | Diperbaiki, mulai dari 1 |

## 2. Caption Duplikat

Pemeriksaan struktural DOCX dilakukan untuk pola:

`Gambar/Lampiran caption -> gambar -> caption yang sama`

Hasil: tidak ditemukan caption duplikat struktural pada DOCX input final lengkap. Caption gambar/lampiran tetap dipertahankan di bawah gambar. Posisi gambar dan caption sudah dirapikan rata tengah.

## 3. Karakter Rusak / Soft Hyphen

Pemeriksaan global dilakukan terhadap karakter `￾` dan pola pecah seperti `fine￾tuning`, `c-TF￾IDF`, `pra￾oversampling`, `non￾hoaks`, `di￾fine-tune`, `fact￾checking`, dan `machine￾learning`.

Status akhir:

| Pola | Status Akhir |
|---|---|
| `￾` | Tidak ditemukan pada DOCX hasil |
| `fine￾tuning` / `FINE￾TUNING` | Tidak ditemukan pada DOCX hasil |
| `indobert-base￾uncased` | Tidak ditemukan pada DOCX hasil |
| `c-TF￾IDF` | Tidak ditemukan pada DOCX hasil |
| `pra￾oversampling` | Tidak ditemukan pada DOCX hasil |
| `non￾hoaks` | Tidak ditemukan pada DOCX hasil |
| `di￾fine-tune` | Tidak ditemukan pada DOCX hasil |
| `fact￾checking` | Tidak ditemukan pada DOCX hasil |
| `machine￾learning` | Tidak ditemukan pada DOCX hasil |

## 4. Referensi Cahyawijaya/NusaCrowd

Status: **Opsi B diterapkan**.

Alasan: tidak ada PDF NusaCrowd yang benar yang diunggah ulang pada tahap polishing ini. Laporan finalisasi sebelumnya juga mencatat bahwa file `2023.acl-demo.32.pdf` dalam `Referensi.zip` terbaca sebagai paper lain, bukan NusaCrowd.

Perubahan yang dilakukan:

1. Kalimat yang menyebut `Cahyawijaya et al. (2023)` / `NusaCrowd` pada BAB II dihapus.
2. Entri `Cahyawijaya, S., et al. (2023). NusaCrowd...` pada Daftar Pustaka dihapus.
3. Alur paragraf BAB II tetap dipertahankan tanpa menambah klaim atau referensi baru.

## 5. Status Gambar 4.18

Tidak ada screenshot panel metrik baru yang diunggah terpisah pada tahap polishing ini. Oleh karena itu, `Gambar 4.18 Tampilan Panel Metrik Evaluasi` dipertahankan dari dokumen final lengkap.

Catatan: Tabel 4.16 tetap menjadi sumber angka panel metrik yang lengkap, termasuk threshold runtime 0,30 dan training date 14 Mei 2026. Screenshot Gambar 4.18 menampilkan bagian panel yang memuat DBCV -0,0133, outlier rate 21,90%, dan topik final 79, tetapi tidak menampilkan seluruh bagian atas panel.

## 6. Placeholder Administrasi yang Masih Tersisa

Placeholder berikut tetap dibiarkan karena data administrasi belum diberikan:

- `[NAMA MAHASISWA]`
- `[NPM/NIM]`
- `[PROGRAM STUDI]`
- `[FAKULTAS]`
- `[UNIVERSITAS]`
- `[NAMA DOSEN PEMBIMBING]`
- `[NAMA DOSEN PENGUJI]`
- `[NAMA KETUA PROGRAM STUDI]`
- `[NIDN]`
- `[TANGGAL PENGESAHAN]`
- `[TANGGAL]`
- `[TAHUN]`

## 7. Validasi Angka dan Klaim Terlarang

Pemeriksaan teks final memastikan tidak ditemukan:

- threshold lama `0,34` atau `0.34`,
- DBCV lama `0,660416`,
- outlier rate lama `39,92%`,
- placeholder gambar `GAMBAR ARTEFAK BELUM TERSEDIA`,
- placeholder screenshot `SCREENSHOT BELUM TERSEDIA`,
- `Daftar Pustaka Awal`,
- `Cahyawijaya`,
- `NusaCrowd`,
- karakter rusak `￾`.

Klaim metodologis terlarang tetap tidak dimasukkan sebagai klaim aktif. Kalimat tentang group split, evidence retrieval, verifikasi fakta absolut, dan dataset berlabel kalimat eksplisit tetap muncul hanya sebagai batasan atau saran penelitian lanjutan.

## 8. QA Visual

Dokumen diproses menjadi PDF melalui LibreOffice dan dirender menjadi 79 halaman PNG untuk pemeriksaan visual. Contact sheet dan halaman kunci diperiksa. Hasil QA visual:

- dokumen dapat dibuka dan dirender;
- tidak terlihat gambar keluar dari margin;
- caption berada di bawah gambar;
- tidak terlihat placeholder gambar/screenshot;
- tabel utama tetap terbaca;
- halaman lampiran, diagram, dan gambar artefak tampil dalam area halaman.

## 9. Catatan Manual Terakhir untuk Word

1. Isi semua placeholder administrasi.
2. Jika dosen meminta daftar isi, daftar tabel, dan daftar gambar otomatis, buat ulang melalui fitur **References** di Microsoft Word.
3. Jika tersedia screenshot panel metrik yang menampilkan threshold 0,30 dan training date 14 Mei 2026 dalam satu layar, ganti Gambar 4.18.
4. Tambahkan contoh response API nyata pada Lampiran D jika ingin melengkapi lampiran teknis.
5. Periksa kembali nomor halaman setelah data administrasi dan/atau gambar diganti di Word.
