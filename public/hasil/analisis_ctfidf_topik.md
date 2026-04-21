# Analisis c-TFIDF per Topik dan Kategori

## Ringkasan dataset

- File sumber: `public/hasil/evaluasi_ctfidf_topik.csv`
- Jumlah baris data: **750**
- Jumlah kolom: **9**
- Jumlah topik unik (`Topik_ID`): **75**
- Jumlah kategori unik (`Kategori`): **16**
- Struktur baris konsisten: setiap topik memiliki **10 kata** berperingkat.
- Konsistensi metadata per topik (`Coverage` dan `Keyword_Ditemukan`): **konsisten**.

### Kolom penting

| Kolom | Peran dalam analisis |
| --- | --- |
| `Topik_ID` | Identitas topik. Dipakai untuk pengelompokan kata dan penghitungan eksklusivitas lintas topik. |
| `Kategori` | Label kategori topik. Dipakai untuk agregasi tingkat kategori dan eksklusivitas lintas kategori. |
| `Nama_Topik` | Nama topik hasil model. Dipakai untuk konteks interpretasi. |
| `Rank` | Urutan kata di dalam topik. Dipakai sebagai urutan baca; validasi menunjukkan tiap topik punya 10 rank. |
| `Kata` | Token/frasa kandidat yang mewakili topik. Ini adalah unit utama analisis. |
| `Skor_cTFIDF` | Bobot utama. Semakin tinggi nilainya, semakin kuat kontribusi kata terhadap topik itu. |
| `Keyword_Ditemukan` | Keyword kategori yang cocok dengan topik. Dipakai untuk membaca kecocokan topik terhadap kamus kategori. |
| `Coverage` | Rasio `keyword ditemukan / total keyword kategori`. Dipakai sebagai sinyal tambahan, bukan dasar utama ranking. |
| `Keyword_Kategori_Lengkap` | Daftar keyword kategori penuh. Dipakai hanya untuk konteks interpretasi coverage. |

### Ringkasan kategori

| Kategori | Jumlah topik | Topik dengan keyword hit | Topik tanpa keyword hit | Rata-rata coverage |
| --- | ---: | ---: | ---: | ---: |
| Topik Umum | 29 | 0 | 29 | - |
| Ekonomi & Bisnis | 9 | 9 | 0 | 3.89% |
| Internasional | 5 | 5 | 0 | 3.95% |
| Kesehatan | 5 | 5 | 0 | 4.42% |
| Lingkungan & Energi | 4 | 4 | 0 | 3.57% |
| Transportasi & Infrastruktur | 4 | 4 | 0 | 5.60% |
| Politik | 3 | 2 | 1 | 4.44% |
| Teknologi & Sains | 3 | 3 | 0 | 4.17% |
| Bencana & Cuaca | 2 | 1 | 1 | 6.12% |
| Hiburan & Gaya Hidup | 2 | 2 | 0 | 3.25% |
| Kriminal & Hukum | 2 | 2 | 0 | 9.65% |
| Nasional & Pemerintahan | 2 | 2 | 0 | 3.91% |
| Olahraga | 2 | 2 | 0 | 6.03% |
| Keamanan & Pertahanan | 1 | 1 | 0 | 8.33% |
| Pendidikan | 1 | 1 | 0 | 10.94% |
| Topik Noise (Topic 0) | 1 | 0 | 1 | - |

### Statistik global kata

- Jumlah kata/frasa unik pada seluruh file: **658**
- Kata yang hanya muncul pada **1 topik**: **579** (87.99%)
- Kata yang hanya muncul pada **1 kategori**: **606** (92.10%)
- Keputusan analisis: `Skor_cTFIDF` dipakai sebagai dasar utama. Eksklusivitas lintas topik/kategori dipakai sebagai penguat untuk menilai kata pembeda.

## Kata paling berpengaruh per kategori

Metode: untuk setiap kategori, semua kata dari topik-topik di kategori tersebut diagregasi. Urutan utama memakai `Topik_Di_Kategori`, lalu `Skor_Total_cTFIDF`, lalu `Skor_Maks_cTFIDF`.

### Bencana & Cuaca

- Jumlah topik: **2**, rata-rata coverage: **6.12%**, topik dengan keyword hit: **1**.
- Kata pembeda kategori teratas: gunung (topik:1, total:0.502239), bukit (topik:1, total:0.228042), banjir (topik:1, total:0.199154), gempa (topik:1, total:0.137845), hujan (topik:1, total:0.123438)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| gunung | 1 | 0.502239 | 0.502239 | 1 | eksklusif_kategori |
| bukit | 1 | 0.228042 | 0.228042 | 1 | eksklusif_kategori |
| banjir | 1 | 0.199154 | 0.199154 | 1 | eksklusif_kategori |
| gempa | 1 | 0.137845 | 0.137845 | 1 | eksklusif_kategori |
| hujan | 1 | 0.123438 | 0.123438 | 1 | eksklusif_kategori |
| puncak | 1 | 0.091366 | 0.091366 | 1 | eksklusif_kategori |
| abu | 1 | 0.090950 | 0.090950 | 1 | eksklusif_kategori |
| kolom | 1 | 0.083036 | 0.083036 | 1 | eksklusif_kategori |
| meter | 1 | 0.074341 | 0.074341 | 2 | shared_2_kategori |
| atas | 1 | 0.049512 | 0.049512 | 1 | eksklusif_kategori |

### Ekonomi & Bisnis

- Jumlah topik: **9**, rata-rata coverage: **3.89%**, topik dengan keyword hit: **9**.
- Kata pembeda kategori teratas: pasar (topik:2, total:0.123036), impor (topik:2, total:0.115440), gaji (topik:2, total:0.091577), rupiah (topik:2, total:0.086552), diskon (topik:2, total:0.080797)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| harga | 5 | 0.498516 | 0.188332 | 3 | shared_3_kategori |
| bisnis | 2 | 0.530717 | 0.497111 | 2 | shared_2_kategori |
| pasar | 2 | 0.123036 | 0.064693 | 1 | eksklusif_kategori |
| impor | 2 | 0.115440 | 0.072287 | 1 | eksklusif_kategori |
| gaji | 2 | 0.091577 | 0.070538 | 1 | eksklusif_kategori |
| rupiah | 2 | 0.086552 | 0.058617 | 1 | eksklusif_kategori |
| diskon | 2 | 0.080797 | 0.059561 | 1 | eksklusif_kategori |
| gula | 1 | 0.572777 | 0.572777 | 1 | eksklusif_kategori |
| saham | 1 | 0.556950 | 0.556950 | 1 | eksklusif_kategori |
| pajak | 1 | 0.288096 | 0.288096 | 1 | eksklusif_kategori |

### Hiburan & Gaya Hidup

- Jumlah topik: **2**, rata-rata coverage: **3.25%**, topik dengan keyword hit: **2**.
- Kata pembeda kategori teratas: nonton (topik:2, total:0.183580), film (topik:1, total:0.346080), video (topik:1, total:0.184869), youtube (topik:1, total:0.124751), streaming (topik:1, total:0.106474)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| nonton | 2 | 0.183580 | 0.129274 | 1 | eksklusif_kategori |
| bintang | 1 | 0.409815 | 0.409815 | 2 | shared_2_kategori |
| film | 1 | 0.346080 | 0.346080 | 1 | eksklusif_kategori |
| video | 1 | 0.184869 | 0.184869 | 1 | eksklusif_kategori |
| youtube | 1 | 0.124751 | 0.124751 | 1 | eksklusif_kategori |
| streaming | 1 | 0.106474 | 0.106474 | 1 | eksklusif_kategori |
| cctv | 1 | 0.061609 | 0.061609 | 1 | eksklusif_kategori |
| trans | 1 | 0.054879 | 0.054879 | 1 | eksklusif_kategori |
| telkomsel | 1 | 0.049549 | 0.049549 | 2 | shared_2_kategori |
| telkom | 1 | 0.037017 | 0.037017 | 2 | shared_2_kategori |

### Internasional

- Jumlah topik: **5**, rata-rata coverage: **3.95%**, topik dengan keyword hit: **5**.
- Kata pembeda kategori teratas: iran (topik:2, total:0.276117), israel (topik:2, total:0.105986), australia (topik:1, total:0.711334), inggris (topik:1, total:0.680947), rusia (topik:1, total:0.301015)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| iran | 2 | 0.276117 | 0.252668 | 1 | eksklusif_kategori |
| israel | 2 | 0.105986 | 0.070984 | 1 | eksklusif_kategori |
| australia | 1 | 0.711334 | 0.711334 | 1 | eksklusif_kategori |
| inggris | 1 | 0.680947 | 0.680947 | 1 | eksklusif_kategori |
| rusia | 1 | 0.301015 | 0.301015 | 1 | eksklusif_kategori |
| united | 1 | 0.256390 | 0.256390 | 1 | eksklusif_kategori |
| motogp | 1 | 0.236627 | 0.236627 | 1 | eksklusif_kategori |
| ukraina | 1 | 0.194997 | 0.194997 | 1 | eksklusif_kategori |
| posisi | 1 | 0.143803 | 0.143803 | 1 | eksklusif_kategori |
| eropa | 1 | 0.126630 | 0.126630 | 1 | eksklusif_kategori |

### Keamanan & Pertahanan

- Jumlah topik: **1**, rata-rata coverage: **8.33%**, topik dengan keyword hit: **1**.
- Kata pembeda kategori teratas: militer (topik:1, total:0.084383), pasukan (topik:1, total:0.062337), tni (topik:1, total:0.060128), angkatan (topik:1, total:0.045759), darat (topik:1, total:0.041334)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| perang | 1 | 0.176177 | 0.176177 | 2 | shared_2_kategori |
| militer | 1 | 0.084383 | 0.084383 | 1 | eksklusif_kategori |
| tentara | 1 | 0.067891 | 0.067891 | 2 | shared_2_kategori |
| prajurit | 1 | 0.064708 | 0.064708 | 2 | shared_2_kategori |
| pasukan | 1 | 0.062337 | 0.062337 | 1 | eksklusif_kategori |
| tni | 1 | 0.060128 | 0.060128 | 1 | eksklusif_kategori |
| angkatan | 1 | 0.045759 | 0.045759 | 1 | eksklusif_kategori |
| darat | 1 | 0.041334 | 0.041334 | 1 | eksklusif_kategori |
| tni angkatan | 1 | 0.034459 | 0.034459 | 1 | eksklusif_kategori |
| gaza | 1 | 0.031562 | 0.031562 | 2 | shared_2_kategori |

### Kesehatan

- Jumlah topik: **5**, rata-rata coverage: **4.42%**, topik dengan keyword hit: **5**.
- Kata pembeda kategori teratas: kesehatan (topik:3, total:0.468116), pasien (topik:2, total:0.076720), sakit (topik:2, total:0.056456), kanker (topik:1, total:1.143495), lockdown (topik:1, total:0.474398)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| kesehatan | 3 | 0.468116 | 0.403000 | 1 | eksklusif_kategori |
| covid | 2 | 0.104724 | 0.071405 | 2 | shared_2_kategori |
| pasien | 2 | 0.076720 | 0.059624 | 1 | eksklusif_kategori |
| sakit | 2 | 0.056456 | 0.037946 | 1 | eksklusif_kategori |
| kanker | 1 | 1.143495 | 1.143495 | 1 | eksklusif_kategori |
| lockdown | 1 | 0.474398 | 0.474398 | 1 | eksklusif_kategori |
| masker | 1 | 0.472641 | 0.472641 | 1 | eksklusif_kategori |
| corona | 1 | 0.194668 | 0.194668 | 2 | shared_2_kategori |
| kesehatan kesehatan | 1 | 0.156825 | 0.156825 | 1 | eksklusif_kategori |
| wajah | 1 | 0.153902 | 0.153902 | 1 | eksklusif_kategori |

### Kriminal & Hukum

- Jumlah topik: **2**, rata-rata coverage: **9.65%**, topik dengan keyword hit: **2**.
- Kata pembeda kategori teratas: tersangka (topik:2, total:0.055939), polisi (topik:1, total:0.122096), seksual (topik:1, total:0.106688), wanita (topik:1, total:0.071300), hakim (topik:1, total:0.063133)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| tersangka | 2 | 0.055939 | 0.028795 | 1 | eksklusif_kategori |
| pelaku | 2 | 0.050893 | 0.029019 | 2 | shared_2_kategori |
| polisi | 1 | 0.122096 | 0.122096 | 1 | eksklusif_kategori |
| seksual | 1 | 0.106688 | 0.106688 | 1 | eksklusif_kategori |
| wanita | 1 | 0.071300 | 0.071300 | 1 | eksklusif_kategori |
| hakim | 1 | 0.063133 | 0.063133 | 1 | eksklusif_kategori |
| kekerasan | 1 | 0.058029 | 0.058029 | 1 | eksklusif_kategori |
| korban | 1 | 0.048367 | 0.048367 | 2 | shared_2_kategori |
| perempuan | 1 | 0.046780 | 0.046780 | 1 | eksklusif_kategori |
| dokter | 1 | 0.040266 | 0.040266 | 2 | shared_2_kategori |

### Lingkungan & Energi

- Jumlah topik: **4**, rata-rata coverage: **3.57%**, topik dengan keyword hit: **4**.
- Kata pembeda kategori teratas: gas (topik:2, total:0.162941), bukan bukan (topik:1, total:0.298122), sampah (topik:1, total:0.253387), minyak (topik:1, total:0.200851), kebakaran (topik:1, total:0.180223)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| gas | 2 | 0.162941 | 0.103232 | 1 | eksklusif_kategori |
| bukan bukan | 1 | 0.298122 | 0.298122 | 1 | eksklusif_kategori |
| sampah | 1 | 0.253387 | 0.253387 | 1 | eksklusif_kategori |
| udara | 1 | 0.233386 | 0.233386 | 2 | shared_2_kategori |
| minyak | 1 | 0.200851 | 0.200851 | 1 | eksklusif_kategori |
| kebakaran | 1 | 0.180223 | 0.180223 | 1 | eksklusif_kategori |
| kualitas | 1 | 0.153286 | 0.153286 | 1 | eksklusif_kategori |
| terbakar | 1 | 0.111228 | 0.111228 | 1 | eksklusif_kategori |
| api | 1 | 0.109482 | 0.109482 | 2 | shared_2_kategori |
| umim bukan | 1 | 0.103059 | 0.103059 | 1 | eksklusif_kategori |

### Nasional & Pemerintahan

- Jumlah topik: **2**, rata-rata coverage: **3.91%**, topik dengan keyword hit: **2**.
- Kata pembeda kategori teratas: mulai (topik:1, total:0.457173), new normal (topik:1, total:0.363323), normal (topik:1, total:0.362346), new (topik:1, total:0.305123), dimulai (topik:1, total:0.159248)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| mulai | 1 | 0.457173 | 0.457173 | 1 | eksklusif_kategori |
| new normal | 1 | 0.363323 | 0.363323 | 1 | eksklusif_kategori |
| normal | 1 | 0.362346 | 0.362346 | 1 | eksklusif_kategori |
| new | 1 | 0.305123 | 0.305123 | 1 | eksklusif_kategori |
| dimulai | 1 | 0.159248 | 0.159248 | 1 | eksklusif_kategori |
| pemerintah | 1 | 0.126852 | 0.126852 | 1 | eksklusif_kategori |
| ikn | 1 | 0.080593 | 0.080593 | 1 | eksklusif_kategori |
| proyek | 1 | 0.080593 | 0.080593 | 1 | eksklusif_kategori |
| anggaran | 1 | 0.072975 | 0.072975 | 1 | eksklusif_kategori |
| donasi | 1 | 0.055296 | 0.055296 | 1 | eksklusif_kategori |

### Olahraga

- Jumlah topik: **2**, rata-rata coverage: **6.03%**, topik dengan keyword hit: **2**.
- Kata pembeda kategori teratas: laga (topik:2, total:0.127073), final (topik:1, total:0.113307), korea (topik:1, total:0.113078), timnas (topik:1, total:0.071526), kawan (topik:1, total:0.057948)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| laga | 2 | 0.127073 | 0.089022 | 1 | eksklusif_kategori |
| liga | 1 | 0.134314 | 0.134314 | 2 | shared_2_kategori |
| megawati | 1 | 0.121884 | 0.121884 | 2 | shared_2_kategori |
| final | 1 | 0.113307 | 0.113307 | 1 | eksklusif_kategori |
| korea | 1 | 0.113078 | 0.113078 | 1 | eksklusif_kategori |
| poin | 1 | 0.084386 | 0.084386 | 2 | shared_2_kategori |
| timnas | 1 | 0.071526 | 0.071526 | 1 | eksklusif_kategori |
| kawan | 1 | 0.057948 | 0.057948 | 1 | eksklusif_kategori |
| pemain | 1 | 0.057124 | 0.057124 | 1 | eksklusif_kategori |
| piala | 1 | 0.055820 | 0.055820 | 1 | eksklusif_kategori |

