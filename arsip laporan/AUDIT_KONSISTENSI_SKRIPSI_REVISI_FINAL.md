# AUDIT_KONSISTENSI_SKRIPSI_REVISI_FINAL

Judul audit: **Audit Konsistensi Final Revisi Skripsi Deteksi Hoaks Berbasis IndoBERT dan BERTopic**

Dokumen yang diaudit:

1. `LOCKED_FACTS_SKRIPSI_REVISI_FINAL.md`
2. `ABSTRAK_DAN_ABSTRACT_REVISI.md`
3. `BAB_I_Pendahuluan_REVISI.md`
4. `BAB_II_Landasan_Teori_REVISI.md`
5. `BAB_III_Metodologi_Penelitian_REVISI.md`
6. `BAB_IV_Hasil_dan_Pembahasan_REVISI.md`
7. `BAB_V_Kesimpulan_dan_Saran_REVISI.md`
8. `DIAGRAM_SKRIPSI_DETEKSI_HOAKS_REVISI.md`
9. `Blueprint_Skripsi_Deteksi_Hoaks_REVISI.md`
10. `BUKU PEDOMAN TUGAS AKHIR.pdf`
11. `Pra Proposal.pdf`

---

## 1. Ringkasan Status

Status umum: **LAYAK DILANJUTKAN KE PEMINDAHAN KE WORD DENGAN PEMERIKSAAN SCREENSHOT DAN FORMAT AKHIR**.

Revisi telah menyelaraskan dataset, split, balancing, threshold, metrik IndoBERT, evaluasi BERTopic, c-TF-IDF, backend, frontend, dan batasan metodologis dengan eksperimen terbaru. Angka lama tidak dipertahankan sebagai angka final. Data tambahan `Summarized_2020+.csv` sudah dihapus dari narasi eksperimen terbaru.

Catatan yang masih perlu dikerjakan saat pemindahan ke Word:

1. Ambil ulang screenshot frontend agar panel metrik menampilkan angka terbaru.
2. Render diagram Mermaid/PlantUML menjadi gambar.
3. Pastikan penomoran tabel dan gambar sesuai posisi aktual di Word.
4. Verifikasi seluruh sitasi dan daftar pustaka menggunakan reference manager.
5. Pastikan semua gambar artefak di `public/hasil/` yang dimasukkan adalah versi terbaru.

---

## 2. Konsistensi Judul

| Aspek | Status | Temuan | Rekomendasi |
|---|---|---|---|
| Judul utama | AMAN | Judul konsisten sebagai `DETEKSI HOAKS BERITA BERBAHASA INDONESIA BERBASIS FINE-TUNING INDOBERT PADA TINGKAT KALIMAT DAN PEMODELAN TOPIK BERTOPIC`. | Gunakan kapital penuh pada cover dan halaman formal. |
| IndoBERT | AMAN | Penulisan konsisten sebagai IndoBERT. | Jangan ubah menjadi Indo Bert atau IndoBert. |
| BERTopic | AMAN | Penulisan konsisten sebagai BERTopic. | Jangan ubah menjadi Bertopic. |
| Tingkat kalimat | AMAN DENGAN CATATAN | Sudah dibatasi sebagai proses runtime. | Pertahankan narasi bahwa dataset training tidak berlabel kalimat eksplisit. |

---

## 3. Konsistensi Angka Final

| Item | Nilai Final | Status |
|---|---:|---|
| Total data mentah | 24.675 | AMAN |
| Data bersih | 24.598 | AMAN |
| Duplikat dihapus | 77 | AMAN |
| Konflik label | 0 | AMAN |
| `not_hoax` | 12.645 | AMAN |
| `hoax` | 11.953 | AMAN |
| Rasio hoaks | 48,6% | AMAN |
| Train | 17.218 | AMAN |
| Validation | 3.690 | AMAN |
| Test | 3.690 | AMAN |
| Train setelah balancing | 17.702 | AMAN |
| Threshold runtime | 0,30 | AMAN |
| Test accuracy @0,30 | 0,996748 | AMAN |
| Test precision hoaks @0,30 | 0,998880 | AMAN |
| Test recall hoaks @0,30 | 0,994423 | AMAN |
| Test F1 hoaks @0,30 | 0,996646 | AMAN |
| Test AUC @0,30 | 0,999817 | AMAN |
| Coherence c_v | 0,520257 | AMAN |
| DBCV sampled | -0,013278 | AMAN |
| Outlier rate | 21,90% | AMAN |
| Topik final | 79 | AMAN |
| c-TF-IDF rows | 790 | AMAN |
| Kata/frasa unik | 720 | AMAN |