### Pendidikan

- Jumlah topik: **1**, rata-rata coverage: **10.94%**, topik dengan keyword hit: **1**.
- Kata pembeda kategori teratas: sekolah (topik:1, total:0.132043), pelajar (topik:1, total:0.098556), mahasiswa (topik:1, total:0.097322), siswa (topik:1, total:0.092638), guru (topik:1, total:0.086038)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| sekolah | 1 | 0.132043 | 0.132043 | 1 | eksklusif_kategori |
| pelajar | 1 | 0.098556 | 0.098556 | 1 | eksklusif_kategori |
| mahasiswa | 1 | 0.097322 | 0.097322 | 1 | eksklusif_kategori |
| siswa | 1 | 0.092638 | 0.092638 | 1 | eksklusif_kategori |
| guru | 1 | 0.086038 | 0.086038 | 1 | eksklusif_kategori |
| belajar | 1 | 0.072829 | 0.072829 | 1 | eksklusif_kategori |
| pendidikan | 1 | 0.057650 | 0.057650 | 1 | eksklusif_kategori |
| sma | 1 | 0.032590 | 0.032590 | 1 | eksklusif_kategori |
| kampus | 1 | 0.032510 | 0.032510 | 1 | eksklusif_kategori |
| kelas | 1 | 0.028818 | 0.028818 | 1 | eksklusif_kategori |

### Politik

- Jumlah topik: **3**, rata-rata coverage: **4.44%**, topik dengan keyword hit: **2**.
- Kata pembeda kategori teratas: hitam (topik:1, total:0.662071), pdf (topik:1, total:0.346495), pdp (topik:1, total:0.321080), psbb (topik:1, total:0.198958), pdip (topik:1, total:0.197574)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| hitam | 1 | 0.662071 | 0.662071 | 1 | eksklusif_kategori |
| pdf | 1 | 0.346495 | 0.346495 | 1 | eksklusif_kategori |
| pdp | 1 | 0.321080 | 0.321080 | 1 | eksklusif_kategori |
| psbb | 1 | 0.198958 | 0.198958 | 1 | eksklusif_kategori |
| pdip | 1 | 0.197574 | 0.197574 | 1 | eksklusif_kategori |
| putih | 1 | 0.158629 | 0.158629 | 1 | eksklusif_kategori |
| pkb | 1 | 0.146381 | 0.146381 | 1 | eksklusif_kategori |
| ppp | 1 | 0.144222 | 0.144222 | 1 | eksklusif_kategori |
| pks | 1 | 0.129351 | 0.129351 | 1 | eksklusif_kategori |
| paham | 1 | 0.106197 | 0.106197 | 1 | eksklusif_kategori |

### Teknologi & Sains

- Jumlah topik: **3**, rata-rata coverage: **4.17%**, topik dengan keyword hit: **3**.
- Kata pembeda kategori teratas: teknologi (topik:2, total:0.139440), google (topik:1, total:0.252709), digital (topik:1, total:0.173149), nge (topik:1, total:0.153437), bulan (topik:1, total:0.149599)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| teknologi | 2 | 0.139440 | 0.105182 | 1 | eksklusif_kategori |
| india | 1 | 1.228957 | 1.228957 | 2 | shared_2_kategori |
| bumi | 1 | 0.272780 | 0.272780 | 2 | shared_2_kategori |
| google | 1 | 0.252709 | 0.252709 | 1 | eksklusif_kategori |
| digital | 1 | 0.173149 | 0.173149 | 1 | eksklusif_kategori |
| nge | 1 | 0.153437 | 0.153437 | 1 | eksklusif_kategori |
| bulan | 1 | 0.149599 | 0.149599 | 1 | eksklusif_kategori |
| aplikasi | 1 | 0.139012 | 0.139012 | 1 | eksklusif_kategori |
| microsoft | 1 | 0.135573 | 0.135573 | 1 | eksklusif_kategori |
| indo | 1 | 0.128106 | 0.128106 | 1 | eksklusif_kategori |

### Topik Noise (Topic 0)

- Jumlah topik: **1**, rata-rata coverage: **-**, topik dengan keyword hit: **0**.
- Kata pembeda kategori teratas: suara (topik:1, total:0.067899), covid covid (topik:1, total:0.062038), nasional nasional (topik:1, total:0.052217), merdeka (topik:1, total:0.033599), terkini (topik:1, total:0.031408)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| covid | 1 | 0.076295 | 0.076295 | 2 | shared_2_kategori |
| suara | 1 | 0.067899 | 0.067899 | 1 | eksklusif_kategori |
| covid covid | 1 | 0.062038 | 0.062038 | 1 | eksklusif_kategori |
| nasional nasional | 1 | 0.052217 | 0.052217 | 1 | eksklusif_kategori |
| malang | 1 | 0.039759 | 0.039759 | 2 | shared_2_kategori |
| merdeka | 1 | 0.033599 | 0.033599 | 1 | eksklusif_kategori |
| terkini | 1 | 0.031408 | 0.031408 | 1 | eksklusif_kategori |
| gambar | 1 | 0.031310 | 0.031310 | 1 | eksklusif_kategori |
| suara suara | 1 | 0.030867 | 0.030867 | 1 | eksklusif_kategori |
| bunda | 1 | 0.030767 | 0.030767 | 2 | shared_2_kategori |

### Topik Umum

- Jumlah topik: **29**, rata-rata coverage: **-**, topik dengan keyword hit: **0**.
- Kata pembeda kategori teratas: spares (topik:2, total:0.667932), nomor (topik:2, total:0.338677), lucu (topik:2, total:0.167089), suami (topik:2, total:0.163223), ndiricis (topik:2, total:0.153207)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| spares | 2 | 0.667932 | 0.621123 | 1 | eksklusif_kategori |
| nomor | 2 | 0.338677 | 0.305061 | 1 | eksklusif_kategori |
| lucu | 2 | 0.167089 | 0.114087 | 1 | eksklusif_kategori |
| licitud | 2 | 0.166218 | 0.104145 | 3 | shared_3_kategori |
| suami | 2 | 0.163223 | 0.089911 | 1 | eksklusif_kategori |
| ndiricis | 2 | 0.153207 | 0.098869 | 1 | eksklusif_kategori |
| harga | 2 | 0.124596 | 0.076847 | 3 | shared_3_kategori |
| akun | 2 | 0.123460 | 0.085318 | 1 | eksklusif_kategori |
| pita | 2 | 0.119223 | 0.071351 | 1 | eksklusif_kategori |
| makan | 2 | 0.109304 | 0.071974 | 1 | eksklusif_kategori |

### Transportasi & Infrastruktur

- Jumlah topik: **4**, rata-rata coverage: **5.60%**, topik dengan keyword hit: **4**.
- Kata pembeda kategori teratas: penumpang (topik:2, total:0.080255), pesawat (topik:1, total:0.247734), kereta (topik:1, total:0.235926), ikan (topik:1, total:0.192938), bandara (topik:1, total:0.178938)

| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| penumpang | 2 | 0.080255 | 0.045340 | 1 | eksklusif_kategori |
| pesawat | 1 | 0.247734 | 0.247734 | 1 | eksklusif_kategori |
| kereta | 1 | 0.235926 | 0.235926 | 1 | eksklusif_kategori |
| ikan | 1 | 0.192938 | 0.192938 | 1 | eksklusif_kategori |
| bandara | 1 | 0.178938 | 0.178938 | 1 | eksklusif_kategori |
| kapal | 1 | 0.151583 | 0.151583 | 1 | eksklusif_kategori |
| kereta api | 1 | 0.130632 | 0.130632 | 1 | eksklusif_kategori |
| api | 1 | 0.109558 | 0.109558 | 2 | shared_2_kategori |
| kendaraan | 1 | 0.070246 | 0.070246 | 2 | shared_2_kategori |
| lalu lintas | 1 | 0.070189 | 0.070189 | 1 | eksklusif_kategori |

## Kata paling berpengaruh per topik

Metode: untuk setiap topik, kata diurutkan menurut `Rank` dan diverifikasi kembali dengan `Skor_cTFIDF`. Kolom `Frekuensi_Topik_Global` dan `Frekuensi_Kategori_Global` ditambahkan untuk menunjukkan daya pembeda.

### Topik 0 - Topik Noise (Topic 0) - Topik Noise (Topic 0)

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: suara (eksklusif_topik; 0.067899), covid covid (eksklusif_topik; format/noise?; 0.062038), nasional nasional (eksklusif_topik; format/noise?; 0.052217), merdeka (eksklusif_topik; 0.033599), terkini (eksklusif_topik; 0.031408)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | covid | 0.076295 | 3 | 2 | shared_3_topik |
| 2 | suara | 0.067899 | 1 | 1 | eksklusif_topik |
| 3 | covid covid | 0.062038 | 1 | 1 | eksklusif_topik; format/noise? |
| 4 | nasional nasional | 0.052217 | 1 | 1 | eksklusif_topik; format/noise? |
| 5 | malang | 0.039759 | 2 | 2 | shared_2_topik |
| 6 | merdeka | 0.033599 | 1 | 1 | eksklusif_topik |
| 7 | terkini | 0.031408 | 1 | 1 | eksklusif_topik |
| 8 | gambar | 0.031310 | 1 | 1 | eksklusif_topik |
| 9 | suara suara | 0.030867 | 1 | 1 | eksklusif_topik; format/noise? |
| 10 | bunda | 0.030767 | 2 | 2 | shared_2_topik |

### Topik 1 - Topik Umum - 1_indonesia_wisata_papua_china

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: indonesia (eksklusif_topik; 0.058971), wisata (eksklusif_topik; 0.056181), papua (eksklusif_topik; 0.037015), china (eksklusif_topik; 0.036835), yogyakarta (eksklusif_topik; 0.024884)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | indonesia | 0.058971 | 1 | 1 | eksklusif_topik |
| 2 | wisata | 0.056181 | 1 | 1 | eksklusif_topik |
| 3 | papua | 0.037015 | 1 | 1 | eksklusif_topik |
| 4 | china | 0.036835 | 1 | 1 | eksklusif_topik |
| 5 | yogyakarta | 0.024884 | 1 | 1 | eksklusif_topik |
| 6 | jakarta selatan | 0.021743 | 2 | 1 | khas_kategori |
| 7 | selatan | 0.021241 | 2 | 1 | khas_kategori |
| 8 | indonesia indonesia | 0.020885 | 1 | 1 | eksklusif_topik; format/noise? |
| 9 | bank | 0.019868 | 2 | 2 | shared_2_topik |
| 10 | indonesian | 0.018928 | 1 | 1 | eksklusif_topik |

### Topik 2 - Kesehatan - 2_corona_virus_virus corona_covid

- Coverage: **5/95** (5.26%)
- Keyword ditemukan: **covid\|pandemi\|pasien\|vaksin\|virus**
- Kata pembeda topik teratas: virus (eksklusif_topik; 0.142215), virus corona (eksklusif_topik; 0.100213), positif (eksklusif_topik; 0.069075), positif corona (eksklusif_topik; 0.055016), vaksin (eksklusif_topik; 0.048899)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | corona | 0.194668 | 2 | 2 | shared_2_topik |
| 2 | virus | 0.142215 | 1 | 1 | eksklusif_topik |
| 3 | virus corona | 0.100213 | 1 | 1 | eksklusif_topik |
| 4 | covid | 0.071405 | 3 | 2 | shared_3_topik |
| 5 | positif | 0.069075 | 1 | 1 | eksklusif_topik |
| 6 | positif corona | 0.055016 | 1 | 1 | eksklusif_topik |
| 7 | vaksin | 0.048899 | 1 | 1 | eksklusif_topik |
| 8 | pandemi | 0.025081 | 1 | 1 | eksklusif_topik |
| 9 | viral | 0.019909 | 2 | 2 | shared_2_topik |
| 10 | pasien | 0.017096 | 2 | 1 | khas_kategori |

### Topik 3 - Topik Umum - 3_kompas_jakarta kompas_facebook_akun

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: kompas (eksklusif_topik; 0.112659), jakarta kompas (eksklusif_topik; 0.102524), facebook (eksklusif_topik; format/noise?; 0.047038), akun facebook (eksklusif_topik; format/noise?; 0.026949), instagram (eksklusif_topik; 0.025287)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kompas | 0.112659 | 1 | 1 | eksklusif_topik |
| 2 | jakarta kompas | 0.102524 | 1 | 1 | eksklusif_topik |
| 3 | facebook | 0.047038 | 1 | 1 | eksklusif_topik; format/noise? |
| 4 | akun | 0.038142 | 2 | 1 | khas_kategori |
| 5 | akun facebook | 0.026949 | 1 | 1 | eksklusif_topik; format/noise? |
| 6 | instagram | 0.025287 | 1 | 1 | eksklusif_topik |
| 7 | gubernur | 0.020503 | 1 | 1 | eksklusif_topik |
| 8 | jakarta jakarta | 0.019208 | 1 | 1 | eksklusif_topik; format/noise? |
| 9 | media sosial | 0.017394 | 1 | 1 | eksklusif_topik |
| 10 | wakil | 0.016634 | 1 | 1 | eksklusif_topik |

### Topik 4 - Internasional - 4_israel_gaza_masjid_haji

- Coverage: **2/81** (2.47%)
- Keyword ditemukan: **gaza\|israel**
- Kata pembeda topik teratas: masjid (eksklusif_topik; 0.032625), haji (eksklusif_topik; 0.026631), islam (eksklusif_topik; 0.019930), saudi (eksklusif_topik; 0.019482), serangan (eksklusif_topik; 0.018413)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | israel | 0.070984 | 2 | 1 | khas_kategori |
| 2 | gaza | 0.038068 | 2 | 2 | shared_2_topik |
| 3 | masjid | 0.032625 | 1 | 1 | eksklusif_topik |
| 4 | haji | 0.026631 | 1 | 1 | eksklusif_topik |
| 5 | islam | 0.019930 | 1 | 1 | eksklusif_topik |
| 6 | saudi | 0.019482 | 1 | 1 | eksklusif_topik |
| 7 | serangan | 0.018413 | 1 | 1 | eksklusif_topik |
| 8 | arab | 0.018020 | 1 | 1 | eksklusif_topik |
| 9 | paus | 0.015769 | 1 | 1 | eksklusif_topik |
| 10 | fransiskus | 0.012548 | 1 | 1 | eksklusif_topik |

### Topik 5 - Lingkungan & Energi - 5_bukan bukan_sampah_umim bukan_kurang

- Coverage: **2/63** (3.17%)
- Keyword ditemukan: **lingkungan\|sampah**
- Kata pembeda topik teratas: bukan bukan (eksklusif_topik; format/noise?; 0.298122), sampah (eksklusif_topik; 0.253387), umim bukan (eksklusif_topik; 0.103059), kurang (eksklusif_topik; 0.078243), tiada (eksklusif_topik; 0.045951)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | bukan bukan | 0.298122 | 1 | 1 | eksklusif_topik; format/noise? |
| 2 | sampah | 0.253387 | 1 | 1 | eksklusif_topik |
| 3 | umim bukan | 0.103059 | 1 | 1 | eksklusif_topik |
| 4 | kurang | 0.078243 | 1 | 1 | eksklusif_topik |
| 5 | tiada | 0.045951 | 1 | 1 | eksklusif_topik |
| 6 | bukan hanya | 0.038900 | 1 | 1 | eksklusif_topik |
| 7 | plastik | 0.038441 | 1 | 1 | eksklusif_topik |
| 8 | nicznych | 0.036949 | 1 | 1 | eksklusif_topik |
| 9 | rendah | 0.029774 | 1 | 1 | eksklusif_topik |
| 10 | lingkungan | 0.027221 | 1 | 1 | eksklusif_topik |

### Topik 6 - Politik - 6_partai_presiden_jokowi_pemilu

- Coverage: **4/60** (6.67%)
- Keyword ditemukan: **capres\|demokrat\|partai\|pemilu**
- Kata pembeda topik teratas: partai (eksklusif_topik; 0.034005), presiden (eksklusif_topik; 0.024816), jokowi (eksklusif_topik; 0.021797), pemilu (eksklusif_topik; 0.019945), demokrat (eksklusif_topik; 0.016993)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | partai | 0.034005 | 1 | 1 | eksklusif_topik |
| 2 | presiden | 0.024816 | 1 | 1 | eksklusif_topik |
| 3 | jokowi | 0.021797 | 1 | 1 | eksklusif_topik |
| 4 | pemilu | 0.019945 | 1 | 1 | eksklusif_topik |
| 5 | demokrat | 0.016993 | 1 | 1 | eksklusif_topik |
| 6 | politik | 0.016678 | 1 | 1 | eksklusif_topik |
| 7 | ketua | 0.015258 | 1 | 1 | eksklusif_topik |
| 8 | prabowo | 0.015166 | 1 | 1 | eksklusif_topik |
| 9 | menteri | 0.013583 | 1 | 1 | eksklusif_topik |
| 10 | capres | 0.013409 | 1 | 1 | eksklusif_topik |