Kesimpulan: angka final sudah konsisten antar locked facts, abstrak, BAB III, BAB IV, BAB V, diagram, dan blueprint revisi.

---

## 4. Rumusan Masalah vs Kesimpulan

| Rumusan Masalah | Jawaban di Kesimpulan | Status |
|---|---|---|
| Penerapan fine-tuning IndoBERT | Kesimpulan poin 1–3 menjelaskan model, dataset, threshold, dan metrik test. | AMAN |
| Segmentasi kalimat/paragraf | Kesimpulan poin 5 menjelaskan segmentasi, highlight, dan agregasi runtime. | AMAN |
| BERTopic untuk topik global/paragraf | Kesimpulan poin 6 menjelaskan konfigurasi, coherence, DBCV, outlier, dan interpretasi. | AMAN |
| Evaluasi IndoBERT dan BERTopic | Kesimpulan poin 3 dan 6 menjawab metrik utama. | AMAN |
| Integrasi web | Kesimpulan poin 7 menjelaskan FastAPI dan frontend statis. | AMAN |

Kesimpulan: BAB V sudah menjawab rumusan masalah BAB I.

---

## 5. Konsistensi Istilah

| Istilah | Status | Catatan |
|---|---|---|
| hoaks | AMAN | Digunakan untuk narasi Bahasa Indonesia. |
| hoax | AMAN | Dipakai sebagai label teknis `hoax = 1`. |
| not_hoax | AMAN | Dipakai sebagai label teknis `not_hoax = 0`. |
| non-hoaks | AMAN | Dipakai untuk narasi kelas lawan hoaks. |
| verdict dokumen | AMAN | Dipakai sebagai hasil agregasi. |
| confidence | AMAN | Dipakai sebagai nilai keyakinan/probabilitas tampilan. |
| highlight | AMAN | Dipakai sebagai penyorotan hasil. |
| tingkat kalimat | AMAN DENGAN CATATAN | Selalu dikaitkan dengan runtime. |
| BERTopic | AMAN | Kapitalisasi benar. |
| c-TF-IDF | AMAN | Format benar. |
| DBCV | AMAN | Tidak ditulis sebagai DBCS kecuali nama file notebook. |
| threshold | AMAN | Threshold runtime final 0,30. |
| FastAPI | AMAN | Backend konsisten. |

---

## 6. Klaim Terlarang

| Klaim | Status Audit |
|---|---|
| Dataset training berlabel kalimat eksplisit | TIDAK DITEMUKAN |
| Group split berbasis artikel/sumber/domain | TIDAK DITEMUKAN |
| Evidence retrieval aktif | TIDAK DITEMUKAN |
| Sistem sebagai verifikasi fakta absolut | TIDAK DITEMUKAN |
| BERTopic sebagai penentu label hoaks | TIDAK DITEMUKAN |
| Guided topic modeling aktif | TIDAK DITEMUKAN |
| `Summarized_2020+.csv` dipakai pada eksperimen terbaru | TIDAK DITEMUKAN |
| Dataset sangat tidak seimbang | TIDAK DITEMUKAN |
| Backend memakai database/message broker | TIDAK DITEMUKAN |

---

## 7. Daftar Gambar dan Tabel

### 7.1 Tabel

Tabel yang wajib ada atau dapat dipertahankan:

1. Komponen objek penelitian.
2. Sumber dataset.
3. Distribusi sumber.
4. Ringkasan praproses.
5. Distribusi label.
6. Split data.
7. Balancing training set.
8. Konfigurasi training IndoBERT.
9. Konfigurasi BERTopic.
10. Endpoint backend.
11. Metrik validation/test.
12. Threshold calibration.
13. Evaluasi BERTopic.
14. Ringkasan c-TF-IDF.
15. Panel metrik frontend.
16. Black-box test.

Status: **AMAN**, tetapi penomoran perlu disesuaikan saat dipindahkan ke Word.

### 7.2 Gambar

Gambar yang perlu disiapkan:

1. Kerangka pemikiran.
2. Arsitektur sistem.
3. Alur penelitian.
4. Alur praproses.
5. Alur training IndoBERT.
6. Alur BERTopic.
7. Distribusi dataset.
8. Kurva training.
9. Confusion matrix validation/test.
10. ROC curve validation/test.
11. Kalibrasi threshold.
12. Distribusi topik.
13. Topik per label.
14. Heatmap c-TF-IDF.
15. Distribusi c-TF-IDF.
16. Screenshot halaman utama.
17. Screenshot hasil analisis.
18. Screenshot panel evaluasi.

Status: **PERLU TINDAKAN** untuk render diagram dan screenshot final.

---

## 8. Placeholder Screenshot

| Item | Status | Rekomendasi |
|---|---|---|
| Screenshot halaman utama | PERLU DIAMBIL | Ambil dari frontend terbaru. |
| Screenshot hasil verdict | PERLU DIAMBIL | Gunakan input contoh berita multi-paragraf. |
| Screenshot highlight | PERLU DIAMBIL | Pastikan mode deteksi per kalimat aktif. |
| Screenshot topik paragraf | PERLU DIAMBIL | Aktifkan toggle topik jika tersedia. |
| Screenshot panel metrik | WAJIB DIAMBIL ULANG | Pastikan threshold 0,30, training date 14 Mei 2026, DBCV -0,0133, outlier 21,90%, topik 79. |

---

## 9. Referensi

Status referensi: **PERLU VERIFIKASI AKHIR**.

Catatan:

1. BAB II sudah menggunakan daftar pustaka dengan judul “Daftar Pustaka”.
2. Metadata APA perlu diverifikasi menggunakan reference manager.
3. Pastikan seluruh sitasi di teks memiliki entri daftar pustaka.
4. Pastikan seluruh entri daftar pustaka dikutip di teks.
5. Pedoman mensyaratkan penulisan akademik formal dan tata cara sitasi yang konsisten.

---

## 10. Masalah Kritis

Tidak ditemukan masalah kritis pada substansi teknis setelah revisi, sepanjang file revisi dipakai sebagai naskah final dan tidak dicampur kembali dengan dokumen lama.

Masalah kritis yang akan muncul jika dokumen lama ikut dipakai:

1. Angka dataset lama dapat kembali muncul.
2. Threshold lama dapat kembali muncul.
3. Narasi dataset sangat tidak seimbang dapat bertentangan dengan rasio hoaks 48,6%.
4. DBCV dapat salah ditafsirkan jika masih memakai narasi positif kuat.
5. Screenshot lama dapat menampilkan angka yang tidak sinkron.

---

## 11. Masalah Minor

| No | Masalah Minor | Rekomendasi |
|---:|---|---|
| 1 | Penomoran tabel/gambar belum final | Finalisasi saat pemindahan ke Word. |
| 2 | Gambar Mermaid belum dirender | Render ke PNG/SVG. |
| 3 | Screenshot frontend belum tersedia | Ambil ulang setelah deployment terbaru aktif. |
| 4 | Referensi belum diverifikasi melalui reference manager | Finalisasi sebelum sidang. |
| 5 | Beberapa istilah UI seperti confidence dan highlight bisa dimiringkan | Konsistenkan saat final formatting. |

---

## 12. Keputusan Audit Final

Dokumen revisi dinyatakan **konsisten secara metodologis dan teknis** dengan eksperimen terbaru. Naskah dapat dilanjutkan ke tahap pemindahan ke Word, rendering diagram, pengambilan screenshot, dan finalisasi referensi.