### Topik 7 - Topik Umum - 7_minggu_tanggal_pekan_oktober

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: minggu (eksklusif_topik; 0.089451), tanggal (eksklusif_topik; 0.087521), oktober (eksklusif_topik; 0.078700), malam (eksklusif_topik; 0.071099), september (eksklusif_topik; 0.062284)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | minggu | 0.089451 | 1 | 1 | eksklusif_topik |
| 2 | tanggal | 0.087521 | 1 | 1 | eksklusif_topik |
| 3 | pekan | 0.085672 | 2 | 2 | shared_2_topik |
| 4 | oktober | 0.078700 | 1 | 1 | eksklusif_topik |
| 5 | malam | 0.071099 | 1 | 1 | eksklusif_topik |
| 6 | september | 0.062284 | 1 | 1 | eksklusif_topik |
| 7 | selasa | 0.056208 | 1 | 1 | eksklusif_topik |
| 8 | sore | 0.050900 | 1 | 1 | eksklusif_topik |
| 9 | april | 0.042498 | 1 | 1 | eksklusif_topik |
| 10 | akhir | 0.036776 | 2 | 1 | khas_kategori |

### Topik 8 - Topik Umum - 8_kota_jawa_selatan_kabupaten

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: kota (eksklusif_topik; 0.082853), jawa (eksklusif_topik; 0.078730), kabupaten (eksklusif_topik; 0.077407), jawa barat (eksklusif_topik; 0.049778), barat (eksklusif_topik; 0.049271)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kota | 0.082853 | 1 | 1 | eksklusif_topik |
| 2 | jawa | 0.078730 | 1 | 1 | eksklusif_topik |
| 3 | selatan | 0.078704 | 2 | 1 | khas_kategori |
| 4 | kabupaten | 0.077407 | 1 | 1 | eksklusif_topik |
| 5 | jawa barat | 0.049778 | 1 | 1 | eksklusif_topik |
| 6 | barat | 0.049271 | 1 | 1 | eksklusif_topik |
| 7 | timur | 0.048681 | 1 | 1 | eksklusif_topik |
| 8 | tangerang | 0.045738 | 1 | 1 | eksklusif_topik |
| 9 | jakarta selatan | 0.045648 | 2 | 1 | khas_kategori |
| 10 | tangerang selatan | 0.045570 | 1 | 1 | eksklusif_topik |

### Topik 9 - Ekonomi & Bisnis - 9_harga_uang_uang asli_gaji

- Coverage: **4/80** (5.00%)
- Keyword ditemukan: **bank\|gaji\|harga\|rupiah**
- Kata pembeda topik teratas: uang (eksklusif_topik; 0.132950), uang asli (eksklusif_topik; 0.081028), asli (eksklusif_topik; 0.066428), murah (eksklusif_topik; 0.066328), harga harga (eksklusif_topik; format/noise?; 0.062529)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | harga | 0.188332 | 8 | 3 | shared_8_topik |
| 2 | uang | 0.132950 | 1 | 1 | eksklusif_topik |
| 3 | uang asli | 0.081028 | 1 | 1 | eksklusif_topik |
| 4 | gaji | 0.070538 | 2 | 1 | khas_kategori |
| 5 | bank | 0.069512 | 2 | 2 | shared_2_topik |
| 6 | asli | 0.066428 | 1 | 1 | eksklusif_topik |
| 7 | murah | 0.066328 | 1 | 1 | eksklusif_topik |
| 8 | harga harga | 0.062529 | 1 | 1 | eksklusif_topik; format/noise? |
| 9 | diskon | 0.059561 | 2 | 1 | khas_kategori |
| 10 | rupiah | 0.058617 | 2 | 1 | khas_kategori |

### Topik 10 - Topik Umum - 10_istri_suami_bayi_nikah

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: istri (eksklusif_topik; 0.115169), bayi (eksklusif_topik; 0.068203), nikah (eksklusif_topik; 0.067987), putri (eksklusif_topik; 0.043497), pernikahan (eksklusif_topik; 0.040765)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | istri | 0.115169 | 1 | 1 | eksklusif_topik |
| 2 | suami | 0.089911 | 2 | 1 | khas_kategori |
| 3 | bayi | 0.068203 | 1 | 1 | eksklusif_topik |
| 4 | nikah | 0.067987 | 1 | 1 | eksklusif_topik |
| 5 | ihsg | 0.050701 | 2 | 2 | shared_2_topik |
| 6 | putri | 0.043497 | 1 | 1 | eksklusif_topik |
| 7 | pernikahan | 0.040765 | 1 | 1 | eksklusif_topik |
| 8 | menikah | 0.037267 | 1 | 1 | eksklusif_topik |
| 9 | damai | 0.036476 | 1 | 1 | eksklusif_topik |
| 10 | ibu | 0.030212 | 1 | 1 | eksklusif_topik |

### Topik 11 - Topik Umum - 11_makanan_resep_makan_beras

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: makanan (eksklusif_topik; 0.087708), resep (eksklusif_topik; 0.073925), beras (eksklusif_topik; 0.071685), enak (eksklusif_topik; 0.062923), bergizi (eksklusif_topik; 0.050840)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | makanan | 0.087708 | 1 | 1 | eksklusif_topik |
| 2 | resep | 0.073925 | 1 | 1 | eksklusif_topik |
| 3 | makan | 0.071974 | 2 | 1 | khas_kategori |
| 4 | beras | 0.071685 | 1 | 1 | eksklusif_topik |
| 5 | enak | 0.062923 | 1 | 1 | eksklusif_topik |
| 6 | bergizi | 0.050840 | 1 | 1 | eksklusif_topik |
| 7 | bergizi gratis | 0.043146 | 1 | 1 | eksklusif_topik |
| 8 | makan bergizi | 0.042376 | 1 | 1 | eksklusif_topik |
| 9 | gratis | 0.041892 | 1 | 1 | eksklusif_topik |
| 10 | ayam | 0.038568 | 1 | 1 | eksklusif_topik |

### Topik 12 - Kesehatan - 12_kesehatan_kesehatan kesehatan_sehat_d

- Coverage: **6/95** (6.32%)
- Keyword ditemukan: **bpjs\|dokter\|jantung\|kesehatan\|medis\|rumah sakit**
- Kata pembeda topik teratas: kesehatan kesehatan (eksklusif_topik; format/noise?; 0.156825), sehat (eksklusif_topik; 0.078041), bpjs (eksklusif_topik; 0.057985), rumah sakit (eksklusif_topik; 0.044751), jantung (eksklusif_topik; 0.044580)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kesehatan | 0.403000 | 3 | 1 | khas_kategori |
| 2 | kesehatan kesehatan | 0.156825 | 1 | 1 | eksklusif_topik; format/noise? |
| 3 | sehat | 0.078041 | 1 | 1 | eksklusif_topik |
| 4 | dokter | 0.064757 | 2 | 2 | shared_2_topik |
| 5 | bpjs | 0.057985 | 1 | 1 | eksklusif_topik |
| 6 | rumah sakit | 0.044751 | 1 | 1 | eksklusif_topik |
| 7 | jantung | 0.044580 | 1 | 1 | eksklusif_topik |
| 8 | sakit | 0.037946 | 2 | 1 | khas_kategori |
| 9 | alat | 0.037529 | 3 | 3 | shared_3_topik |
| 10 | medis | 0.033980 | 1 | 1 | eksklusif_topik |

### Topik 13 - Topik Umum - 13_korban_tutup_meninggal_meninggal duni

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: tutup (eksklusif_topik; 0.070136), meninggal (eksklusif_topik; 0.065898), meninggal dunia (eksklusif_topik; 0.044482), terakhir (eksklusif_topik; 0.040440), tewas (eksklusif_topik; 0.036995)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | korban | 0.108436 | 2 | 2 | shared_2_topik |
| 2 | tutup | 0.070136 | 1 | 1 | eksklusif_topik |
| 3 | meninggal | 0.065898 | 1 | 1 | eksklusif_topik |
| 4 | meninggal dunia | 0.044482 | 1 | 1 | eksklusif_topik |
| 5 | terakhir | 0.040440 | 1 | 1 | eksklusif_topik |
| 6 | tewas | 0.036995 | 1 | 1 | eksklusif_topik |
| 7 | ditutup | 0.036168 | 1 | 1 | eksklusif_topik |
| 8 | ditemukan | 0.024055 | 1 | 1 | eksklusif_topik |
| 9 | pelaku | 0.023807 | 3 | 2 | shared_3_topik |
| 10 | luka | 0.020037 | 1 | 1 | eksklusif_topik |

### Topik 14 - Bencana & Cuaca - 14_banjir_gempa_hujan_sungai

- Coverage: **6/49** (12.24%)
- Keyword ditemukan: **angin\|banjir\|bencana\|bmkg\|gempa\|hujan**
- Kata pembeda topik teratas: banjir (eksklusif_topik; 0.199154), gempa (eksklusif_topik; 0.137845), hujan (eksklusif_topik; 0.123438), sungai (eksklusif_topik; 0.041310), jembatan (eksklusif_topik; 0.041072)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | banjir | 0.199154 | 1 | 1 | eksklusif_topik |
| 2 | gempa | 0.137845 | 1 | 1 | eksklusif_topik |
| 3 | hujan | 0.123438 | 1 | 1 | eksklusif_topik |
| 4 | sungai | 0.041310 | 1 | 1 | eksklusif_topik |
| 5 | jembatan | 0.041072 | 1 | 1 | eksklusif_topik |
| 6 | angin | 0.036252 | 1 | 1 | eksklusif_topik |
| 7 | bumi | 0.034106 | 2 | 2 | shared_2_topik |
| 8 | gelombang | 0.031482 | 1 | 1 | eksklusif_topik |
| 9 | bmkg | 0.028324 | 1 | 1 | eksklusif_topik |
| 10 | bencana | 0.027202 | 2 | 2 | shared_2_topik |

### Topik 15 - Kriminal & Hukum - 15_polisi_hakim_penjara_ditangkap

- Coverage: **9/57** (15.79%)
- Keyword ditemukan: **ditangkap\|hakim\|hukum\|jaksa\|pelaku\|pengadilan\|penjara\|polisi\|tersangka**
- Kata pembeda topik teratas: polisi (eksklusif_topik; 0.122096), hakim (eksklusif_topik; 0.063133), penjara (eksklusif_topik; 0.032977), ditangkap (eksklusif_topik; 0.031030), jaksa (eksklusif_topik; 0.029544)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | polisi | 0.122096 | 1 | 1 | eksklusif_topik |
| 2 | hakim | 0.063133 | 1 | 1 | eksklusif_topik |
| 3 | penjara | 0.032977 | 1 | 1 | eksklusif_topik |
| 4 | ditangkap | 0.031030 | 1 | 1 | eksklusif_topik |
| 5 | jaksa | 0.029544 | 1 | 1 | eksklusif_topik |
| 6 | pelaku | 0.029019 | 3 | 2 | shared_3_topik |
| 7 | tersangka | 0.027144 | 2 | 1 | khas_kategori |
| 8 | pengadilan | 0.026444 | 1 | 1 | eksklusif_topik |
| 9 | hukum | 0.025003 | 1 | 1 | eksklusif_topik |
| 10 | saksi | 0.023311 | 1 | 1 | eksklusif_topik |

### Topik 16 - Transportasi & Infrastruktur - 16_kendaraan_lalu lintas_mobil_tol

- Coverage: **3/58** (5.17%)
- Keyword ditemukan: **jalan\|kendaraan\|tol**
- Kata pembeda topik teratas: lalu lintas (eksklusif_topik; 0.070189), tol (eksklusif_topik; 0.067699), lintas (eksklusif_topik; 0.067542), arah (eksklusif_topik; 0.051490), jalan (eksklusif_topik; 0.048144)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kendaraan | 0.070246 | 2 | 2 | shared_2_topik |
| 2 | lalu lintas | 0.070189 | 1 | 1 | eksklusif_topik |
| 3 | mobil | 0.067740 | 2 | 2 | shared_2_topik |
| 4 | tol | 0.067699 | 1 | 1 | eksklusif_topik |
| 5 | lintas | 0.067542 | 1 | 1 | eksklusif_topik |
| 6 | arah | 0.051490 | 1 | 1 | eksklusif_topik |
| 7 | jalan | 0.048144 | 1 | 1 | eksklusif_topik |
| 8 | lalu | 0.048062 | 1 | 1 | eksklusif_topik |
| 9 | arus | 0.043829 | 1 | 1 | eksklusif_topik |
| 10 | motor | 0.040432 | 1 | 1 | eksklusif_topik |

### Topik 17 - Topik Umum - 17_spares_sparet_spareses_pertamina

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: sparet (eksklusif_topik; 0.293615), spareses (eksklusif_topik; 0.287915), pertamina (eksklusif_topik; 0.203191), lanjut (eksklusif_topik; 0.140945), coms (eksklusif_topik; 0.138018)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | spares | 0.621123 | 2 | 1 | khas_kategori |
| 2 | sparet | 0.293615 | 1 | 1 | eksklusif_topik |
| 3 | spareses | 0.287915 | 1 | 1 | eksklusif_topik |
| 4 | pertamina | 0.203191 | 1 | 1 | eksklusif_topik |
| 5 | lanjut | 0.140945 | 1 | 1 | eksklusif_topik |
| 6 | coms | 0.138018 | 1 | 1 | eksklusif_topik |
| 7 | kuasa | 0.119883 | 1 | 1 | eksklusif_topik |
| 8 | bisnis | 0.074268 | 3 | 2 | shared_3_topik |
| 9 | spareseses | 0.069703 | 1 | 1 | eksklusif_topik |
| 10 | lanjut mengenai | 0.041186 | 1 | 1 | eksklusif_topik |

### Topik 18 - Olahraga - 18_timnas_pemain_piala_timnas indonesia

- Coverage: **5/58** (8.62%)
- Keyword ditemukan: **olahraga\|pelatih\|pemain\|piala\|timnas**
- Kata pembeda topik teratas: timnas (eksklusif_topik; 0.071526), pemain (eksklusif_topik; 0.057124), piala (eksklusif_topik; 0.055820), timnas indonesia (eksklusif_topik; 0.051729), pelatih (eksklusif_topik; 0.039119)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | timnas | 0.071526 | 1 | 1 | eksklusif_topik |
| 2 | pemain | 0.057124 | 1 | 1 | eksklusif_topik |
| 3 | piala | 0.055820 | 1 | 1 | eksklusif_topik |
| 4 | timnas indonesia | 0.051729 | 1 | 1 | eksklusif_topik |
| 5 | pelatih | 0.039119 | 1 | 1 | eksklusif_topik |
| 6 | tim | 0.038653 | 1 | 1 | eksklusif_topik |
| 7 | laga | 0.038051 | 2 | 1 | khas_kategori |
| 8 | asia | 0.035441 | 1 | 1 | eksklusif_topik |
| 9 | bola | 0.035261 | 2 | 2 | shared_2_topik |
| 10 | olahraga | 0.034174 | 1 | 1 | eksklusif_topik |

### Topik 19 - Pendidikan - 19_sekolah_pelajar_mahasiswa_siswa

- Coverage: **7/64** (10.94%)
- Keyword ditemukan: **guru\|kampus\|mahasiswa\|pelajar\|sekolah\|siswa\|sma**
- Kata pembeda topik teratas: sekolah (eksklusif_topik; 0.132043), pelajar (eksklusif_topik; 0.098556), mahasiswa (eksklusif_topik; 0.097322), siswa (eksklusif_topik; 0.092638), guru (eksklusif_topik; 0.086038)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | sekolah | 0.132043 | 1 | 1 | eksklusif_topik |
| 2 | pelajar | 0.098556 | 1 | 1 | eksklusif_topik |
| 3 | mahasiswa | 0.097322 | 1 | 1 | eksklusif_topik |
| 4 | siswa | 0.092638 | 1 | 1 | eksklusif_topik |
| 5 | guru | 0.086038 | 1 | 1 | eksklusif_topik |
| 6 | belajar | 0.072829 | 1 | 1 | eksklusif_topik |
| 7 | pendidikan | 0.057650 | 1 | 1 | eksklusif_topik |
| 8 | sma | 0.032590 | 1 | 1 | eksklusif_topik |
| 9 | kampus | 0.032510 | 1 | 1 | eksklusif_topik |
| 10 | kelas | 0.028818 | 1 | 1 | eksklusif_topik |

### Topik 20 - Ekonomi & Bisnis - 20_bisnis_bisnis bisnis_jual_iklan

- Coverage: **3/80** (3.75%)
- Keyword ditemukan: **bisnis\|pasar\|perusahaan**
- Kata pembeda topik teratas: bisnis bisnis (eksklusif_topik; format/noise?; 0.179300), jual (eksklusif_topik; 0.130629), iklan (eksklusif_topik; 0.103134), berita bisnis (eksklusif_topik; 0.093810), pengusaha (eksklusif_topik; 0.067919)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | bisnis | 0.497111 | 3 | 2 | shared_3_topik |
| 2 | bisnis bisnis | 0.179300 | 1 | 1 | eksklusif_topik; format/noise? |
| 3 | jual | 0.130629 | 1 | 1 | eksklusif_topik |
| 4 | iklan | 0.103134 | 1 | 1 | eksklusif_topik |
| 5 | berita bisnis | 0.093810 | 1 | 1 | eksklusif_topik |
| 6 | pengusaha | 0.067919 | 1 | 1 | eksklusif_topik |
| 7 | perusahaan | 0.066164 | 1 | 1 | eksklusif_topik |
| 8 | pasar | 0.064693 | 2 | 1 | khas_kategori |
| 9 | usaha | 0.055555 | 1 | 1 | eksklusif_topik |
| 10 | jual beli | 0.047847 | 1 | 1 | eksklusif_topik |

### Topik 21 - Topik Umum - 21_obat_narkoba_kuat_alami

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: narkoba (eksklusif_topik; 0.106046), kuat (eksklusif_topik; 0.090121), alami (eksklusif_topik; 0.068924), kopi (eksklusif_topik; 0.057801), minum (eksklusif_topik; 0.055031)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | obat | 0.279500 | 2 | 2 | shared_2_topik |
| 2 | narkoba | 0.106046 | 1 | 1 | eksklusif_topik |
| 3 | kuat | 0.090121 | 1 | 1 | eksklusif_topik |
| 4 | alami | 0.068924 | 1 | 1 | eksklusif_topik |
| 5 | kopi | 0.057801 | 1 | 1 | eksklusif_topik |
| 6 | minum | 0.055031 | 1 | 1 | eksklusif_topik |
| 7 | sembako | 0.037776 | 1 | 1 | eksklusif_topik |
| 8 | cukai | 0.025856 | 1 | 1 | eksklusif_topik |
| 9 | tradisional | 0.021938 | 1 | 1 | eksklusif_topik |
| 10 | surabaya | 0.020025 | 1 | 1 | eksklusif_topik |

### Topik 22 - Politik - 22_pdf_pdp_psbb_pdip

- Coverage: **4/60** (6.67%)
- Keyword ditemukan: **pdip\|pkb\|pks\|ppp**
- Kata pembeda topik teratas: pdf (eksklusif_topik; format/noise?; 0.346495), pdp (eksklusif_topik; 0.321080), psbb (eksklusif_topik; 0.198958), pdip (eksklusif_topik; 0.197574), pkb (eksklusif_topik; 0.146381)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | pdf | 0.346495 | 1 | 1 | eksklusif_topik; format/noise? |
| 2 | pdp | 0.321080 | 1 | 1 | eksklusif_topik |
| 3 | psbb | 0.198958 | 1 | 1 | eksklusif_topik |
| 4 | pdip | 0.197574 | 1 | 1 | eksklusif_topik |
| 5 | pkb | 0.146381 | 1 | 1 | eksklusif_topik |
| 6 | ppp | 0.144222 | 1 | 1 | eksklusif_topik |
| 7 | pks | 0.129351 | 1 | 1 | eksklusif_topik |
| 8 | pns | 0.078677 | 1 | 1 | eksklusif_topik |
| 9 | licitud | 0.065609 | 4 | 3 | shared_4_topik |
| 10 | cych | 0.059109 | 1 | 1 | eksklusif_topik |

### Topik 23 - Topik Umum - 23_korupsi_fakta_pemeriksaan fakta_fakta

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: korupsi (eksklusif_topik; 0.107539), fakta (eksklusif_topik; 0.072136), pemeriksaan fakta (eksklusif_topik; 0.053997), fakta mafindo (eksklusif_topik; 0.051231), mafindo (eksklusif_topik; 0.050764)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | korupsi | 0.107539 | 1 | 1 | eksklusif_topik |
| 2 | fakta | 0.072136 | 1 | 1 | eksklusif_topik |
| 3 | pemeriksaan fakta | 0.053997 | 1 | 1 | eksklusif_topik |
| 4 | fakta mafindo | 0.051231 | 1 | 1 | eksklusif_topik |
| 5 | mafindo | 0.050764 | 1 | 1 | eksklusif_topik |
| 6 | turnbackhoax | 0.050114 | 1 | 1 | eksklusif_topik |
| 7 | mafindo turnbackhoax | 0.049881 | 1 | 1 | eksklusif_topik |
| 8 | pemeriksa fakta | 0.049357 | 1 | 1 | eksklusif_topik |
| 9 | pemeriksa | 0.048889 | 1 | 1 | eksklusif_topik |
| 10 | tim pemeriksa | 0.048782 | 1 | 1 | eksklusif_topik |

### Topik 24 - Transportasi & Infrastruktur - 24_ikan_kapal_laut_pantai

- Coverage: **2/58** (3.45%)
- Keyword ditemukan: **ferry\|kapal**
- Kata pembeda topik teratas: ikan (eksklusif_topik; 0.192938), kapal (eksklusif_topik; 0.151583), laut (eksklusif_topik; 0.063882), pantai (eksklusif_topik; 0.047381), nelayan (eksklusif_topik; 0.046327)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | ikan | 0.192938 | 1 | 1 | eksklusif_topik |
| 2 | kapal | 0.151583 | 1 | 1 | eksklusif_topik |
| 3 | laut | 0.063882 | 1 | 1 | eksklusif_topik |
| 4 | pantai | 0.047381 | 1 | 1 | eksklusif_topik |
| 5 | nelayan | 0.046327 | 1 | 1 | eksklusif_topik |
| 6 | pulau | 0.033440 | 1 | 1 | eksklusif_topik |
| 7 | burung | 0.032107 | 1 | 1 | eksklusif_topik |
| 8 | ferry | 0.024696 | 1 | 1 | eksklusif_topik |
| 9 | jakarta rabu | 0.023130 | 1 | 1 | eksklusif_topik |
| 10 | kepulauan | 0.018866 | 1 | 1 | eksklusif_topik |

### Topik 25 - Ekonomi & Bisnis - 25_emas_juta_harga_apple

- Coverage: **2/80** (2.50%)
- Keyword ditemukan: **harga\|rupiah**
- Kata pembeda topik teratas: emas (eksklusif_topik; 0.182266), juta (eksklusif_topik; 0.091974), apple (eksklusif_topik; 0.059921), miliar (eksklusif_topik; 0.046329), mega (eksklusif_topik; 0.030592)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | emas | 0.182266 | 1 | 1 | eksklusif_topik |
| 2 | juta | 0.091974 | 1 | 1 | eksklusif_topik |
| 3 | harga | 0.076779 | 8 | 3 | shared_8_topik |
| 4 | apple | 0.059921 | 1 | 1 | eksklusif_topik |
| 5 | triliun | 0.054311 | 2 | 2 | shared_2_topik |
| 6 | miliar | 0.046329 | 1 | 1 | eksklusif_topik |
| 7 | megawati | 0.041293 | 2 | 2 | shared_2_topik |
| 8 | mega | 0.030592 | 1 | 1 | eksklusif_topik |
| 9 | ribu | 0.028403 | 1 | 1 | eksklusif_topik |
| 10 | rupiah | 0.027935 | 2 | 1 | khas_kategori |

### Topik 26 - Kesehatan - 26_masker_wajah_gigi_pakai

- Coverage: **2/95** (2.11%)
- Keyword ditemukan: **kesehatan\|penyakit**
- Kata pembeda topik teratas: masker (eksklusif_topik; 0.472641), wajah (eksklusif_topik; 0.153902), gigi (eksklusif_topik; 0.056539), pakai (eksklusif_topik; 0.040188), kain (eksklusif_topik; 0.025410)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | masker | 0.472641 | 1 | 1 | eksklusif_topik |
| 2 | wajah | 0.153902 | 1 | 1 | eksklusif_topik |
| 3 | gigi | 0.056539 | 1 | 1 | eksklusif_topik |
| 4 | pakai | 0.040188 | 1 | 1 | eksklusif_topik |
| 5 | kain | 0.025410 | 1 | 1 | eksklusif_topik |
| 6 | kesehatan | 0.019597 | 3 | 1 | khas_kategori |
| 7 | sakit | 0.018510 | 2 | 1 | khas_kategori |
| 8 | tubuh | 0.017999 | 1 | 1 | eksklusif_topik |
| 9 | penyakit | 0.016617 | 1 | 1 | eksklusif_topik |
| 10 | punggung | 0.016519 | 1 | 1 | eksklusif_topik |

### Topik 27 - Transportasi & Infrastruktur - 27_pesawat_bandara_penerbangan_pilot

- Coverage: **3/58** (5.17%)
- Keyword ditemukan: **bandara\|garuda\|pesawat**
- Kata pembeda topik teratas: pesawat (eksklusif_topik; 0.247734), bandara (eksklusif_topik; 0.178938), penerbangan (eksklusif_topik; 0.070088), pilot (eksklusif_topik; 0.035546), air (eksklusif_topik; 0.021719)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | pesawat | 0.247734 | 1 | 1 | eksklusif_topik |
| 2 | bandara | 0.178938 | 1 | 1 | eksklusif_topik |
| 3 | penerbangan | 0.070088 | 1 | 1 | eksklusif_topik |
| 4 | pilot | 0.035546 | 1 | 1 | eksklusif_topik |
| 5 | penumpang | 0.034915 | 2 | 1 | khas_kategori |
| 6 | tiket | 0.029695 | 2 | 2 | shared_2_topik |
| 7 | jatuh | 0.027795 | 2 | 2 | shared_2_topik |
| 8 | udara | 0.024178 | 2 | 2 | shared_2_topik |
| 9 | air | 0.021719 | 1 | 1 | eksklusif_topik |
| 10 | garuda | 0.021410 | 1 | 1 | eksklusif_topik |

### Topik 28 - Topik Umum - 28_whatsapp_akun_mengatasnamakan_pesan

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: whatsapp (eksklusif_topik; 0.132006), mengatasnamakan (eksklusif_topik; 0.061975), pesan (eksklusif_topik; 0.049414), penipuan (eksklusif_topik; 0.038884), beredar (eksklusif_topik; 0.037207)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | whatsapp | 0.132006 | 1 | 1 | eksklusif_topik |
| 2 | akun | 0.085318 | 2 | 1 | khas_kategori |
| 3 | mengatasnamakan | 0.061975 | 1 | 1 | eksklusif_topik |
| 4 | pesan | 0.049414 | 1 | 1 | eksklusif_topik |
| 5 | penipuan | 0.038884 | 1 | 1 | eksklusif_topik |
| 6 | beredar | 0.037207 | 1 | 1 | eksklusif_topik |
| 7 | hoaks | 0.035837 | 1 | 1 | eksklusif_topik |
| 8 | hoaks link | 0.033726 | 1 | 1 | eksklusif_topik |
| 9 | kategori hoaks | 0.033664 | 1 | 1 | eksklusif_topik |
| 10 | nomor | 0.033616 | 2 | 1 | khas_kategori |

### Topik 29 - Ekonomi & Bisnis - 29_daftar_licitud_lowongan_kerja

- Coverage: **2/80** (2.50%)
- Keyword ditemukan: **buruh\|pekerja**
- Kata pembeda topik teratas: daftar (eksklusif_topik; 0.163453), lowongan (eksklusif_topik; 0.073845), kerja (eksklusif_topik; 0.073694), buruh (eksklusif_topik; 0.067922), pekerja (eksklusif_topik; 0.057920)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | daftar | 0.163453 | 1 | 1 | eksklusif_topik |
| 2 | licitud | 0.080185 | 4 | 3 | shared_4_topik |
| 3 | lowongan | 0.073845 | 1 | 1 | eksklusif_topik |
| 4 | kerja | 0.073694 | 1 | 1 | eksklusif_topik |
| 5 | buruh | 0.067922 | 1 | 1 | eksklusif_topik |
| 6 | pekerja | 0.057920 | 1 | 1 | eksklusif_topik |
| 7 | kartu | 0.055768 | 1 | 1 | eksklusif_topik |
| 8 | kantor | 0.054875 | 1 | 1 | eksklusif_topik |
| 9 | daftar daftar | 0.053050 | 1 | 1 | eksklusif_topik; format/noise? |
| 10 | pekerjaan | 0.051227 | 1 | 1 | eksklusif_topik |

### Topik 30 - Nasional & Pemerintahan - 30_pemerintah_anggaran_donasi_triliun

- Coverage: **3/64** (4.69%)
- Keyword ditemukan: **anggaran\|apbn\|pemerintah**
- Kata pembeda topik teratas: pemerintah (eksklusif_topik; 0.126852), anggaran (eksklusif_topik; 0.072975), donasi (eksklusif_topik; 0.055296), pemerintahan (eksklusif_topik; 0.037602), yayasan (eksklusif_topik; 0.037086)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | pemerintah | 0.126852 | 1 | 1 | eksklusif_topik |
| 2 | anggaran | 0.072975 | 1 | 1 | eksklusif_topik |
| 3 | donasi | 0.055296 | 1 | 1 | eksklusif_topik |
| 4 | triliun | 0.045353 | 2 | 2 | shared_2_topik |
| 5 | pemerintahan | 0.037602 | 1 | 1 | eksklusif_topik |
| 6 | yayasan | 0.037086 | 1 | 1 | eksklusif_topik |
| 7 | apbn | 0.035354 | 1 | 1 | eksklusif_topik |
| 8 | bantuan | 0.034438 | 1 | 1 | eksklusif_topik |
| 9 | dana | 0.033231 | 2 | 2 | shared_2_topik |
| 10 | sebesar | 0.025736 | 1 | 1 | eksklusif_topik |

### Topik 31 - Internasional - 31_rusia_ukraina_eropa_italia

- Coverage: **7/81** (8.64%)
- Keyword ditemukan: **eropa\|iran\|israel\|italia\|perang\|rusia\|ukraina**
- Kata pembeda topik teratas: rusia (eksklusif_topik; 0.301015), ukraina (eksklusif_topik; 0.194997), eropa (eksklusif_topik; 0.126630), italia (eksklusif_topik; 0.091199), spanyol (eksklusif_topik; 0.055488)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | rusia | 0.301015 | 1 | 1 | eksklusif_topik |
| 2 | ukraina | 0.194997 | 1 | 1 | eksklusif_topik |
| 3 | eropa | 0.126630 | 1 | 1 | eksklusif_topik |
| 4 | italia | 0.091199 | 1 | 1 | eksklusif_topik |
| 5 | spanyol | 0.055488 | 1 | 1 | eksklusif_topik |
| 6 | israel | 0.035002 | 2 | 1 | khas_kategori |
| 7 | senjata | 0.034486 | 1 | 1 | eksklusif_topik |
| 8 | uni | 0.028868 | 1 | 1 | eksklusif_topik |
| 9 | perang | 0.027090 | 2 | 2 | shared_2_topik |
| 10 | iran | 0.023449 | 2 | 1 | khas_kategori |

### Topik 32 - Hiburan & Gaya Hidup - 32_video_nonton_youtube_streaming

- Coverage: **2/77** (2.60%)
- Keyword ditemukan: **streaming\|youtube**
- Kata pembeda topik teratas: video (eksklusif_topik; 0.184869), youtube (eksklusif_topik; format/noise?; 0.124751), streaming (eksklusif_topik; 0.106474), cctv (eksklusif_topik; 0.061609), berdurasi (eksklusif_topik; 0.033775)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | video | 0.184869 | 1 | 1 | eksklusif_topik |
| 2 | nonton | 0.129274 | 2 | 1 | khas_kategori |
| 3 | youtube | 0.124751 | 1 | 1 | eksklusif_topik; format/noise? |
| 4 | streaming | 0.106474 | 1 | 1 | eksklusif_topik |
| 5 | cctv | 0.061609 | 1 | 1 | eksklusif_topik |
| 6 | telkomsel | 0.049549 | 2 | 2 | shared_2_topik |
| 7 | telkom | 0.037017 | 2 | 2 | shared_2_topik |
| 8 | berdurasi | 0.033775 | 1 | 1 | eksklusif_topik |
| 9 | online | 0.033649 | 2 | 2 | shared_2_topik |
| 10 | video beredar | 0.032065 | 1 | 1 | eksklusif_topik |

### Topik 33 - Ekonomi & Bisnis - 33_tarif_persen_trump_impor

- Coverage: **3/80** (3.75%)
- Keyword ditemukan: **ekonomi\|ekspor\|impor**
- Kata pembeda topik teratas: tarif (eksklusif_topik; 0.148529), persen (eksklusif_topik; 0.083449), trump (eksklusif_topik; 0.079904), ekspor (eksklusif_topik; 0.068837), kebijakan (eksklusif_topik; 0.064911)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | tarif | 0.148529 | 1 | 1 | eksklusif_topik |
| 2 | persen | 0.083449 | 1 | 1 | eksklusif_topik |
| 3 | trump | 0.079904 | 1 | 1 | eksklusif_topik |
| 4 | impor | 0.072287 | 2 | 1 | khas_kategori |
| 5 | amerika | 0.068891 | 2 | 2 | shared_2_topik |
| 6 | ekspor | 0.068837 | 1 | 1 | eksklusif_topik |
| 7 | kebijakan | 0.064911 | 1 | 1 | eksklusif_topik |
| 8 | amerika serikat | 0.055473 | 2 | 2 | shared_2_topik |
| 9 | donald | 0.053618 | 1 | 1 | eksklusif_topik |
| 10 | ekonomi | 0.049964 | 1 | 1 | eksklusif_topik |

### Topik 34 - Topik Umum - 34_unit_mobil_ponsel_telkom

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: unit (eksklusif_topik; 0.216189), ponsel (eksklusif_topik; 0.122577), mobile (eksklusif_topik; 0.083663), terpercaya (eksklusif_topik; 0.054464), telepon (eksklusif_topik; 0.051553)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | unit | 0.216189 | 1 | 1 | eksklusif_topik |
| 2 | mobil | 0.156968 | 2 | 2 | shared_2_topik |
| 3 | ponsel | 0.122577 | 1 | 1 | eksklusif_topik |
| 4 | telkom | 0.083707 | 2 | 2 | shared_2_topik |
| 5 | mobile | 0.083663 | 1 | 1 | eksklusif_topik |
| 6 | telkomsel | 0.056108 | 2 | 2 | shared_2_topik |
| 7 | terpercaya | 0.054464 | 1 | 1 | eksklusif_topik |
| 8 | telepon | 0.051553 | 1 | 1 | eksklusif_topik |
| 9 | harga | 0.047749 | 8 | 3 | shared_8_topik |
| 10 | undian | 0.043564 | 1 | 1 | eksklusif_topik |

### Topik 35 - Kriminal & Hukum - 35_seksual_wanita_kekerasan_korban

- Coverage: **2/57** (3.51%)
- Keyword ditemukan: **pelaku\|tersangka**
- Kata pembeda topik teratas: seksual (eksklusif_topik; 0.106688), wanita (eksklusif_topik; 0.071300), kekerasan (eksklusif_topik; 0.058029), perempuan (eksklusif_topik; 0.046780), seks (eksklusif_topik; 0.034350)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | seksual | 0.106688 | 1 | 1 | eksklusif_topik |
| 2 | wanita | 0.071300 | 1 | 1 | eksklusif_topik |
| 3 | kekerasan | 0.058029 | 1 | 1 | eksklusif_topik |
| 4 | korban | 0.048367 | 2 | 2 | shared_2_topik |
| 5 | perempuan | 0.046780 | 1 | 1 | eksklusif_topik |
| 6 | dokter | 0.040266 | 2 | 2 | shared_2_topik |
| 7 | seks | 0.034350 | 1 | 1 | eksklusif_topik |
| 8 | tersangka | 0.028795 | 2 | 1 | khas_kategori |
| 9 | kasus | 0.023106 | 1 | 1 | eksklusif_topik |
| 10 | pelaku | 0.021874 | 3 | 2 | shared_3_topik |

### Topik 36 - Ekonomi & Bisnis - 36_hotel_rumah rumah_rumah tangga_tangga

- Coverage: **2/80** (2.50%)
- Keyword ditemukan: **bisnis\|harga**
- Kata pembeda topik teratas: hotel (eksklusif_topik; 0.224737), rumah rumah (eksklusif_topik; format/noise?; 0.156973), rumah tangga (eksklusif_topik; 0.125199), tangga (eksklusif_topik; 0.117372), apartemen (eksklusif_topik; 0.081738)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | hotel | 0.224737 | 1 | 1 | eksklusif_topik |
| 2 | rumah rumah | 0.156973 | 1 | 1 | eksklusif_topik; format/noise? |
| 3 | rumah tangga | 0.125199 | 1 | 1 | eksklusif_topik |
| 4 | tangga | 0.117372 | 1 | 1 | eksklusif_topik |
| 5 | apartemen | 0.081738 | 1 | 1 | eksklusif_topik |
| 6 | harga | 0.053269 | 8 | 3 | shared_8_topik |
| 7 | dirumah | 0.042326 | 1 | 1 | eksklusif_topik |
| 8 | alat | 0.040237 | 3 | 3 | shared_3_topik |
| 9 | bisnis | 0.033606 | 3 | 2 | shared_3_topik |
| 10 | properti | 0.031171 | 1 | 1 | eksklusif_topik |

### Topik 37 - Kesehatan - 37_lockdown_karantina_evakuasi_bencana

- Coverage: **3/95** (3.16%)
- Keyword ditemukan: **covid\|karantina\|lockdown**
- Kata pembeda topik teratas: lockdown (eksklusif_topik; 0.474398), karantina (eksklusif_topik; 0.107553), evakuasi (eksklusif_topik; 0.075263), darurat (eksklusif_topik; 0.060849), bahaya (eksklusif_topik; 0.038945)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | lockdown | 0.474398 | 1 | 1 | eksklusif_topik |
| 2 | karantina | 0.107553 | 1 | 1 | eksklusif_topik |
| 3 | evakuasi | 0.075263 | 1 | 1 | eksklusif_topik |
| 4 | bencana | 0.070997 | 2 | 2 | shared_2_topik |
| 5 | darurat | 0.060849 | 1 | 1 | eksklusif_topik |
| 6 | india | 0.058144 | 2 | 2 | shared_2_topik |
| 7 | bahaya | 0.038945 | 1 | 1 | eksklusif_topik |
| 8 | dilarang | 0.037898 | 1 | 1 | eksklusif_topik |
| 9 | larangan | 0.035597 | 1 | 1 | eksklusif_topik |
| 10 | covid | 0.033319 | 3 | 2 | shared_3_topik |

### Topik 38 - Transportasi & Infrastruktur - 38_kereta_kereta api_api_metro

- Coverage: **5/58** (8.62%)
- Keyword ditemukan: **bus\|kai\|kereta\|stasiun\|transportasi**
- Kata pembeda topik teratas: kereta (eksklusif_topik; 0.235926), kereta api (eksklusif_topik; 0.130632), metro (eksklusif_topik; 0.066221), stasiun (eksklusif_topik; 0.060428), transportasi (eksklusif_topik; 0.040596)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kereta | 0.235926 | 1 | 1 | eksklusif_topik |
| 2 | kereta api | 0.130632 | 1 | 1 | eksklusif_topik |
| 3 | api | 0.109558 | 2 | 2 | shared_2_topik |
| 4 | metro | 0.066221 | 1 | 1 | eksklusif_topik |
| 5 | stasiun | 0.060428 | 1 | 1 | eksklusif_topik |
| 6 | penumpang | 0.045340 | 2 | 1 | khas_kategori |
| 7 | transportasi | 0.040596 | 1 | 1 | eksklusif_topik |
| 8 | kai | 0.037564 | 2 | 2 | shared_2_topik |
| 9 | bus | 0.031921 | 1 | 1 | eksklusif_topik |
| 10 | metro jaya | 0.031386 | 1 | 1 | eksklusif_topik |

### Topik 39 - Lingkungan & Energi - 39_kebakaran_terbakar_api_suhu

- Coverage: **2/63** (3.17%)
- Keyword ditemukan: **asap\|hutan**
- Kata pembeda topik teratas: kebakaran (eksklusif_topik; 0.180223), terbakar (eksklusif_topik; 0.111228), suhu (eksklusif_topik; 0.057475), asap (eksklusif_topik; 0.041765), damkar (eksklusif_topik; 0.037072)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kebakaran | 0.180223 | 1 | 1 | eksklusif_topik |
| 2 | terbakar | 0.111228 | 1 | 1 | eksklusif_topik |
| 3 | api | 0.109482 | 2 | 2 | shared_2_topik |
| 4 | suhu | 0.057475 | 1 | 1 | eksklusif_topik |
| 5 | asap | 0.041765 | 1 | 1 | eksklusif_topik |
| 6 | damkar | 0.037072 | 1 | 1 | eksklusif_topik |
| 7 | ledakan | 0.035190 | 1 | 1 | eksklusif_topik |
| 8 | pemadam | 0.030930 | 1 | 1 | eksklusif_topik |
| 9 | hutan | 0.026271 | 1 | 1 | eksklusif_topik |
| 10 | akibat | 0.025969 | 1 | 1 | eksklusif_topik |

### Topik 40 - Topik Umum - 40_harry_king_bendera_pangeran

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: harry (eksklusif_topik; 0.188661), king (eksklusif_topik; 0.176124), bendera (eksklusif_topik; 0.167642), pangeran (eksklusif_topik; 0.149466), raja (eksklusif_topik; 0.123636)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | harry | 0.188661 | 1 | 1 | eksklusif_topik |
| 2 | king | 0.176124 | 1 | 1 | eksklusif_topik |
| 3 | bendera | 0.167642 | 1 | 1 | eksklusif_topik |
| 4 | pangeran | 0.149466 | 1 | 1 | eksklusif_topik |
| 5 | raja | 0.123636 | 1 | 1 | eksklusif_topik |
| 6 | corona | 0.074716 | 2 | 2 | shared_2_topik |
| 7 | ratu | 0.068143 | 1 | 1 | eksklusif_topik |
| 8 | meghan | 0.059306 | 1 | 1 | eksklusif_topik |
| 9 | merah | 0.051438 | 1 | 1 | eksklusif_topik |
| 10 | kerajaan | 0.043955 | 1 | 1 | eksklusif_topik |

### Topik 41 - Lingkungan & Energi - 41_minyak_gas_energi_mineral

- Coverage: **3/63** (4.76%)
- Keyword ditemukan: **energi\|gas\|minyak**
- Kata pembeda topik teratas: minyak (eksklusif_topik; 0.200851), energi (eksklusif_topik; 0.065101), mineral (eksklusif_topik; 0.063133), bbm (eksklusif_topik; 0.055732), sumber daya (eksklusif_topik; 0.046258)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | minyak | 0.200851 | 1 | 1 | eksklusif_topik |
| 2 | gas | 0.103232 | 2 | 1 | khas_kategori |
| 3 | energi | 0.065101 | 1 | 1 | eksklusif_topik |
| 4 | mineral | 0.063133 | 1 | 1 | eksklusif_topik |
| 5 | bbm | 0.055732 | 1 | 1 | eksklusif_topik |
| 6 | harga | 0.055550 | 8 | 3 | shared_8_topik |
| 7 | sumber daya | 0.046258 | 1 | 1 | eksklusif_topik |
| 8 | bahan bakar | 0.044728 | 1 | 1 | eksklusif_topik |
| 9 | bakar | 0.042996 | 1 | 1 | eksklusif_topik |
| 10 | daya | 0.038601 | 1 | 1 | eksklusif_topik |

### Topik 42 - Topik Umum - 42_tiket_nomor_urut_nomor urut

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: urut (eksklusif_topik; 0.241897), nomor urut (eksklusif_topik; 0.232572), harga tiket (eksklusif_topik; 0.137567), pramono (eksklusif_topik; 0.076979), pramono anung (eksklusif_topik; 0.065907)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | tiket | 0.411170 | 2 | 2 | shared_2_topik |
| 2 | nomor | 0.305061 | 2 | 1 | khas_kategori |
| 3 | urut | 0.241897 | 1 | 1 | eksklusif_topik |
| 4 | nomor urut | 0.232572 | 1 | 1 | eksklusif_topik |
| 5 | harga tiket | 0.137567 | 1 | 1 | eksklusif_topik |
| 6 | pramono | 0.076979 | 1 | 1 | eksklusif_topik |
| 7 | harga | 0.076847 | 8 | 3 | shared_8_topik |
| 8 | pramono anung | 0.065907 | 1 | 1 | eksklusif_topik |
| 9 | anung | 0.065842 | 1 | 1 | eksklusif_topik |
| 10 | restoran | 0.065743 | 1 | 1 | eksklusif_topik |

### Topik 43 - Internasional - 43_inggris_united_city_liga

- Coverage: **2/81** (2.47%)
- Keyword ditemukan: **inggris\|internasional**
- Kata pembeda topik teratas: inggris (eksklusif_topik; 0.680947), united (eksklusif_topik; 0.256390), city (eksklusif_topik; 0.124306), london (eksklusif_topik; 0.043635), juara (eksklusif_topik; 0.035396)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | inggris | 0.680947 | 1 | 1 | eksklusif_topik |
| 2 | united | 0.256390 | 1 | 1 | eksklusif_topik |
| 3 | city | 0.124306 | 1 | 1 | eksklusif_topik |
| 4 | liga | 0.119287 | 2 | 2 | shared_2_topik |
| 5 | internasional | 0.109658 | 2 | 2 | shared_2_topik |
| 6 | pekan | 0.051363 | 2 | 2 | shared_2_topik |
| 7 | london | 0.043635 | 1 | 1 | eksklusif_topik |
| 8 | juara | 0.035396 | 1 | 1 | eksklusif_topik |
| 9 | klub | 0.035309 | 1 | 1 | eksklusif_topik |
| 10 | musim | 0.033273 | 1 | 1 | eksklusif_topik |

### Topik 44 - Ekonomi & Bisnis - 44_pajak_listrik_kendaraan_bayar

- Coverage: **2/80** (2.50%)
- Keyword ditemukan: **gaji\|pajak**
- Kata pembeda topik teratas: pajak (eksklusif_topik; 0.288096), bayar (eksklusif_topik; 0.038880), pln (eksklusif_topik; 0.036714), denda (eksklusif_topik; 0.028486), bawang (eksklusif_topik; 0.022424)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | pajak | 0.288096 | 1 | 1 | eksklusif_topik |
| 2 | listrik | 0.151636 | 2 | 2 | shared_2_topik |
| 3 | kendaraan | 0.049053 | 2 | 2 | shared_2_topik |
| 4 | bayar | 0.038880 | 1 | 1 | eksklusif_topik |
| 5 | pln | 0.036714 | 1 | 1 | eksklusif_topik |
| 6 | denda | 0.028486 | 1 | 1 | eksklusif_topik |
| 7 | bawang | 0.022424 | 1 | 1 | eksklusif_topik |
| 8 | diskon | 0.021236 | 2 | 1 | khas_kategori |
| 9 | gaji | 0.021039 | 2 | 1 | khas_kategori |
| 10 | pembebasan | 0.020988 | 1 | 1 | eksklusif_topik |

### Topik 45 - Hiburan & Gaya Hidup - 45_bintang_film_trans_nonton

- Coverage: **3/77** (3.90%)
- Keyword ditemukan: **aktor\|film\|marvel**
- Kata pembeda topik teratas: film (eksklusif_topik; 0.346080), trans (eksklusif_topik; 0.054879), ben (eksklusif_topik; 0.035428), aktor (eksklusif_topik; 0.031247), tayang (eksklusif_topik; 0.022555)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | bintang | 0.409815 | 2 | 2 | shared_2_topik |
| 2 | film | 0.346080 | 1 | 1 | eksklusif_topik |
| 3 | trans | 0.054879 | 1 | 1 | eksklusif_topik |
| 4 | nonton | 0.054306 | 2 | 1 | khas_kategori |
| 5 | ben | 0.035428 | 1 | 1 | eksklusif_topik |
| 6 | aktor | 0.031247 | 1 | 1 | eksklusif_topik |
| 7 | tiga | 0.030224 | 2 | 2 | shared_2_topik |
| 8 | marvel | 0.023315 | 2 | 2 | shared_2_topik |
| 9 | tayang | 0.022555 | 1 | 1 | eksklusif_topik |
| 10 | cerita | 0.019635 | 1 | 1 | eksklusif_topik |

### Topik 46 - Teknologi & Sains - 46_bumi_bulan_matahari_nasa

- Coverage: **4/72** (5.56%)
- Keyword ditemukan: **bulan\|bumi\|matahari\|nasa**
- Kata pembeda topik teratas: bulan (eksklusif_topik; 0.149599), matahari (eksklusif_topik; 0.120832), nasa (eksklusif_topik; 0.113759), angkasa (eksklusif_topik; 0.105581), surya (eksklusif_topik; 0.100965)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | bumi | 0.272780 | 2 | 2 | shared_2_topik |
| 2 | bulan | 0.149599 | 1 | 1 | eksklusif_topik |
| 3 | matahari | 0.120832 | 1 | 1 | eksklusif_topik |
| 4 | nasa | 0.113759 | 1 | 1 | eksklusif_topik |
| 5 | angkasa | 0.105581 | 1 | 1 | eksklusif_topik |
| 6 | surya | 0.100965 | 1 | 1 | eksklusif_topik |
| 7 | surya paloh | 0.057740 | 1 | 1 | eksklusif_topik |
| 8 | paloh | 0.055066 | 1 | 1 | eksklusif_topik |
| 9 | luar | 0.050944 | 1 | 1 | eksklusif_topik |
| 10 | jatuh | 0.039549 | 2 | 2 | shared_2_topik |

### Topik 47 - Topik Umum - 47_maaf_lucu_mohon_mohon maaf

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: maaf (eksklusif_topik; 0.230125), mohon (eksklusif_topik; 0.076400), mohon maaf (eksklusif_topik; 0.073493), minta maaf (eksklusif_topik; 0.061879), permintaan maaf (eksklusif_topik; 0.043036)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | maaf | 0.230125 | 1 | 1 | eksklusif_topik |
| 2 | lucu | 0.114087 | 2 | 1 | khas_kategori |
| 3 | mohon | 0.076400 | 1 | 1 | eksklusif_topik |
| 4 | mohon maaf | 0.073493 | 1 | 1 | eksklusif_topik |
| 5 | minta maaf | 0.061879 | 1 | 1 | eksklusif_topik |
| 6 | permintaan maaf | 0.043036 | 1 | 1 | eksklusif_topik |
| 7 | meminta | 0.041852 | 1 | 1 | eksklusif_topik |
| 8 | maaf kepada | 0.040380 | 1 | 1 | eksklusif_topik |
| 9 | minta | 0.039139 | 1 | 1 | eksklusif_topik |
| 10 | permintaan | 0.038197 | 1 | 1 | eksklusif_topik |

### Topik 48 - Teknologi & Sains - 48_google_digital_aplikasi_microsoft

- Coverage: **3/72** (4.17%)
- Keyword ditemukan: **aplikasi\|digital\|teknologi**
- Kata pembeda topik teratas: google (eksklusif_topik; 0.252709), digital (eksklusif_topik; 0.173149), aplikasi (eksklusif_topik; 0.139012), microsoft (eksklusif_topik; 0.135573), fitur (eksklusif_topik; 0.054271)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | google | 0.252709 | 1 | 1 | eksklusif_topik |
| 2 | digital | 0.173149 | 1 | 1 | eksklusif_topik |
| 3 | aplikasi | 0.139012 | 1 | 1 | eksklusif_topik |
| 4 | microsoft | 0.135573 | 1 | 1 | eksklusif_topik |
| 5 | fitur | 0.054271 | 1 | 1 | eksklusif_topik |
| 6 | play | 0.047500 | 1 | 1 | eksklusif_topik |
| 7 | store | 0.044454 | 1 | 1 | eksklusif_topik |
| 8 | teknologi | 0.034258 | 2 | 1 | khas_kategori |
| 9 | kredit | 0.033624 | 1 | 1 | eksklusif_topik |
| 10 | search | 0.029724 | 1 | 1 | eksklusif_topik |

### Topik 49 - Bencana & Cuaca - 49_gunung_bukit_puncak_abu

- Coverage: **0/49** (0.00%)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: gunung (eksklusif_topik; 0.502239), bukit (eksklusif_topik; 0.228042), puncak (eksklusif_topik; 0.091366), abu (eksklusif_topik; 0.090950), kolom (eksklusif_topik; 0.083036)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | gunung | 0.502239 | 1 | 1 | eksklusif_topik |
| 2 | bukit | 0.228042 | 1 | 1 | eksklusif_topik |
| 3 | puncak | 0.091366 | 1 | 1 | eksklusif_topik |
| 4 | abu | 0.090950 | 1 | 1 | eksklusif_topik |
| 5 | kolom | 0.083036 | 1 | 1 | eksklusif_topik |
| 6 | meter | 0.074341 | 2 | 2 | shared_2_topik |
| 7 | atas | 0.049512 | 1 | 1 | eksklusif_topik |
| 8 | laki | 0.048562 | 1 | 1 | eksklusif_topik |
| 9 | tinggi | 0.038264 | 2 | 2 | shared_2_topik |
| 10 | tegal | 0.025485 | 1 | 1 | eksklusif_topik |

### Topik 50 - Topik Umum - 50_psi_catat_hewan_macet

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: psi (eksklusif_topik; 0.143667), catat (eksklusif_topik; 0.130908), hewan (eksklusif_topik; 0.120989), macet (eksklusif_topik; 0.066608), liar (eksklusif_topik; 0.028746)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | psi | 0.143667 | 1 | 1 | eksklusif_topik |
| 2 | catat | 0.130908 | 1 | 1 | eksklusif_topik |
| 3 | hewan | 0.120989 | 1 | 1 | eksklusif_topik |
| 4 | macet | 0.066608 | 1 | 1 | eksklusif_topik |
| 5 | viral | 0.041802 | 2 | 2 | shared_2_topik |
| 6 | liar | 0.028746 | 1 | 1 | eksklusif_topik |
| 7 | daging | 0.024875 | 1 | 1 | eksklusif_topik |
| 8 | made | 0.023984 | 1 | 1 | eksklusif_topik |
| 9 | kai | 0.023793 | 2 | 2 | shared_2_topik |
| 10 | kelapa | 0.020663 | 1 | 1 | eksklusif_topik |

### Topik 51 - Topik Umum - 51_judi_game_online_jagat

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: judi (eksklusif_topik; 0.219796), game (eksklusif_topik; 0.139373), permainan (eksklusif_topik; 0.029522), demi (eksklusif_topik; 0.025818), perubahan (eksklusif_topik; 0.025004)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | judi | 0.219796 | 1 | 1 | eksklusif_topik |
| 2 | game | 0.139373 | 1 | 1 | eksklusif_topik |
| 3 | online | 0.131693 | 2 | 2 | shared_2_topik |
| 4 | jagat | 0.036449 | 2 | 2 | shared_2_topik |
| 5 | prajurit | 0.030047 | 2 | 2 | shared_2_topik |
| 6 | permainan | 0.029522 | 1 | 1 | eksklusif_topik |
| 7 | demi | 0.025818 | 1 | 1 | eksklusif_topik |
| 8 | perubahan | 0.025004 | 1 | 1 | eksklusif_topik |
| 9 | kiamat | 0.023113 | 1 | 1 | eksklusif_topik |
| 10 | situs | 0.022782 | 1 | 1 | eksklusif_topik |

### Topik 52 - Topik Umum - 52_prediksi_skor_uji_test

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: prediksi (eksklusif_topik; 0.429826), uji (eksklusif_topik; 0.102996), test (eksklusif_topik; 0.084995), singkat (eksklusif_topik; 0.058626), tes (eksklusif_topik; 0.058148)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | prediksi | 0.429826 | 1 | 1 | eksklusif_topik |
| 2 | skor | 0.272533 | 2 | 2 | shared_2_topik |
| 3 | uji | 0.102996 | 1 | 1 | eksklusif_topik |
| 4 | test | 0.084995 | 1 | 1 | eksklusif_topik |
| 5 | bola | 0.078899 | 2 | 2 | shared_2_topik |
| 6 | akhir | 0.067821 | 2 | 1 | khas_kategori |
| 7 | singkat | 0.058626 | 1 | 1 | eksklusif_topik |
| 8 | tes | 0.058148 | 1 | 1 | eksklusif_topik |
| 9 | rapid | 0.050178 | 1 | 1 | eksklusif_topik |
| 10 | rapid test | 0.047250 | 1 | 1 | eksklusif_topik |

### Topik 53 - Keamanan & Pertahanan - 53_perang_militer_tentara_prajurit

- Coverage: **5/60** (8.33%)
- Keyword ditemukan: **militer\|pasukan\|prajurit\|tentara\|tni**
- Kata pembeda topik teratas: militer (eksklusif_topik; 0.084383), pasukan (eksklusif_topik; 0.062337), tni (eksklusif_topik; 0.060128), angkatan (eksklusif_topik; 0.045759), darat (eksklusif_topik; 0.041334)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | perang | 0.176177 | 2 | 2 | shared_2_topik |
| 2 | militer | 0.084383 | 1 | 1 | eksklusif_topik |
| 3 | tentara | 0.067891 | 2 | 2 | shared_2_topik |
| 4 | prajurit | 0.064708 | 2 | 2 | shared_2_topik |
| 5 | pasukan | 0.062337 | 1 | 1 | eksklusif_topik |
| 6 | tni | 0.060128 | 1 | 1 | eksklusif_topik |
| 7 | angkatan | 0.045759 | 1 | 1 | eksklusif_topik |
| 8 | darat | 0.041334 | 1 | 1 | eksklusif_topik |
| 9 | tni angkatan | 0.034459 | 1 | 1 | eksklusif_topik |
| 10 | gaza | 0.031562 | 2 | 2 | shared_2_topik |

### Topik 54 - Ekonomi & Bisnis - 54_saham_investasi_ihsg_indeks

- Coverage: **7/80** (8.75%)
- Keyword ditemukan: **bursa\|harga\|ihsg\|investasi\|pasar\|perdagangan\|saham**
- Kata pembeda topik teratas: saham (eksklusif_topik; 0.556950), investasi (eksklusif_topik; 0.162862), indeks (eksklusif_topik; 0.094634), perdagangan (eksklusif_topik; 0.057715), menguat (eksklusif_topik; 0.054393)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | saham | 0.556950 | 1 | 1 | eksklusif_topik |
| 2 | investasi | 0.162862 | 1 | 1 | eksklusif_topik |
| 3 | ihsg | 0.099501 | 2 | 2 | shared_2_topik |
| 4 | indeks | 0.094634 | 1 | 1 | eksklusif_topik |
| 5 | harga | 0.083317 | 8 | 3 | shared_8_topik |
| 6 | pasar | 0.058343 | 2 | 1 | khas_kategori |
| 7 | perdagangan | 0.057715 | 1 | 1 | eksklusif_topik |
| 8 | menguat | 0.054393 | 1 | 1 | eksklusif_topik |
| 9 | bursa | 0.047409 | 1 | 1 | eksklusif_topik |
| 10 | investor | 0.040601 | 1 | 1 | eksklusif_topik |

### Topik 55 - Topik Umum - 55_comb_rambut_ndiricis_makassar

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: comb (eksklusif_topik; 1.115748), rambut (eksklusif_topik; 0.660752), makassar (eksklusif_topik; 0.071518), bundas (eksklusif_topik; 0.055993), rsk (eksklusif_topik; 0.054041)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | comb | 1.115748 | 1 | 1 | eksklusif_topik |
| 2 | rambut | 0.660752 | 1 | 1 | eksklusif_topik |
| 3 | ndiricis | 0.098869 | 2 | 1 | khas_kategori |
| 4 | makassar | 0.071518 | 1 | 1 | eksklusif_topik |
| 5 | licitud | 0.062073 | 4 | 3 | shared_4_topik |
| 6 | bunda | 0.060820 | 2 | 2 | shared_2_topik |
| 7 | bundas | 0.055993 | 1 | 1 | eksklusif_topik |
| 8 | rsk | 0.054041 | 1 | 1 | eksklusif_topik |
| 9 | gorontalo | 0.049697 | 1 | 1 | eksklusif_topik |
| 10 | spares | 0.046809 | 2 | 1 | khas_kategori |

### Topik 56 - Topik Umum - 56_dadan_meter_gizi_marvel

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: dadan (eksklusif_topik; 0.066504), gizi (eksklusif_topik; 0.049608), panjang (eksklusif_topik; 0.037913), ormas (eksklusif_topik; 0.035300), standar (eksklusif_topik; 0.034787)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | dadan | 0.066504 | 1 | 1 | eksklusif_topik |
| 2 | meter | 0.053565 | 2 | 2 | shared_2_topik |
| 3 | gizi | 0.049608 | 1 | 1 | eksklusif_topik |
| 4 | marvel | 0.045651 | 2 | 2 | shared_2_topik |
| 5 | panjang | 0.037913 | 1 | 1 | eksklusif_topik |
| 6 | makan | 0.037330 | 2 | 1 | khas_kategori |
| 7 | ormas | 0.035300 | 1 | 1 | eksklusif_topik |
| 8 | standar | 0.034787 | 1 | 1 | eksklusif_topik |
| 9 | menu | 0.030973 | 1 | 1 | eksklusif_topik |
| 10 | man | 0.029446 | 1 | 1 | eksklusif_topik |

### Topik 57 - Topik Umum - 57_ward_aiment_paling_pita

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: ward (eksklusif_topik; 2.732205), aiment (eksklusif_topik; 0.259261), paling (eksklusif_topik; 0.103660), sdn (eksklusif_topik; 0.063852), anwar (eksklusif_topik; 0.056734)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | ward | 2.732205 | 1 | 1 | eksklusif_topik |
| 2 | aiment | 0.259261 | 1 | 1 | eksklusif_topik |
| 3 | paling | 0.103660 | 1 | 1 | eksklusif_topik |
| 4 | pita | 0.071351 | 2 | 1 | khas_kategori |
| 5 | sdn | 0.063852 | 1 | 1 | eksklusif_topik |
| 6 | anwar | 0.056734 | 1 | 1 | eksklusif_topik |
| 7 | ndiricis | 0.054338 | 2 | 1 | khas_kategori |
| 8 | lainnya | 0.053296 | 1 | 1 | eksklusif_topik |
| 9 | skb | 0.041442 | 1 | 1 | eksklusif_topik |
| 10 | penghuni | 0.040191 | 1 | 1 | eksklusif_topik |

### Topik 58 - Topik Umum - 58_resmi resmi_resmi resmikan_resmikan_r

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: resmi resmi (eksklusif_topik; format/noise?; 0.823601), resmi resmikan (eksklusif_topik; 0.618468), resmikan (eksklusif_topik; 0.608291), resminya resmi (eksklusif_topik; 0.523602), resminya (eksklusif_topik; 0.435373)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | resmi resmi | 0.823601 | 1 | 1 | eksklusif_topik; format/noise? |
| 2 | resmi resmikan | 0.618468 | 1 | 1 | eksklusif_topik |
| 3 | resmikan | 0.608291 | 1 | 1 | eksklusif_topik |
| 4 | resminya resmi | 0.523602 | 1 | 1 | eksklusif_topik |
| 5 | resminya | 0.435373 | 1 | 1 | eksklusif_topik |
| 6 | pengumuman | 0.070506 | 1 | 1 | eksklusif_topik |
| 7 | nasional resmi | 0.067703 | 1 | 1 | eksklusif_topik |
| 8 | internasional | 0.050435 | 2 | 2 | shared_2_topik |
| 9 | licitudin | 0.040488 | 1 | 1 | eksklusif_topik |
| 10 | bergabung | 0.032491 | 1 | 1 | eksklusif_topik |

### Topik 59 - Topik Umum - 59_mesin_alat_alat alat_daihatsu

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: mesin (eksklusif_topik; 0.537758), alat alat (eksklusif_topik; format/noise?; 0.181786), daihatsu (eksklusif_topik; 0.087960), digantikan (eksklusif_topik; 0.051225), menyebar (eksklusif_topik; 0.038676)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | mesin | 0.537758 | 1 | 1 | eksklusif_topik |
| 2 | alat | 0.257678 | 3 | 3 | shared_3_topik |
| 3 | alat alat | 0.181786 | 1 | 1 | eksklusif_topik; format/noise? |
| 4 | daihatsu | 0.087960 | 1 | 1 | eksklusif_topik |
| 5 | digantikan | 0.051225 | 1 | 1 | eksklusif_topik |
| 6 | menyebar | 0.038676 | 1 | 1 | eksklusif_topik |
| 7 | toyota | 0.037819 | 1 | 1 | eksklusif_topik |
| 8 | musk | 0.037412 | 1 | 1 | eksklusif_topik |
| 9 | listrik | 0.035629 | 2 | 2 | shared_2_topik |
| 10 | sinar | 0.030449 | 1 | 1 | eksklusif_topik |

### Topik 60 - Topik Umum - 60_html_reffer_licitud_malang

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: html (eksklusif_topik; format/noise?; 1.693023), reffer (eksklusif_topik; format/noise?; 0.669305), single (eksklusif_topik; 0.044681), diblokir (eksklusif_topik; 0.043744), malang malang (eksklusif_topik; format/noise?; 0.041704)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | html | 1.693023 | 1 | 1 | eksklusif_topik; format/noise? |
| 2 | reffer | 0.669305 | 1 | 1 | eksklusif_topik; format/noise? |
| 3 | licitud | 0.104145 | 4 | 3 | shared_4_topik |
| 4 | malang | 0.056543 | 2 | 2 | shared_2_topik |
| 5 | single | 0.044681 | 1 | 1 | eksklusif_topik |
| 6 | diblokir | 0.043744 | 1 | 1 | eksklusif_topik |
| 7 | malang malang | 0.041704 | 1 | 1 | eksklusif_topik; format/noise? |
| 8 | kuliner | 0.039784 | 1 | 1 | eksklusif_topik |
| 9 | ditunda | 0.035474 | 1 | 1 | eksklusif_topik |
| 10 | viva | 0.030070 | 1 | 1 | eksklusif_topik |

### Topik 61 - Topik Umum - 61_tidur_mimpi_buruk_perawatan

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: tidur (eksklusif_topik; 0.303703), mimpi (eksklusif_topik; 0.176399), buruk (eksklusif_topik; 0.052783), perawatan (eksklusif_topik; 0.044519), pasangan (eksklusif_topik; 0.030035)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | tidur | 0.303703 | 1 | 1 | eksklusif_topik |
| 2 | mimpi | 0.176399 | 1 | 1 | eksklusif_topik |
| 3 | buruk | 0.052783 | 1 | 1 | eksklusif_topik |
| 4 | perawatan | 0.044519 | 1 | 1 | eksklusif_topik |
| 5 | kulit | 0.036898 | 2 | 2 | shared_2_topik |
| 6 | pasangan | 0.030035 | 1 | 1 | eksklusif_topik |
| 7 | impian | 0.026099 | 1 | 1 | eksklusif_topik |
| 8 | menyarankan | 0.025356 | 1 | 1 | eksklusif_topik |
| 9 | seseorang | 0.023957 | 1 | 1 | eksklusif_topik |
| 10 | membantu | 0.023172 | 1 | 1 | eksklusif_topik |

### Topik 62 - Lingkungan & Energi - 62_udara_kualitas_paru_napas

- Coverage: **2/63** (3.17%)
- Keyword ditemukan: **gas\|polusi**
- Kata pembeda topik teratas: kualitas (eksklusif_topik; 0.153286), paru (eksklusif_topik; 0.071295), napas (eksklusif_topik; 0.066865), air mata (eksklusif_topik; 0.052196), mata (eksklusif_topik; 0.050544)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | udara | 0.233386 | 2 | 2 | shared_2_topik |
| 2 | kualitas | 0.153286 | 1 | 1 | eksklusif_topik |
| 3 | paru | 0.071295 | 1 | 1 | eksklusif_topik |
| 4 | napas | 0.066865 | 1 | 1 | eksklusif_topik |
| 5 | gas | 0.059709 | 2 | 1 | khas_kategori |
| 6 | air mata | 0.052196 | 1 | 1 | eksklusif_topik |
| 7 | mata | 0.050544 | 1 | 1 | eksklusif_topik |
| 8 | polusi | 0.049662 | 1 | 1 | eksklusif_topik |
| 9 | berdampak | 0.047453 | 1 | 1 | eksklusif_topik |
| 10 | sensitif | 0.043995 | 1 | 1 | eksklusif_topik |

### Topik 63 - Kesehatan - 63_kanker_obat_ganas_operasi

- Coverage: **5/95** (5.26%)
- Keyword ditemukan: **kanker\|kesehatan\|obat\|operasi\|pasien**
- Kata pembeda topik teratas: kanker (eksklusif_topik; 1.143495), ganas (eksklusif_topik; 0.082265), operasi (eksklusif_topik; 0.060088), sel (eksklusif_topik; 0.057368), ampuh (eksklusif_topik; 0.057330)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | kanker | 1.143495 | 1 | 1 | eksklusif_topik |
| 2 | obat | 0.082544 | 2 | 2 | shared_2_topik |
| 3 | ganas | 0.082265 | 1 | 1 | eksklusif_topik |
| 4 | operasi | 0.060088 | 1 | 1 | eksklusif_topik |
| 5 | pasien | 0.059624 | 2 | 1 | khas_kategori |
| 6 | sel | 0.057368 | 1 | 1 | eksklusif_topik |
| 7 | ampuh | 0.057330 | 1 | 1 | eksklusif_topik |
| 8 | stadium | 0.052665 | 1 | 1 | eksklusif_topik |
| 9 | zat | 0.047217 | 1 | 1 | eksklusif_topik |
| 10 | kesehatan | 0.045519 | 3 | 1 | khas_kategori |

### Topik 64 - Olahraga - 64_liga_megawati_final_korea

- Coverage: **2/58** (3.45%)
- Keyword ditemukan: **liga\|skor**
- Kata pembeda topik teratas: final (eksklusif_topik; 0.113307), korea (eksklusif_topik; 0.113078), kawan (eksklusif_topik; 0.057948), pertiwi (eksklusif_topik; 0.050838), liga (shared_2_topik; 0.134314)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | liga | 0.134314 | 2 | 2 | shared_2_topik |
| 2 | megawati | 0.121884 | 2 | 2 | shared_2_topik |
| 3 | final | 0.113307 | 1 | 1 | eksklusif_topik |
| 4 | korea | 0.113078 | 1 | 1 | eksklusif_topik |
| 5 | laga | 0.089022 | 2 | 1 | khas_kategori |
| 6 | poin | 0.084386 | 2 | 2 | shared_2_topik |
| 7 | kawan | 0.057948 | 1 | 1 | eksklusif_topik |
| 8 | kemenangan | 0.055724 | 2 | 2 | shared_2_topik |
| 9 | skor | 0.051264 | 2 | 2 | shared_2_topik |
| 10 | pertiwi | 0.050838 | 1 | 1 | eksklusif_topik |

### Topik 65 - Nasional & Pemerintahan - 65_mulai_new normal_normal_new

- Coverage: **2/64** (3.12%)
- Keyword ditemukan: **ikn\|proyek**
- Kata pembeda topik teratas: mulai (eksklusif_topik; 0.457173), new normal (eksklusif_topik; 0.363323), normal (eksklusif_topik; 0.362346), new (eksklusif_topik; 0.305123), dimulai (eksklusif_topik; 0.159248)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | mulai | 0.457173 | 1 | 1 | eksklusif_topik |
| 2 | new normal | 0.363323 | 1 | 1 | eksklusif_topik |
| 3 | normal | 0.362346 | 1 | 1 | eksklusif_topik |
| 4 | new | 0.305123 | 1 | 1 | eksklusif_topik |
| 5 | dimulai | 0.159248 | 1 | 1 | eksklusif_topik |
| 6 | ikn | 0.080593 | 1 | 1 | eksklusif_topik |
| 7 | proyek | 0.080593 | 1 | 1 | eksklusif_topik |
| 8 | kembali normal | 0.050103 | 1 | 1 | eksklusif_topik |
| 9 | xxi | 0.049273 | 1 | 1 | eksklusif_topik |
| 10 | lari | 0.046953 | 1 | 1 | eksklusif_topik |

### Topik 66 - Politik - 66_hitam_putih_paham_kulit

- Coverage: **0/60** (0.00%)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: hitam (eksklusif_topik; 0.662071), putih (eksklusif_topik; 0.158629), paham (eksklusif_topik; 0.106197), memek (eksklusif_topik; 0.081153), pasti (eksklusif_topik; 0.078235)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | hitam | 0.662071 | 1 | 1 | eksklusif_topik |
| 2 | putih | 0.158629 | 1 | 1 | eksklusif_topik |
| 3 | paham | 0.106197 | 1 | 1 | eksklusif_topik |
| 4 | kulit | 0.085333 | 2 | 2 | shared_2_topik |
| 5 | memek | 0.081153 | 1 | 1 | eksklusif_topik |
| 6 | pasti | 0.078235 | 1 | 1 | eksklusif_topik |
| 7 | baju | 0.072991 | 1 | 1 | eksklusif_topik |
| 8 | afrika | 0.050801 | 1 | 1 | eksklusif_topik |
| 9 | keluarganya | 0.050608 | 1 | 1 | eksklusif_topik |
| 10 | lawan | 0.048953 | 1 | 1 | eksklusif_topik |

### Topik 67 - Ekonomi & Bisnis - 67_gula_harga_ton_stok

- Coverage: **3/80** (3.75%)
- Keyword ditemukan: **bumn\|harga\|impor**
- Kata pembeda topik teratas: gula (eksklusif_topik; 0.572777), ton (eksklusif_topik; 0.096113), stok (eksklusif_topik; 0.080788), darah (eksklusif_topik; 0.070806), diabetes (eksklusif_topik; 0.059052)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | gula | 0.572777 | 1 | 1 | eksklusif_topik |
| 2 | harga | 0.096819 | 8 | 3 | shared_8_topik |
| 3 | ton | 0.096113 | 1 | 1 | eksklusif_topik |
| 4 | stok | 0.080788 | 1 | 1 | eksklusif_topik |
| 5 | darah | 0.070806 | 1 | 1 | eksklusif_topik |
| 6 | diabetes | 0.059052 | 1 | 1 | eksklusif_topik |
| 7 | bumn | 0.049258 | 1 | 1 | eksklusif_topik |
| 8 | petani | 0.044491 | 1 | 1 | eksklusif_topik |
| 9 | impor | 0.043153 | 2 | 1 | khas_kategori |
| 10 | tinggi | 0.039239 | 2 | 2 | shared_2_topik |

### Topik 68 - Topik Umum - 68_tiga_periode_tiga tahun_klasik

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: periode (eksklusif_topik; 0.135536), tiga tahun (eksklusif_topik; 0.095158), klasik (eksklusif_topik; 0.080898), berminat (eksklusif_topik; 0.077332), mana (eksklusif_topik; 0.068670)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | tiga | 0.733631 | 2 | 2 | shared_2_topik |
| 2 | periode | 0.135536 | 1 | 1 | eksklusif_topik |
| 3 | tiga tahun | 0.095158 | 1 | 1 | eksklusif_topik |
| 4 | klasik | 0.080898 | 1 | 1 | eksklusif_topik |
| 5 | berminat | 0.077332 | 1 | 1 | eksklusif_topik |
| 6 | mana | 0.068670 | 1 | 1 | eksklusif_topik |
| 7 | ketiga | 0.063365 | 1 | 1 | eksklusif_topik |
| 8 | kecuali | 0.049161 | 1 | 1 | eksklusif_topik |
| 9 | pita | 0.047872 | 2 | 1 | khas_kategori |
| 10 | dipaksa | 0.046496 | 1 | 1 | eksklusif_topik |

### Topik 69 - Internasional - 69_australia_iran_terbuka_lakukan

- Coverage: **3/81** (3.70%)
- Keyword ditemukan: **australia\|iran\|pbb**
- Kata pembeda topik teratas: australia (eksklusif_topik; 0.711334), terbuka (eksklusif_topik; 0.081384), lakukan (eksklusif_topik; 0.074905), babak (eksklusif_topik; 0.066492), tiba (eksklusif_topik; 0.058067)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | australia | 0.711334 | 1 | 1 | eksklusif_topik |
| 2 | iran | 0.252668 | 2 | 1 | khas_kategori |
| 3 | terbuka | 0.081384 | 1 | 1 | eksklusif_topik |
| 4 | lakukan | 0.074905 | 1 | 1 | eksklusif_topik |
| 5 | babak | 0.066492 | 1 | 1 | eksklusif_topik |
| 6 | tiba | 0.058067 | 1 | 1 | eksklusif_topik |
| 7 | bikin | 0.057146 | 1 | 1 | eksklusif_topik |
| 8 | pasir | 0.054833 | 1 | 1 | eksklusif_topik |
| 9 | pbb | 0.054710 | 1 | 1 | eksklusif_topik |
| 10 | tentara | 0.052154 | 2 | 2 | shared_2_topik |

### Topik 70 - Topik Umum - 70_bcl_kenang_ayah_duka

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: bcl (eksklusif_topik; 0.607244), kenang (eksklusif_topik; 0.150365), ayah (eksklusif_topik; 0.132751), duka (eksklusif_topik; 0.090802), ungkapan (eksklusif_topik; 0.085692)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | bcl | 0.607244 | 1 | 1 | eksklusif_topik |
| 2 | kenang | 0.150365 | 1 | 1 | eksklusif_topik |
| 3 | ayah | 0.132751 | 1 | 1 | eksklusif_topik |
| 4 | duka | 0.090802 | 1 | 1 | eksklusif_topik |
| 5 | ungkapan | 0.085692 | 1 | 1 | eksklusif_topik |
| 6 | momen | 0.078377 | 1 | 1 | eksklusif_topik |
| 7 | mengenang | 0.075660 | 1 | 1 | eksklusif_topik |
| 8 | usai | 0.073657 | 1 | 1 | eksklusif_topik |
| 9 | suami | 0.073312 | 2 | 1 | khas_kategori |
| 10 | pemakaman | 0.067944 | 1 | 1 | eksklusif_topik |

### Topik 71 - Teknologi & Sains - 71_india_nge_indo_bantu

- Coverage: **2/72** (2.78%)
- Keyword ditemukan: **bintang\|teknologi**
- Kata pembeda topik teratas: nge (eksklusif_topik; 0.153437), indo (eksklusif_topik; 0.128106), bantu (eksklusif_topik; 0.126114), tenang (eksklusif_topik; 0.107983), dibuka (eksklusif_topik; 0.085424)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | india | 1.228957 | 2 | 2 | shared_2_topik |
| 2 | nge | 0.153437 | 1 | 1 | eksklusif_topik |
| 3 | indo | 0.128106 | 1 | 1 | eksklusif_topik |
| 4 | bantu | 0.126114 | 1 | 1 | eksklusif_topik |
| 5 | tenang | 0.107983 | 1 | 1 | eksklusif_topik |
| 6 | teknologi | 0.105182 | 2 | 1 | khas_kategori |
| 7 | bintang | 0.095997 | 2 | 2 | shared_2_topik |
| 8 | dibuka | 0.085424 | 1 | 1 | eksklusif_topik |
| 9 | tanggal mei | 0.072118 | 1 | 1 | eksklusif_topik |
| 10 | jagat | 0.070551 | 2 | 2 | shared_2_topik |

### Topik 72 - Topik Umum - 72_halal_mui_sertifikasi_logo

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: halal (eksklusif_topik; 0.409201), mui (eksklusif_topik; 0.117017), sertifikasi (eksklusif_topik; 0.070187), logo (eksklusif_topik; 0.051296), hibah (eksklusif_topik; 0.050952)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | halal | 0.409201 | 1 | 1 | eksklusif_topik |
| 2 | mui | 0.117017 | 1 | 1 | eksklusif_topik |
| 3 | sertifikasi | 0.070187 | 1 | 1 | eksklusif_topik |
| 4 | logo | 0.051296 | 1 | 1 | eksklusif_topik |
| 5 | hibah | 0.050952 | 1 | 1 | eksklusif_topik |
| 6 | produk | 0.048549 | 1 | 1 | eksklusif_topik |
| 7 | industri | 0.047006 | 1 | 1 | eksklusif_topik |
| 8 | mengambil | 0.033126 | 1 | 1 | eksklusif_topik |
| 9 | dana | 0.029549 | 2 | 2 | shared_2_topik |
| 10 | menggunakan | 0.027271 | 1 | 1 | eksklusif_topik |

### Topik 73 - Topik Umum - 73_netizen_diterima_mudik_gagal

- Coverage: **0/0** (-)
- Keyword ditemukan: **-**
- Kata pembeda topik teratas: netizen (eksklusif_topik; 1.293985), diterima (eksklusif_topik; 0.368239), mudik (eksklusif_topik; 0.088370), gagal (eksklusif_topik; 0.082830), gambaran (eksklusif_topik; 0.066357)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | netizen | 1.293985 | 1 | 1 | eksklusif_topik |
| 2 | diterima | 0.368239 | 1 | 1 | eksklusif_topik |
| 3 | mudik | 0.088370 | 1 | 1 | eksklusif_topik |
| 4 | gagal | 0.082830 | 1 | 1 | eksklusif_topik |
| 5 | gambaran | 0.066357 | 1 | 1 | eksklusif_topik |
| 6 | net | 0.064724 | 1 | 1 | eksklusif_topik |
| 7 | mudik lebaran | 0.056746 | 1 | 1 | eksklusif_topik |
| 8 | lucu | 0.053002 | 2 | 1 | khas_kategori |
| 9 | doa | 0.051943 | 1 | 1 | eksklusif_topik |
| 10 | berakhir | 0.046181 | 1 | 1 | eksklusif_topik |

### Topik 74 - Internasional - 74_motogp_posisi_amerika_amerika serikat

- Coverage: **2/81** (2.47%)
- Keyword ditemukan: **amerika\|amerika serikat**
- Kata pembeda topik teratas: motogp (eksklusif_topik; 0.236627), posisi (eksklusif_topik; 0.143803), kedua (eksklusif_topik; 0.058745), serikat (eksklusif_topik; 0.057894), berhasil (eksklusif_topik; 0.057324)

| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | motogp | 0.236627 | 1 | 1 | eksklusif_topik |
| 2 | posisi | 0.143803 | 1 | 1 | eksklusif_topik |
| 3 | amerika | 0.080218 | 2 | 2 | shared_2_topik |
| 4 | amerika serikat | 0.071997 | 2 | 2 | shared_2_topik |
| 5 | kemenangan | 0.060363 | 2 | 2 | shared_2_topik |
| 6 | kedua | 0.058745 | 1 | 1 | eksklusif_topik |
| 7 | serikat | 0.057894 | 1 | 1 | eksklusif_topik |
| 8 | berhasil | 0.057324 | 1 | 1 | eksklusif_topik |
| 9 | poin | 0.054846 | 2 | 2 | shared_2_topik |
| 10 | detik | 0.049367 | 1 | 1 | eksklusif_topik |

## Kata pembeda antar topik

Definisi kerja yang dipakai di report ini: kata dianggap **pembeda topik** jika muncul pada sedikit topik (`Frekuensi_Topik_Global` rendah), dan dianggap **pembeda kategori** jika hanya muncul pada satu kategori (`Frekuensi_Kategori_Global = 1`).

### Kata eksklusif kategori teratas

| Kategori | Ringkasan kata pembeda |
| --- | --- |
| Bencana & Cuaca | gunung (topik:1, total:0.502239), bukit (topik:1, total:0.228042), banjir (topik:1, total:0.199154), gempa (topik:1, total:0.137845), hujan (topik:1, total:0.123438), puncak (topik:1, total:0.091366) |
| Ekonomi & Bisnis | pasar (topik:2, total:0.123036), impor (topik:2, total:0.115440), gaji (topik:2, total:0.091577), rupiah (topik:2, total:0.086552), diskon (topik:2, total:0.080797), gula (topik:1, total:0.572777) |
| Hiburan & Gaya Hidup | nonton (topik:2, total:0.183580), film (topik:1, total:0.346080), video (topik:1, total:0.184869), youtube (topik:1, total:0.124751), streaming (topik:1, total:0.106474), cctv (topik:1, total:0.061609) |
| Internasional | iran (topik:2, total:0.276117), israel (topik:2, total:0.105986), australia (topik:1, total:0.711334), inggris (topik:1, total:0.680947), rusia (topik:1, total:0.301015), united (topik:1, total:0.256390) |
| Keamanan & Pertahanan | militer (topik:1, total:0.084383), pasukan (topik:1, total:0.062337), tni (topik:1, total:0.060128), angkatan (topik:1, total:0.045759), darat (topik:1, total:0.041334), tni angkatan (topik:1, total:0.034459) |
| Kesehatan | kesehatan (topik:3, total:0.468116), pasien (topik:2, total:0.076720), sakit (topik:2, total:0.056456), kanker (topik:1, total:1.143495), lockdown (topik:1, total:0.474398), masker (topik:1, total:0.472641) |
| Kriminal & Hukum | tersangka (topik:2, total:0.055939), polisi (topik:1, total:0.122096), seksual (topik:1, total:0.106688), wanita (topik:1, total:0.071300), hakim (topik:1, total:0.063133), kekerasan (topik:1, total:0.058029) |
| Lingkungan & Energi | gas (topik:2, total:0.162941), bukan bukan (topik:1, total:0.298122), sampah (topik:1, total:0.253387), minyak (topik:1, total:0.200851), kebakaran (topik:1, total:0.180223), kualitas (topik:1, total:0.153286) |
| Nasional & Pemerintahan | mulai (topik:1, total:0.457173), new normal (topik:1, total:0.363323), normal (topik:1, total:0.362346), new (topik:1, total:0.305123), dimulai (topik:1, total:0.159248), pemerintah (topik:1, total:0.126852) |
| Olahraga | laga (topik:2, total:0.127073), final (topik:1, total:0.113307), korea (topik:1, total:0.113078), timnas (topik:1, total:0.071526), kawan (topik:1, total:0.057948), pemain (topik:1, total:0.057124) |
| Pendidikan | sekolah (topik:1, total:0.132043), pelajar (topik:1, total:0.098556), mahasiswa (topik:1, total:0.097322), siswa (topik:1, total:0.092638), guru (topik:1, total:0.086038), belajar (topik:1, total:0.072829) |
| Politik | hitam (topik:1, total:0.662071), pdf (topik:1, total:0.346495), pdp (topik:1, total:0.321080), psbb (topik:1, total:0.198958), pdip (topik:1, total:0.197574), putih (topik:1, total:0.158629) |
| Teknologi & Sains | teknologi (topik:2, total:0.139440), google (topik:1, total:0.252709), digital (topik:1, total:0.173149), nge (topik:1, total:0.153437), bulan (topik:1, total:0.149599), aplikasi (topik:1, total:0.139012) |
| Topik Noise (Topic 0) | suara (topik:1, total:0.067899), covid covid (topik:1, total:0.062038), nasional nasional (topik:1, total:0.052217), merdeka (topik:1, total:0.033599), terkini (topik:1, total:0.031408), gambar (topik:1, total:0.031310) |
| Topik Umum | spares (topik:2, total:0.667932), nomor (topik:2, total:0.338677), lucu (topik:2, total:0.167089), suami (topik:2, total:0.163223), ndiricis (topik:2, total:0.153207), akun (topik:2, total:0.123460) |
| Transportasi & Infrastruktur | penumpang (topik:2, total:0.080255), pesawat (topik:1, total:0.247734), kereta (topik:1, total:0.235926), ikan (topik:1, total:0.192938), bandara (topik:1, total:0.178938), kapal (topik:1, total:0.151583) |

### Kata overlap lintas topik

| Kata | Jumlah topik | Jumlah kategori | Skor total c-TFIDF | Catatan |
| --- | ---: | ---: | ---: | --- |
| harga | 8 | 3 | 0.678662 | kata umum lintas konteks |
| licitud | 4 | 3 | 0.312012 | kata umum lintas konteks |
| alat | 3 | 3 | 0.335444 | kata umum lintas konteks |
| bisnis | 3 | 2 | 0.604985 | kata umum lintas konteks |
| covid | 3 | 2 | 0.181019 | kata umum lintas konteks |
| pelaku | 3 | 2 | 0.074700 | kata umum lintas konteks |
| kesehatan | 3 | 1 | 0.468116 | berulang di banyak topik tetapi masih dalam satu kategori |
| india | 2 | 2 | 1.287101 | kata umum lintas konteks |
| tiga | 2 | 2 | 0.763855 | kata umum lintas konteks |
| bintang | 2 | 2 | 0.505812 | kata umum lintas konteks |
| tiket | 2 | 2 | 0.440865 | kata umum lintas konteks |
| obat | 2 | 2 | 0.362044 | kata umum lintas konteks |
| skor | 2 | 2 | 0.323797 | kata umum lintas konteks |
| bumi | 2 | 2 | 0.306886 | kata umum lintas konteks |
| corona | 2 | 2 | 0.269384 | kata umum lintas konteks |
| udara | 2 | 2 | 0.257564 | kata umum lintas konteks |
| liga | 2 | 2 | 0.253601 | kata umum lintas konteks |
| mobil | 2 | 2 | 0.224708 | kata umum lintas konteks |
| api | 2 | 2 | 0.219040 | kata umum lintas konteks |
| perang | 2 | 2 | 0.203267 | kata umum lintas konteks |

### Topik dengan coverage keyword tertinggi

| Topik_ID | Kategori | Coverage | Keyword ditemukan | Nama topik |
| ---: | --- | ---: | --- | --- |
| 15 | Kriminal & Hukum | 9/57 | ditangkap\|hakim\|hukum\|jaksa\|pelaku\|pengadilan\|penjara\|polisi\|tersangka | 15_polisi_hakim_penjara_ditangkap |
| 14 | Bencana & Cuaca | 6/49 | angin\|banjir\|bencana\|bmkg\|gempa\|hujan | 14_banjir_gempa_hujan_sungai |
| 19 | Pendidikan | 7/64 | guru\|kampus\|mahasiswa\|pelajar\|sekolah\|siswa\|sma | 19_sekolah_pelajar_mahasiswa_siswa |
| 54 | Ekonomi & Bisnis | 7/80 | bursa\|harga\|ihsg\|investasi\|pasar\|perdagangan\|saham | 54_saham_investasi_ihsg_indeks |
| 31 | Internasional | 7/81 | eropa\|iran\|israel\|italia\|perang\|rusia\|ukraina | 31_rusia_ukraina_eropa_italia |
| 18 | Olahraga | 5/58 | olahraga\|pelatih\|pemain\|piala\|timnas | 18_timnas_pemain_piala_timnas indonesia |
| 38 | Transportasi & Infrastruktur | 5/58 | bus\|kai\|kereta\|stasiun\|transportasi | 38_kereta_kereta api_api_metro |
| 53 | Keamanan & Pertahanan | 5/60 | militer\|pasukan\|prajurit\|tentara\|tni | 53_perang_militer_tentara_prajurit |
| 6 | Politik | 4/60 | capres\|demokrat\|partai\|pemilu | 6_partai_presiden_jokowi_pemilu |
| 22 | Politik | 4/60 | pdip\|pkb\|pks\|ppp | 22_pdf_pdp_psbb_pdip |
| 12 | Kesehatan | 6/95 | bpjs\|dokter\|jantung\|kesehatan\|medis\|rumah sakit | 12_kesehatan_kesehatan kesehatan_sehat_d |
| 46 | Teknologi & Sains | 4/72 | bulan\|bumi\|matahari\|nasa | 46_bumi_bulan_matahari_nasa |

## Insight / interpretasi

- **Sinyal diskriminatif kuat di level topik.** Dari **658** kata unik, **579** kata (**87.99%**) hanya muncul pada satu topik. Artinya mayoritas kata berfungsi sebagai penanda topik yang cukup spesifik.
- **Level kategori masih cukup terpisah.** Sebanyak **606** kata (**92.10%**) hanya muncul pada satu kategori, sehingga agregasi kategori masih informatif.
- **Coverage keyword tidak merata.** Kategori dengan topik tanpa keyword hit paling banyak: Topik Umum (29 topik tanpa hit), Bencana & Cuaca (1 topik tanpa hit), Politik (1 topik tanpa hit), Topik Noise (Topic 0) (1 topik tanpa hit). Ini terutama menandai topik umum/noise atau topik yang kosakatanya belum tertangkap kamus kategori.
- **Kategori dengan coverage relatif paling kuat** ada pada `Pendidikan`, `Kriminal & Hukum`, dan `Keamanan & Pertahanan`. Secara praktis, topik-topik di kategori ini lebih sering memuat keyword yang sesuai dengan kamus kategori.
- **Beberapa kata overlap perlu dibaca hati-hati.** Kata seperti harga (8 topik/3 kategori), licitud (4 topik/3 kategori), alat (3 topik/3 kategori), bisnis (3 topik/2 kategori), covid (3 topik/2 kategori), pelaku (3 topik/2 kategori) muncul di banyak topik, sehingga daya pembedanya lebih rendah daripada kata eksklusif.
- **Ada indikasi artefak format/noise.** Contoh objektif dari token yang tampak seperti format dokumen, sumber web, atau pengulangan kata: html (1 topik), resmi resmi (1 topik), reffer (1 topik), pdf (1 topik), bukan bukan (1 topik), alat alat (1 topik), bisnis bisnis (1 topik), rumah rumah (1 topik). Kata-kata ini tetap dilaporkan apa adanya karena memang ada di CSV, tetapi interpretasinya harus lebih hati-hati.
- **Topik Umum dan Topik Noise perlu prioritas kehati-hatian tertinggi.** Keduanya memiliki coverage keyword nol, dan banyak tokennya bersifat sangat generik atau sulit ditafsirkan tanpa melihat dokumen sumber.
- **Interpretasi semantik dibuat dari kata dan nama topik, bukan dari dokumen asal.** Karena file ini hanya berisi hasil ranking token, analisis ini kuat untuk menjelaskan kata penanda topik, tetapi tidak bisa memverifikasi konteks kalimat asal tiap token.

### Bagian yang pasti vs inferensi

- **Pasti dari CSV:** nama kolom, jumlah baris/kolom, jumlah topik/kategori, ranking kata, skor `Skor_cTFIDF`, nilai `Coverage`, overlap kata, dan eksklusivitas kata.
- **Inferensi yang masih valid:** penafsiran makna topik/kategori dari gabungan `Nama_Topik`, kata berperingkat tinggi, dan pola overlap kata.
- **Batas inferensi:** tanpa dokumen sumber atau distribusi frekuensi dokumen asli, tidak bisa dipastikan apakah sebuah token aneh berasal dari noise scraping, OCR, atau memang istilah domain tertentu.

## Saran penggunaan Data Wrangler

Data Wrangler **bisa membantu cukup jauh** untuk eksplorasi, filter, agregasi, dan visual cek cepat. Namun, untuk **top-N per grup**, penandaan kata pembeda lintas topik/kategori, dan pembuatan **report Markdown lengkap**, script Python tetap lebih praktis.

### Operasi yang relevan di Data Wrangler

1. Muat `public/hasil/evaluasi_ctfidf_topik.csv` ke Data Wrangler.
2. Profil kolom `Topik_ID`, `Kategori`, `Nama_Topik`, `Kata`, `Skor_cTFIDF`, `Coverage`.
3. Gunakan **Sort** pada `Topik_ID` dan `Rank` untuk melihat 10 kata per topik secara langsung.
4. Gunakan **Group By** pada `['Kategori', 'Kata']` dengan agregasi `sum`, `max`, dan `nunique(Topik_ID)` untuk ringkasan kategori.
5. Gunakan **Group By** pada `['Kata']` dengan agregasi `nunique(Topik_ID)`, `nunique(Kategori)`, dan `sum(Skor_cTFIDF)` untuk mencari kata overlap dan kata pembeda.
6. Tambahkan kolom turunan dari `Coverage` agar rasio coverage bisa dipakai untuk sort/filter.

### Rumus / transform yang berguna

```python
import pandas as pd

df = pd.read_csv('public/hasil/evaluasi_ctfidf_topik.csv')
df[['Coverage_Found', 'Coverage_Total']] = df['Coverage'].str.split('/', expand=True).fillna('0').astype(int)
df['Coverage_Ratio'] = df['Coverage_Found'] / df['Coverage_Total'].replace({0: pd.NA})
```

```python
kata_per_kategori = (
    df.groupby(['Kategori', 'Kata'], as_index=False)
      .agg(
          Skor_Total_cTFIDF=('Skor_cTFIDF', 'sum'),
          Skor_Maks_cTFIDF=('Skor_cTFIDF', 'max'),
          Topik_Di_Kategori=('Topik_ID', 'nunique')
      )
      .sort_values(['Kategori', 'Topik_Di_Kategori', 'Skor_Total_cTFIDF', 'Skor_Maks_cTFIDF'], ascending=[True, False, False, False])
)
```

```python
kata_overlap = (
    df.groupby('Kata', as_index=False)
      .agg(
          Topik_Freq=('Topik_ID', 'nunique'),
          Kategori_Freq=('Kategori', 'nunique'),
          Skor_Total_cTFIDF=('Skor_cTFIDF', 'sum')
      )
)

kata_pembeda_topik = kata_overlap.query('Topik_Freq == 1')
kata_pembeda_kategori = kata_overlap.query('Kategori_Freq == 1')
```

### Bagian yang lebih tepat dibantu script Python

- Menentukan **kata pembeda teratas untuk setiap topik** dengan aturan gabungan `Skor_cTFIDF` + frekuensi global.
- Menyusun **report Markdown lengkap** dengan tabel per kategori dan per topik.
- Menambahkan catatan interpretasi, overlap, coverage tertinggi, dan keterbatasan analisis secara otomatis.
- Menjamin hasil bisa diulang tanpa klik manual di antarmuka.

## Kesimpulan

File `evaluasi_ctfidf_topik.csv` cukup kuat untuk mengidentifikasi kata paling berpengaruh dan kata pembeda baik di level topik maupun kategori, karena tersedia `Rank`, `Kata`, dan `Skor_cTFIDF` yang konsisten per topik.

Temuan utama menunjukkan bahwa mayoritas kata bersifat spesifik terhadap satu topik, sehingga pemisahan topik sudah cukup jelas. Namun, ada juga kata yang overlap lintas topik/kategori dan beberapa token yang tampak seperti artefak format/noise, terutama di `Topik Umum` dan `Topik Noise (Topic 0)`, sehingga area ini perlu interpretasi lebih hati-hati.

Untuk eksplorasi visual dan agregasi awal, Data Wrangler layak dipakai. Untuk ranking terstruktur, penentuan kata pembeda, dan dokumentasi hasil lengkap, script Python tetap menjadi jalur yang paling stabil dan reproduktif.

## Laporan akhir

- File yang dibaca: `public/hasil/evaluasi_ctfidf_topik.csv`
- File yang dibuat: `public/hasil/analisis_ctfidf_topik.md`
- Script bantu yang dibuat: `scripts/analyze_ctfidf_topik.py` untuk membaca CSV, menghitung agregasi topik/kategori, dan menghasilkan report Markdown.
- Metode analisis: ranking berbasis `Skor_cTFIDF`, agregasi per kategori, penghitungan frekuensi kata lintas topik/kategori, serta evaluasi `Coverage` sebagai sinyal tambahan.
- Keterbatasan analisis: tidak ada dokumen sumber, tidak ada frekuensi dokumen asli, dan ada token yang tampak generik/artefaktual; karena itu penilaian makna semantik tetap berbasis token dan nama topik, bukan verifikasi konteks artikel asal.
