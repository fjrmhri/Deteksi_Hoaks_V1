"""
Backend FastAPI untuk Indo Hoax Detector.

Modul ini memuat model klasifikasi IndoBERT dan model topik BERTopic,
lalu menyediakan endpoint REST untuk prediksi hoaks/fakta pada teks
tunggal, batch teks, maupun analisis multi-paragraf (segmentasi kalimat,
klasifikasi per kalimat, agregasi verdict dokumen, dan ekstraksi topik).
"""

# ==== Import pustaka standar Python ====
import json
import os
import random
import re
import threading
from collections import Counter, defaultdict
from threading import Lock
from typing import Any, Dict, Iterable, List, Optional, Tuple


# ==== Import pustaka pihak ketiga (numerik, model, dan web framework) ====
import numpy as np
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer


# ==== Konfigurasi lingkungan (environment variables) ====
# Semua nilai berikut bisa dioverride lewat environment variable saat deploy,
# sehingga model, threshold, dan ukuran batch dapat diatur tanpa mengubah kode.
MODEL_ID        = os.getenv("MODEL_ID", "fjrmhri/deteksi_hoaks_indobert")
SUBFOLDER       = os.getenv("MODEL_SUBFOLDER", "") or None
MAX_LENGTH      = int(os.getenv("MAX_LENGTH", "256"))


# Ambang batas (threshold) probabilitas untuk menentukan level risiko hoaks
THRESH_HIGH     = float(os.getenv("HOAX_THRESH_HIGH", "0.80"))
THRESH_MED      = float(os.getenv("HOAX_THRESH_MED",  "0.50"))


# Aturan khusus untuk kalimat pendek (rawan salah klasifikasi karena minim konteks)
MIN_KATA_KALIMAT      = int(os.getenv("MIN_KATA_KALIMAT", "8"))
THRESH_KALIMAT_PENDEK = float(os.getenv("THRESH_KALIMAT_PENDEK", "0.70"))


# Ukuran batch untuk proses prediksi & embedding, memengaruhi kecepatan inferensi
PREDICT_BATCH_SIZE   = int(os.getenv("PREDICT_BATCH_SIZE", "64"))
SENTENCE_BATCH_SIZE  = int(os.getenv("SENTENCE_BATCH_SIZE", "64"))
SENTENCE_AMBER_CONF  = float(os.getenv("SENTENCE_AMBER_CONF", "0.70"))
BERTOPIC_EMBED_BATCH = int(os.getenv("BERTOPIC_EMBED_BATCH", "32"))


# Konfigurasi model BERTopic untuk ekstraksi topik paragraf
TOPIC_KEYWORDS_TOPK     = int(os.getenv("TOPIC_KEYWORDS_TOPK", "3"))
TOPIC_BERTOPIC_MODEL_ID = os.getenv(
    "TOPIC_BERTOPIC_MODEL_ID", "fjrmhri/deteksi_hoaks_bertopic"
).strip()

BERTOPIC_EMBED_MODEL_ID = os.getenv(
    "BERTOPIC_EMBED_MODEL_ID",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)


# Konfigurasi logging sampel hasil prediksi (nonaktif secara default)
ENABLE_LOGGING  = os.getenv("ENABLE_HOAX_LOGGING", "0") == "1"
LOG_SAMPLE_RATE = float(os.getenv("HOAX_LOG_SAMPLE_RATE", "0.2"))


# ==== Inisialisasi perangkat komputasi (GPU jika tersedia, jika tidak pakai CPU) ====
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
if torch.cuda.is_available():
    torch.set_float32_matmul_precision("high")


# Direktori tempat file app.py ini berada, dipakai untuk mencari file konfigurasi lokal
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


# Menampilkan ringkasan konfigurasi ke log saat aplikasi pertama kali dijalankan
print("======================================")
print(f"Loading IndoBERT dari Hub : {MODEL_ID}")
print(f"Device                    : {DEVICE}")
print(f"THRESH_HIGH/MED           : {THRESH_HIGH} / {THRESH_MED}")
print(f"THRESH_KALIMAT_PENDEK     : {THRESH_KALIMAT_PENDEK} (< {MIN_KATA_KALIMAT} kata)")
print(f"BERTopic embed model      : {BERTOPIC_EMBED_MODEL_ID}")
print("======================================")


# ==== Fungsi pemuat model & tokenizer IndoBERT dari Hugging Face Hub ====
# Mencoba memuat dari subfolder tertentu (jika diatur), lalu fallback ke root repo
# apabila pemuatan subfolder gagal.
def _load_model_artifacts():
    kw = {}
    if SUBFOLDER:
        kw["subfolder"] = SUBFOLDER
    try:
        tok = AutoTokenizer.from_pretrained(MODEL_ID, **kw)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, **kw)
        return tok, mdl
    except Exception as e:
        if SUBFOLDER:
            print(f"[WARN] Gagal load subfolder='{SUBFOLDER}', retry: {e}")
            tok = AutoTokenizer.from_pretrained(MODEL_ID)
            mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
            return tok, mdl
        raise


# ==== Inisialisasi variabel global: model & tokenizer siap pakai ====
tokenizer, model = _load_model_artifacts()
model.to(DEVICE)
model.eval()


# ==== Inisialisasi variabel global: pemetaan label prediksi & threshold klasifikasi ====
ID2LABEL: Dict[int, str] = {0: "not_hoax", 1: "hoax"}

_DEFAULT_THRESHOLD_OPTIMAL: float = 0.47
_INFERENCE_CONFIG: Dict[str, Any] = {}
_THRESHOLD_OPTIMAL: float = _DEFAULT_THRESHOLD_OPTIMAL


# ==== Fungsi pembaca file konfigurasi inferensi (JSON) ====
def _read_inference_config(cfg_path: str) -> Dict[str, Any]:
    with open(cfg_path, encoding="utf-8") as _f:
        return json.load(_f)


# ==== Fungsi pemuat konfigurasi inferensi ====
# Prioritas: file lokal (folder backend atau public/hasil) baru fallback unduh dari Hub.
def _load_inference_config() -> Tuple[Dict[str, Any], str]:
    local_candidates = (
        os.path.join(_BACKEND_DIR, "inference_config.json"),
        os.path.join(
            os.path.dirname(_BACKEND_DIR),
            "public",
            "hasil",
            "inference_config.json",
        ),
    )
    for local_path in local_candidates:
        if os.path.exists(local_path):
            print(f"[INFO] Pakai inference_config lokal: {local_path}")
            return _read_inference_config(local_path), local_path

    from huggingface_hub import hf_hub_download
    try:
        cfg_path = hf_hub_download(MODEL_ID, "inference_config.json")
        return _read_inference_config(cfg_path), cfg_path
    except Exception as hub_error:
        raise hub_error


# Memuat threshold_optimal & id2label dari inference_config.json apabila tersedia,
# jika gagal maka aplikasi tetap berjalan dengan nilai default.
try:
    _INFERENCE_CONFIG, _cfg_path = _load_inference_config()
    _THRESHOLD_OPTIMAL = float(
        _INFERENCE_CONFIG.get("threshold_optimal", _DEFAULT_THRESHOLD_OPTIMAL)
    )
    _cfg_id2label = _INFERENCE_CONFIG.get("id2label")
    if isinstance(_cfg_id2label, dict):
        _normalized_id2label = {}
        for _k, _v in _cfg_id2label.items():
            try:
                _normalized_id2label[int(_k)] = str(_v)
            except (TypeError, ValueError):
                continue
        if _normalized_id2label:
            ID2LABEL = _normalized_id2label
    print(
        f"[INFO] threshold_optimal dari inference_config.json ({_cfg_path}): "
        f"{_THRESHOLD_OPTIMAL}"
    )
except Exception as _e:
    print(f"[INFO] inference_config.json tidak tersedia ({_e}). Pakai {_THRESHOLD_OPTIMAL}")


# ==== Inisialisasi variabel global: peta kategori topik berbasis kata kunci ====
# Dipakai sebagai pengklasifikasi topik berbasis aturan (rule-based) sebelum
# jatuh ke BERTopic untuk teks yang tidak cocok kategori manapun.
PETA_KATEGORI: List[Tuple[str, set]] = [
    ("Kriminal & Hukum", {
        "polisi", "tersangka", "pengadilan", "hukum", "penjara", "korupsi",
        "kpk", "pembunuhan", "penipuan", "sidang", "vonis", "kriminal",
        "penyidikan", "jaksa", "hakim", "ditangkap", "ditahan", "terdakwa",
        "dakwaan", "kejaksaan", "mahkamah", "peradilan", "pidana", "perdata",
        "polri", "rutan", "lapas", "napi", "tahanan", "bui", "sel",
        "persidangan", "putusan", "hukuman", "denda", "banding", "kasasi",
        "penggeledahan", "penyitaan", "rekonstruksi", "otopsi", "visum",
        "tipikor", "suap", "gratifikasi", "pencucian", "pemalsuan",
        "penganiayaan", "pencurian", "perampokan", "narkoba", "narkotika",
        "pelecehan", "pemerkosaan", "kejahatan", "pelaku", "korban kriminal",
        "tewas", "kerangka", "seksual",
    }),
    ("Politik", {
        "pemilu", "pilkada", "dpr", "partai", "kampanye", "bawaslu", "kpu",
        "pilpres", "caleg", "koalisi", "oposisi", "legislasi", "debat",
        "konstitusi", "suara", "demokrat", "golkar", "pdip", "gerindra",
        "pks", "dpd", "mpr", "fraksi", "legislatif", "senator",
        "dprd", "pilwalkot", "pilgub", "pilbup", "capres", "cawapres",
        "paslon", "petahana", "tim sukses", "quick count", "real count",
        "rekap suara", "money politics", "politik uang", "black campaign",
        "kampanye hitam", "hoaks politik", "propaganda", "agitasi",
        "referendum", "demokrasi", "oligarki", "populisme", "nasionalisme",
        "pkb", "ppp", "pan", "nasdem", "hanura", "perindo", "psi",
        "pemilih", "suara rakyat", "kebijakan publik", "anggaran negara",
        "anies", "gibran", "pramono", "megawati",
    }),
    ("Nasional & Pemerintahan", {
        "kementerian", "menteri", "kebijakan", "asn", "pns", "pemerintah",
        "presiden", "ibukota", "otonomi", "daerah", "regulasi", "proyek",
        "pembangunan", "gubernur", "bupati", "walikota", "dprd", "pemda",
        "anggaran", "apbn", "apbd", "perpres", "perda", "kabinet",
        "wapres", "jokowi", "prabowo",
        "sekretariat", "lembaga", "badan", "komisi", "dirjen", "direktorat",
        "keppres", "inpres", "pp", "uu", "ruu", "peraturan", "undang-undang",
        "ibu kota nusantara", "ikn", "brin", "bpk", "bpn", "bps",
        "kemendag", "kemenhub", "kemenkes", "kemendikbud", "kementan",
        "aparatur", "birokrasi", "reformasi birokrasi", "e-government",
        "pengadaan", "tender", "proyek nasional", "infrastruktur nasional",
        "bansos", "bantuan sosial", "subsidi", "blt", "pkh",
    }),
    ("Ekonomi & Bisnis", {
        "ekonomi", "saham", "investasi", "inflasi", "bank", "keuangan",
        "pajak", "ihsg", "umkm", "harga", "pasar", "ekspor", "impor",
        "startup", "bisnis", "perdagangan", "rupiah", "dolar", "kurs",
        "bi", "ojk", "bumn", "swasta", "perusahaan", "modal", "aset",
        "defisit", "surplus", "neraca", "pdb", "gdp",
        "inflasi", "deflasi", "resesi", "stagflasi", "suku bunga",
        "kredit", "pinjaman", "utang", "obligasi", "saham", "dividen",
        "bursa efek", "bei", "forex", "valuta", "mata uang",
        "pertumbuhan ekonomi", "kemiskinan", "pengangguran", "lapangan kerja",
        "upah", "gaji", "phk", "tenaga kerja", "buruh", "pekerja",
        "industri", "manufaktur", "produksi", "ekspansi", "merger",
        "akuisisi", "ipo", "go public", "e-commerce", "marketplace",
        "fintech", "kripto", "bitcoin", "blockchain", "digital economy",
        "harga bahan pokok", "sembako", "beras", "minyak goreng", "bbm",
        "uang", "triliun", "juta", "transfer", "bni", "dana", "donasi",
        "taspen", "lowongan", "karyawan",
    }),
    ("Kesehatan", {
        "kesehatan", "penyakit", "dokter", "virus", "vaksin",
        "obat", "bpjs", "pandemi", "medis", "gejala", "terapi", "pasien",
        "klinis", "covid", "kemenkes", "epidemi", "wabah", "imunisasi",
        "apotek", "farmasi", "faskes", "puskesmas", "nakes",
        "rumah sakit", "rs", "poliklinik", "igd", "icu", "rawat inap",
        "rawat jalan", "operasi", "bedah", "diagnosa", "resep",
        "kanker", "diabetes", "hipertensi", "jantung", "stroke",
        "dbd", "malaria", "tbc", "hiv", "aids", "hepatitis",
        "mpox", "cacar", "flu", "demam", "batuk", "sesak napas",
        "lockdown", "karantina", "isolasi", "klaster", "herd immunity",
        "booster", "dosis", "suntik", "vaksinasi", "pfizer", "sinovac",
        "herbal", "jamu", "suplemen", "vitamin", "nutrisi", "gizi",
        "stunting", "gizi buruk", "obesitas", "kesehatan jiwa",
        "ppds", "masker", "sanitizer", "rokok", "vape", "bergizi", "daging",
    }),
    ("Teknologi & Sains", {
        "teknologi", "internet", "aplikasi", "digital", "siber", "hacker",
        "inovasi", "satelit", "algoritma", "data", "ai", "kecerdasan",
        "buatan", "software", "hardware", "smartphone", "kominfo", "server",
        "cloud", "robot",
        "artificial intelligence", "machine learning", "deep learning",
        "big data", "iot", "internet of things", "5g", "metaverse",
        "virtual reality", "vr", "augmented reality", "ar",
        "keamanan siber", "cybersecurity", "ransomware", "phishing",
        "kebocoran data", "privasi digital", "enkripsi", "firewall",
        "coding", "programming", "developer", "startup teknologi",
        "komputasi", "prosesor", "chip", "semikonduktor",
        "drone", "luar angkasa", "roket", "wahana", "lapan", "brin",
        "riset", "penelitian", "jurnal", "ilmiah", "laboratorium",
        "iphone", "apple", "telkom", "telkomsel", "sim", "ponsel",
        "samsung", "technology",
    }),
    ("Bencana & Cuaca", {
        "gempa", "banjir", "cuaca", "bmkg", "tsunami", "longsor", "erupsi",
        "badai", "evakuasi", "korban", "mitigasi", "iklim", "hujan", "angin",
        "kebakaran", "bencana", "bnpb", "bpbd", "kekeringan", "rob", "topan",
        "bencana alam", "force majeure", "tanah bergerak", "abrasi",
        "angin puting beliung", "tornado", "siklon", "hujan es",
        "banjir bandang", "banjir rob", "banjir lahar", "awan panas",
        "gunung berapi", "vulkanik", "aktivitas seismik", "magnitudo",
        "skala richter", "peringatan dini", "sirine", "tsunami warning",
        "pengungsian", "shelter", "posko", "bantuan bencana",
        "cuaca ekstrem", "el nino", "la nina", "perubahan iklim",
        "terbakar", "api", "tabung", "pohon", "tumbang",
    }),
    ("Olahraga", {
        "olahraga", "sepakbola", "futsal", "basket", "bulutangkis", "atlet",
        "turnamen", "medali", "piala", "fifa", "aff", "liga", "stadion",
        "pertandingan", "klub", "pssi", "pbsi", "olimpiade",
        "voli", "tenis", "badminton", "pemain", "pelatih",
        "sea games", "asian games", "world cup", "euro", "copa",
        "premier league", "serie a", "la liga", "bundesliga", "liga 1",
        "timnas", "persib", "persija", "arema", "bali united",
        "gol", "kartu merah", "kartu kuning", "offside", "penalti",
        "skor", "klasemen", "degradasi", "promosi", "transfer pemain",
        "sprint", "maraton", "lari", "renang", "senam", "tinju", "mma",
        "e-sports", "gaming kompetitif", "esports",
        "megawati", "sparks", "pink", "spiders", "liverpool", "city",
        "manchester", "arsenal", "motogp", "marquez", "bagnaia",
    }),
    ("Keamanan & Pertahanan", {
        "militer", "tni", "angkatan darat", "angkatan laut", "angkatan udara",
        "tentara", "prajurit", "pasukan", "batalyon", "komando",
        "pertahanan", "senjata", "amunisi", "peluru", "meriam", "tank",
        "pesawat tempur", "kapal perang", "kapal selam", "frigate",
        "operasi militer", "latihan militer", "manuver", "gelar pasukan",
        "konflik bersenjata", "perang saudara", "gerilya", "insurgensi",
        "teror", "teroris", "bom", "ledakan", "serangan", "penembakan",
        "separatis", "papua", "kkb", "opm", "kelompok bersenjata",
        "natuna", "laut china selatan", "kedaulatan wilayah", "perbatasan",
        "pertahanan nasional", "kemenhan", "mabes tni", "panglima",
        "densus 88", "brimob", "kopassus", "kostrad", "marinir",
        "intel", "intelijen", "bais", "bnpt", "deradikalisasi",
        "pangkalan militer", "alutsista", "alutsista baru",
    }),
    ("Internasional", {
        "diplomasi", "perang", "konflik", "pbb", "nato", "geopolitik",
        "internasional", "sanksi", "asean", "g20", "kedutaan", "wna", "visa",
        "rusia", "russia", "ukraina", "ukraine", "amerika", "as", "usa",
        "china", "cina", "tiongkok", "taiwan", "hongkong",
        "eropa", "uni eropa", "inggris", "jerman", "perancis", "italia",
        "jepang", "korea selatan", "korea utara", "india", "pakistan",
        "iran", "arab saudi", "israel", "palestina", "gaza", "lebanon",
        "suriah", "irak", "afghanistan", "turki", "mesir", "nigeria",
        "australia", "kanada", "brazil", "meksiko",
        "hubungan bilateral", "hubungan multilateral", "perjanjian",
        "kerja sama internasional", "kunjungan kenegaraan", "state visit",
        "konferensi internasional", "summit", "ktt",
        "embargo", "blokade", "resolusi pbb", "dewan keamanan pbb",
        "who", "imf", "world bank", "wto", "apec",
        "pengungsi", "imigran", "asylum", "deportasi",
        "hak asasi manusia", "ham internasional", "amnesty international",
        "mata-mata", "espionase", "perang proxy", "perang dagang",
        "yoon", "suk", "yeol", "korea", "saudi", "arab",
    }),
    ("Pendidikan", {
        "sekolah", "guru", "siswa", "mahasiswa", "kampus", "universitas",
        "beasiswa", "kurikulum", "ujian", "akademik", "riset",
        "kemendikbud", "snbp", "snbt", "sma", "smp", "sd", "dosen",
        "rektor", "fakultas",
        "pelajar", "murid", "pengajar", "pendidik", "tenaga pendidik",
        "perguruan tinggi", "pt", "prodi", "jurusan", "semester",
        "ipk", "skripsi", "tesis", "disertasi", "wisuda", "ijazah",
        "akreditasi", "bsnp", "kemdikbud", "dikti",
        "un", "ujian nasional", "seleksi masuk", "snmptn", "sbmptn",
        "ppdb", "penerimaan peserta didik", "zonasi", "jalur prestasi",
        "literasi", "numerasi", "kompetensi", "sertifikasi guru",
        "tunjangan guru", "p3k", "cpns guru",
        "bimbel", "les", "kursus", "pelatihan", "vokasi", "smk",
        "pendidikan karakter", "anti bullying", "perundungan",
    }),
    ("Transportasi & Infrastruktur", {
        "jalan", "tol", "kereta", "bandara", "pelabuhan", "transportasi",
        "kendaraan", "mrt", "lrt", "bus", "pesawat", "kapal",
        "terminal", "stasiun", "garuda", "kemenhub",
        "krl", "kereta cepat", "whoosh", "kai", "damri", "transjakarta",
        "ojek online", "gojek", "grab", "taksi", "angkutan umum",
        "jalan tol", "tol trans jawa", "tol trans sumatera",
        "jembatan", "flyover", "underpass", "terowongan",
        "bandara soetta", "bandara internasional", "runway",
        "maskapai", "lion air", "batik air", "citilink", "airasia",
        "kapal laut", "pelni", "asdp", "ferry",
        "kecelakaan lalu lintas", "kemacetan", "tilang",
        "sim", "stnk", "kir", "emisi kendaraan",
        "bbm", "spbu", "subsidi bbm", "pertamax", "pertalite",
        "sepeda", "motor", "bersepeda",
    }),
    ("Lingkungan & Energi", {
        "lingkungan", "energi", "listrik", "minyak", "gas", "emisi",
        "polusi", "tambang", "pln", "pertamina", "karbon",
        "hutan", "deforestasi", "sawit", "sampah",
        "perubahan iklim", "climate change", "pemanasan global",
        "emisi karbon", "co2", "gas rumah kaca", "net zero",
        "energi terbarukan", "panel surya", "turbin angin", "pltm",
        "pltu", "pltn", "nuklir", "geothermal", "panas bumi",
        "batu bara", "batubara", "gas alam", "lng", "lpg",
        "illegal logging", "pembalakan liar", "kebakaran hutan",
        "asap", "kabut asap", "karhutla",
        "pencemaran", "polusi udara", "polusi air", "polusi tanah",
        "limbah", "limbah industri", "limbah b3", "sampah plastik",
        "daur ulang", "zero waste", "bank sampah",
        "konservasi", "satwa liar", "biodiversitas", "ekosistem",
        "mangrove", "terumbu karang", "laut bersih",
        "tambang nikel", "tambang emas", "tambang batu bara",
        "ular", "serangga", "penanaman",
    }),
    ("Hiburan & Gaya Hidup", {
        "artis", "film", "musik", "konser", "selebritas", "bioskop", "drama",
        "viral", "sinetron", "festival", "influencer", "lifestyle", "seleb",
        "youtube", "instagram", "tiktok", "kuliner", "wisata",
        "aktor", "aktris", "penyanyi", "band", "idol", "kpop", "anime",
        "streaming", "netflix", "disney", "spotify", "podcast",
        "game", "gaming", "esports", "twitch",
        "fashion", "mode", "tren", "beauty", "skincare", "makeup",
        "diet", "fitness", "gym", "olahraga gaya hidup",
        "restoran", "kafe", "cafe", "food vlogger", "street food",
        "destinasi wisata", "hotel", "resort", "villa",
        "selebgram", "youtuber", "content creator", "buzzer",
        "gosip", "scandal", "perceraian", "pernikahan seleb",
        "award", "festival film", "box office",
        "tmii", "taman", "libur", "tradisi", "sirkus", "circus",
    }),
    ("Agama & Sosial", {
        "muslim", "islam", "masjid", "allah", "umat", "halal", "salat",
        "arab", "saudi", "puasa", "ibadah", "zakat", "gereja", "katedral",
        "paskah", "kristen",
    }),
    ("Klaim & Pemeriksaan Fakta", {
        "hoax", "klaim", "narasi", "video", "gambar", "unggahan", "akun",
        "facebook", "whatsapp", "tautan", "otp", "phishing", "cek fakta",
        "klarifikasi",
    }),
]


# ==== Fungsi kategorisasi topik berbasis kata kunci (rule-based) ====
def _kategorisasi_teks(teks: str) -> Optional[Tuple[str, float]]:
    teks_lower = teks.lower()
    teks_clean = re.sub(r"[^\w\s]", " ", teks_lower)
    token_set  = set(teks_clean.split())
    total      = max(len(token_set), 1)
    best_nama: Optional[str] = None
    best_skor: float = 0.0
    for nama, kata_kunci in PETA_KATEGORI:
        hit = 0
        for kw in kata_kunci:
            if " " in kw:
                if kw in teks_lower:
                    hit += 1
            else:
                if kw in token_set:
                    hit += 1
        if hit == 0:
            continue
        skor = hit / total
        if skor > best_skor:
            best_skor = skor
            best_nama = nama
    if best_nama is None:
        return None
    return best_nama, _round6(best_skor)


# ==== Inisialisasi variabel global: status model BERTopic (dimuat secara asinkron) ====
_bertopic_model = None
_st_embedder    = None
_bertopic_lock  = Lock()
_bertopic_ready = False


# ==== Fungsi pemuat BERTopic & sentence embedder di thread terpisah ====
# Dijalankan di background agar startup API tidak menunggu proses loading yang berat.
def _load_bertopic_background():
    global _bertopic_model, _st_embedder, _bertopic_ready
    with _bertopic_lock:
        if _bertopic_ready:
            return
        try:
            from bertopic import BERTopic
            from sentence_transformers import SentenceTransformer
            print(f"[INFO] Loading BERTopic dari: {TOPIC_BERTOPIC_MODEL_ID}")
            _bertopic_model = BERTopic.load(TOPIC_BERTOPIC_MODEL_ID)
            print(f"[INFO] Loading SentenceTransformer: {BERTOPIC_EMBED_MODEL_ID}")
            _st_embedder = SentenceTransformer(BERTOPIC_EMBED_MODEL_ID, device="cpu")
            print("[INFO] BERTopic + embedder berhasil dimuat.")
        except Exception as e:
            print(f"[WARN] Gagal load BERTopic/embedder: {e}.")
            _bertopic_model = None
            _st_embedder    = None
        finally:
            _bertopic_ready = True


# Memulai thread background untuk memuat BERTopic tanpa memblokir startup server
threading.Thread(target=_load_bertopic_background, daemon=True).start()


# ==== Fungsi pengambil komponen BERTopic yang sudah siap (thread-safe) ====
def _get_bertopic_components() -> Tuple[Optional[Any], Optional[Any]]:
    with _bertopic_lock:
        if _bertopic_ready:
            return _bertopic_model, _st_embedder
        return None, None


# ==== Inisialisasi aplikasi FastAPI ====
app = FastAPI(title="Indo Hoax Detector API", version="3.3.2")


# Mengizinkan akses lintas origin (CORS) agar frontend dapat memanggil API ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==== Skema request & response (Pydantic models) untuk endpoint prediksi teks tunggal/batch ====
class PredictRequest(BaseModel):
    text: str

class BatchPredictRequest(BaseModel):
    texts: List[str]

class PredictResponse(BaseModel):
    label: str
    score: float
    confidence: float
    probabilities: Dict[str, float]
    hoax_probability: float
    risk_level: str
    risk_explanation: str

class BatchPredictResponse(BaseModel):
    results: List[PredictResponse]


# ==== Skema request & response (Pydantic models) untuk endpoint analisis multi-paragraf ====
class AnalyzeRequest(BaseModel):
    text: str
    topic_per_paragraph: bool = False
    sentence_level: bool = True

class DocumentSummary(BaseModel):
    paragraph_count: int
    sentence_count: int
    hoax_sentence_count: int
    not_hoax_sentence_count: int

class DocumentAnalysis(BaseModel):
    label: str
    hoax_probability: float
    confidence: float
    risk_level: str
    risk_explanation: str
    sentence_aggregate_label: str
    summary: DocumentSummary

class TopicInfo(BaseModel):
    label: str
    score: float
    keywords: List[str]

class SentenceAnalysis(BaseModel):
    sentence_index: int
    text: str
    label: str
    probabilities: Dict[str, float]
    hoax_probability: float
    confidence: float
    color: str

class ParagraphAnalysis(BaseModel):
    paragraph_index: int
    text: str
    label: str
    hoax_probability: float
    confidence: float
    topic: TopicInfo
    sentences: List[SentenceAnalysis]

class SharedTopic(BaseModel):
    label: str
    paragraph_indices: List[int]

class AnalyzeMeta(BaseModel):
    model_id: str
    max_length: int
    sentence_batch_size: int
    threshold_used: Optional[float] = None
    topic_model_used: str = "bertopic+rules"

class AnalyzeResponse(BaseModel):
    document: DocumentAnalysis
    paragraphs: List[ParagraphAnalysis]
    shared_topics: List[SharedTopic]
    topics_global: Optional[TopicInfo] = None
    meta: AnalyzeMeta


# ==== Inisialisasi variabel global: pola regex & topik fallback ====
# Regex pemisah paragraf: mencocokkan 2 baris baru (newline) atau lebih secara
# berurutan (artinya ada baris kosong di antara paragraf). "\r?" membuat pola ini
# tetap cocok baik untuk newline gaya Unix (\n) maupun Windows (\r\n).
PARAGRAPH_SPLIT_RE = re.compile(r"(?:\r?\n){2,}")
# Regex pemisah kalimat, terdiri dari 2 alternatif yang dipisah "|":
#   1) [^.!?]+(?:[.!?]+(?:[")\]]+)?)  -> rangkaian karakter apa pun SELAIN . ! ?,
#      lalu diakhiri satu/lebih tanda baca akhir kalimat (. ! ?), dan boleh diikuti
#      tanda kutip/kurung penutup seperti " ) ] (mis. kalimat dalam kutipan).
#   2) [^.!?]+$                       -> jika sampai akhir string tidak ada tanda
#      baca akhir kalimat sama sekali, sisa teks tetap diambil sebagai satu kalimat.
SENTENCE_SPLIT_RE  = re.compile(r'[^.!?]+(?:[.!?]+(?:[")\]]+)?)|[^.!?]+$')
# Regex untuk mendeteksi satu atau lebih karakter whitespace (spasi, tab, newline,
# dsb.) secara berurutan; dipakai untuk merapikan teks jadi satu spasi tunggal.
WS_RE              = re.compile(r"\s+")

_FALLBACK_TOPIC = TopicInfo(label="Topik Umum", score=0.0, keywords=["topik_umum"])


# ==== Fungsi pembulatan angka ke 6 desimal (menjaga konsistensi output) ====
def _round6(v: float) -> float:
    return float(round(float(v), 6))


# ==== Fungsi pembentuk objek TopicInfo dari hasil kategorisasi rule-based ====
def _topic_kategori(
    nama: str,
    skor: float,
    keywords: Optional[List[str]] = None,
) -> TopicInfo:
    return TopicInfo(
        label=nama,
        score=_round6(skor),
        keywords=keywords if keywords else [nama],
    )


# ==== Fungsi kategorisasi topik dari daftar kata kunci hasil BERTopic ====
def _kategori_dari_keywords(keywords: List[str]) -> TopicInfo:
    if not keywords:
        return _FALLBACK_TOPIC
    hasil = _kategorisasi_teks(" ".join(keywords))
    if hasil is None:
        return TopicInfo(
            label=_FALLBACK_TOPIC.label,
            score=_FALLBACK_TOPIC.score,
            keywords=keywords,
        )
    nama, skor = hasil
    return _topic_kategori(nama, skor, keywords)


# ==== Fungsi pemecah list menjadi beberapa chunk sesuai ukuran batch ====
def _iter_chunks(items: List[str], chunk_size: int) -> Iterable[List[str]]:
    chunk_size = max(1, chunk_size)
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]


# ==== Fungsi normalisasi spasi/whitespace pada teks ====
def _normalize_unit_text(text: str) -> str:
    return WS_RE.sub(" ", str(text)).strip()


# ==== Fungsi penyiap daftar teks sebelum diproses model (menangani teks kosong) ====
def _prepare_texts(texts: List[str]) -> List[str]:
    return [_normalize_unit_text(t) if t else "[EMPTY]" for t in texts]


# ==== Fungsi inferensi utama: menghitung probabilitas hoax/not_hoax dari IndoBERT ====
# Melakukan deduplikasi teks identik agar tidak dihitung berulang, lalu memetakan
# kembali hasilnya ke urutan input asli.
def _predict_proba(texts: List[str], batch_size: int = SENTENCE_BATCH_SIZE) -> List[Dict[str, float]]:
    if not texts:
        return []
    prepared = _prepare_texts(texts)
    unique_texts: List[str] = []
    text_to_idx: Dict[str, int] = {}
    inverse: List[int] = []
    for t in prepared:
        if t not in text_to_idx:
            text_to_idx[t] = len(unique_texts)
            unique_texts.append(t)
        inverse.append(text_to_idx[t])
    unique_results: List[Dict[str, float]] = []
    for chunk in _iter_chunks(unique_texts, batch_size):
        enc = tokenizer(
            chunk, padding=True, truncation=True,
            max_length=MAX_LENGTH, return_tensors="pt",
        )
        enc = {k: v.to(DEVICE) for k, v in enc.items()}
        with torch.inference_mode():
            probs = torch.softmax(model(**enc).logits, dim=-1).cpu().numpy()
        for row in probs:
            unique_results.append({
                ID2LABEL.get(idx, str(idx)): float(p)
                for idx, p in enumerate(row)
            })
    return [dict(unique_results[i]) for i in inverse]


# ==== Fungsi pengekstrak probabilitas kelas 'hoax' dari hasil prediksi model ====
def _extract_hoax_probability(prob_dict: Dict[str, float]) -> float:
    if not prob_dict:
        return 0.0
    for k in prob_dict:
        nk = re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")
        if nk in {"hoax", "hoaks"} or ("hoax" in nk and "not" not in nk and "non" not in nk):
            return float(prob_dict[k])
    if len(prob_dict) == 2:
        for k in prob_dict:
            nk = re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")
            if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
                return float(1.0 - float(prob_dict[k]))
    return 0.0


# ==== Fungsi pengekstrak probabilitas kelas 'not_hoax' dari hasil prediksi model ====
def _extract_not_hoax_probability(prob_dict: Dict[str, float], p_hoax: float) -> float:
    if not prob_dict:
        return float(1.0 - p_hoax)
    for k in prob_dict:
        nk = re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")
        if nk in {"not_hoax", "non_hoax", "fakta", "fact", "valid"}:
            return float(prob_dict[k])
    return float(max(0.0, min(1.0, 1.0 - p_hoax)))


# ==== Fungsi penentu level risiko & penjelasannya berdasarkan probabilitas hoaks ====
def analyze_risk(p_hoax: float, original_text: Optional[str] = None) -> Tuple[str, str]:
    if p_hoax > THRESH_HIGH:
        level = "high"
        explanation = (
            f"Model sangat yakin teks ini hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Jangan disebarkan sebelum ada klarifikasi resmi."
        )
    elif p_hoax > max(THRESH_MED, _THRESHOLD_OPTIMAL):
        level = "medium"
        explanation = (
            f"Model menilai teks ini berpotensi hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Cek ulang ke sumber resmi."
        )
    else:
        level = "low"
        explanation = (
            f"Model menilai teks ini cenderung bukan hoaks (P(hoaks) ≈ {p_hoax:.2%}). "
            "Tetap gunakan literasi kritis."
        )
    if original_text is not None and len(str(original_text).strip().split()) < 5:
        if level == "low":
            level = "medium"
        explanation += " Teks sangat pendek (< 5 kata), prediksi bisa kurang stabil."
    return level, explanation


# ==== Fungsi pemecah teks menjadi paragraf ====
def _split_paragraphs(text: str) -> List[str]:
    raw = str(text).strip()  # pastikan input berupa string, buang spasi di awal/akhir
    if not raw:               # jika teks kosong setelah dirapikan...
        return []              # ...tidak ada paragraf sama sekali, kembalikan list kosong
    # Pisahkan teks di setiap titik yang cocok PARAGRAPH_SPLIT_RE (>=2 newline / baris
    # kosong), lalu buang elemen yang jadi kosong setelah di-strip (mis. baris kosong ganda)
    paragraphs = [p.strip() for p in PARAGRAPH_SPLIT_RE.split(raw) if p.strip()]
    # --- Fallback untuk teks yang paragrafnya HANYA dipisah newline tunggal ---
    # Jika hasil split di atas cuma menghasilkan 0 atau 1 paragraf, padahal teks
    # masih mengandung newline, kemungkinan besar user tidak memberi baris kosong
    # di antara paragraf (hanya Enter satu kali), sehingga PARAGRAPH_SPLIT_RE gagal
    # mendeteksi batas paragraf dengan benar.
    if len(paragraphs) <= 1 and "\n" in raw:
        # Coba pisah ulang berdasarkan tiap baris tunggal (satu newline = satu baris)
        line_based = [p.strip() for p in raw.splitlines() if p.strip()]
        if len(line_based) > 1:      # jika cara ini menghasilkan lebih dari 1 baris...
            return line_based         # ...anggap tiap baris sebagai satu paragraf
    # Fallback terakhir: kalau tetap tidak ada paragraf yang terbentuk (mis. teks
    # tanpa newline sama sekali), kembalikan seluruh teks sebagai satu paragraf tunggal
    return paragraphs or [raw]


# ==== Fungsi pemecah paragraf menjadi kalimat ====
def _split_sentences(paragraph: str) -> List[str]:
    normalized = _normalize_unit_text(paragraph)  # rapikan whitespace jadi satu spasi
    if not normalized:                              # jika paragraf kosong setelah dirapikan...
        return []                                    # ...tidak ada kalimat untuk diproses
    # Cari semua potongan teks yang cocok SENTENCE_SPLIT_RE (kalimat yang berakhir
    # dengan . ! ? , atau sisa teks di akhir paragraf tanpa tanda baca), lalu strip
    # spasi di tiap kalimat hasil pemecahan
    sentences = [m.group(0).strip() for m in SENTENCE_SPLIT_RE.finditer(normalized)]
    # Buang kalimat yang jadi kosong (mis. hasil match tak bermakna); jika ternyata
    # tidak ada satu pun kalimat valid yang tersisa, kembalikan seluruh paragraf
    # sebagai satu kalimat tunggal (fallback agar tidak kehilangan teks)
    return [s for s in sentences if s] or [normalized]


# ==== Fungsi penentu warna highlight kalimat pada hasil analisis ====
def _sentence_color(label: str, confidence: float) -> str:
    if label == "hoax":
        return "red"
    if confidence < SENTENCE_AMBER_CONF:
        return "amber"
    return "green"


# ==== Fungsi penentu label kanonik (hoax/not_hoax) berdasarkan threshold ====
def _to_canonical_label(p_hoax: float, teks: Optional[str] = None) -> str:
    thresh = _THRESHOLD_OPTIMAL
    if teks is not None:
        n_kata = len(str(teks).strip().split())
        if n_kata < MIN_KATA_KALIMAT:
            thresh = THRESH_KALIMAT_PENDEK
    return "hoax" if p_hoax >= thresh else "not_hoax"


# ==== Fungsi encoding teks menjadi embedding menggunakan SentenceTransformer ====
def _st_encode(texts: List[str], embedder) -> np.ndarray:
    return embedder.encode(
        texts, batch_size=BERTOPIC_EMBED_BATCH,
        show_progress_bar=False, convert_to_numpy=True, normalize_embeddings=True,
    )


# ==== Fungsi inferensi topik per paragraf (gabungan rule-based & BERTopic) ====
def _infer_topic_per_paragraf(texts: List[str]) -> List[TopicInfo]:
    rule_results: List[Optional[Tuple[str, float]]] = [
        _kategorisasi_teks(t) for t in texts
    ]
    idx_perlu_bertopic = [i for i, r in enumerate(rule_results) if r is None]
    bertopic_map: Dict[int, TopicInfo] = {}

    if idx_perlu_bertopic:
        btm, embedder = _get_bertopic_components()
        if btm is not None and embedder is not None:
            try:
                teks_subset = [texts[i] for i in idx_perlu_bertopic]
                embeddings  = _st_encode(teks_subset, embedder)
                topic_ids, _ = btm.transform(teks_subset, embeddings=embeddings)
                for local_i, (global_i, tid) in enumerate(
                    zip(idx_perlu_bertopic, topic_ids)
                ):
                    if tid == -1:
                        bertopic_map[global_i] = _FALLBACK_TOPIC
                        continue
                    topic_words = btm.get_topic(tid) or []
                    keywords    = [w for w, _ in topic_words[:TOPIC_KEYWORDS_TOPK]]
                    bertopic_map[global_i] = _kategori_dari_keywords(keywords)
            except Exception as e:
                print(f"[WARN] BERTopic inference error: {e}")

    final: List[TopicInfo] = []
    for i in range(len(texts)):
        rule_match = rule_results[i]
        if rule_match is not None:
            nama, skor = rule_match
            final.append(_topic_kategori(nama, skor))
        elif i in bertopic_map:
            final.append(bertopic_map[i])
        else:
            final.append(_FALLBACK_TOPIC)
    return final


# ==== Fungsi pembentuk response prediksi tunggal (label, skor, level risiko) ====
def _build_predict_response(prob_dict: Dict[str, float], original_text: str) -> PredictResponse:
    p_hoax = _extract_hoax_probability(prob_dict)
    p_not_hoax = _extract_not_hoax_probability(prob_dict, p_hoax)
    label = _to_canonical_label(p_hoax, teks=original_text)
    score = p_hoax if label == "hoax" else p_not_hoax
    confidence = _round6(score)
    risk_level, risk_explanation = analyze_risk(p_hoax, original_text=original_text)
    return PredictResponse(
        label=label,
        score=confidence,
        confidence=confidence,
        probabilities={
            "not_hoax": _round6(p_not_hoax),
            "hoax": _round6(p_hoax),
        },
        hoax_probability=_round6(p_hoax),
        risk_level=risk_level,
        risk_explanation=risk_explanation,
    )


# ==== Fungsi logging sampel hasil prediksi (aktif hanya jika ENABLE_LOGGING=1) ====
def _maybe_log(sample_info: Dict):
    if not ENABLE_LOGGING:
        return
    if random.random() > LOG_SAMPLE_RATE:
        return
    print("[HOAX_LOG]", sample_info)


# ==== Fungsi agregasi verdict dokumen dari kumpulan hasil klasifikasi per kalimat ====
def _aggregate_verdict(
    all_sentences: List[SentenceAnalysis],
) -> Tuple[str, float, float]:
    if not all_sentences:                  # jika tidak ada satu pun kalimat masuk...
        return "not_hoax", 0.0, 0.0         # ...default aman: anggap not_hoax, skor 0

    # --- Kelompokkan "suara" tiap kalimat berdasarkan label hasil klasifikasinya ---
    hoax_sents     = [s for s in all_sentences if s.label == "hoax"]      # kalimat berlabel hoax
    not_hoax_sents = [s for s in all_sentences if s.label == "not_hoax"]  # kalimat berlabel not_hoax
    hoax_count     = len(hoax_sents)        # jumlah "suara" untuk hoax
    not_hoax_count = len(not_hoax_sents)    # jumlah "suara" untuk not_hoax
    # Rata-rata probabilitas hoax dari SEMUA kalimat (tanpa memandang labelnya),
    # dipakai sebagai skor confidence dokumen di kedua kemungkinan verdict di bawah
    mean_p_hoax    = float(
        sum(s.hoax_probability for s in all_sentences) / len(all_sentences)
    )

    # ==== MAJORITY VOTE + TIE-BREAKING ====
    # Aturan: verdict dokumen mengikuti label yang "menang suara" di antara semua
    # kalimatnya (mayoritas kalimat hoax -> dokumen hoax, mayoritas not_hoax -> dokumen
    # not_hoax). Operator yang dipakai adalah ">=" (bukan ">"), sehingga saat terjadi
    # SERI/TIE (hoax_count == not_hoax_count), keputusan tetap dijatuhkan ke "hoax".
    # Ini kebijakan berat-sebelah yang sengaja dipilih: lebih aman menandai sesuatu
    # sebagai hoax saat ragu-ragu (skor seimbang), daripada meloloskannya begitu saja.
    # Guard tambahan "hoax_count > 0" mencegah verdict "hoax" keluar pada kasus
    # degenerate di mana hoax_count dan not_hoax_count sama-sama nol.
    if hoax_count >= not_hoax_count and hoax_count > 0:
        # Verdict dokumen = "hoax". Hitung rata-rata probabilitas hoax HANYA dari
        # kalimat-kalimat yang berlabel hoax (bukan dari semua kalimat), supaya
        # confidence yang dilaporkan benar-benar mencerminkan seberapa yakin model
        # terhadap kalimat-kalimat yang dianggap hoax tersebut.
        p_hoax_doc = float(
            sum(s.hoax_probability for s in hoax_sents) / hoax_count
        )
        return "hoax", mean_p_hoax, p_hoax_doc

    # Verdict dokumen = "not_hoax" (kalah suara atau tidak ada kalimat hoax sama
    # sekali). Hitung rata-rata probabilitas "bukan hoax" (1 - hoax_probability)
    # HANYA dari kalimat berlabel not_hoax. Jika not_hoax_sents kosong (kasus
    # tak terduga karena seharusnya sudah tertangani cabang di atas), pakai nilai
    # netral 0.5 sebagai fallback aman agar tidak terjadi pembagian dengan nol.
    p_fakta_doc = float(
        sum(1.0 - s.hoax_probability for s in not_hoax_sents) / not_hoax_count
    ) if not_hoax_sents else 0.5
    return "not_hoax", mean_p_hoax, p_fakta_doc


# ==== Endpoint root: menampilkan info & konfigurasi API yang sedang berjalan ====
@app.get("/")
def read_root():
    return {
        "message": "Indo Hoax Detector API is running.",
        "version": "3.3.2",
        "model_id": MODEL_ID,
        "id2label": ID2LABEL,
        "threshold_optimal": _THRESHOLD_OPTIMAL,
        "thresh_high": THRESH_HIGH,
        "thresh_kalimat_pendek": THRESH_KALIMAT_PENDEK,
        "min_kata_kalimat": MIN_KATA_KALIMAT,
        "device": str(DEVICE),
        "bertopic_ready": _bertopic_ready,
        "bertopic_embed_model": BERTOPIC_EMBED_MODEL_ID,
        "topic_model": "bertopic+rule-based",
        "kategori": [nama for nama, _ in PETA_KATEGORI],
    }


# ==== Endpoint health check: memastikan API & status BERTopic siap diakses ====
@app.get("/health")
def health_check():
    return {"status": "ok", "bertopic_ready": _bertopic_ready}


# ==== Endpoint prediksi hoaks untuk satu teks tunggal ====
@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    original_text = request.text
    prob_list = _predict_proba([original_text], batch_size=1)
    if not prob_list:
        return PredictResponse(
            label="unknown", score=0.0, confidence=0.0, probabilities={},
            hoax_probability=0.0, risk_level="low",
            risk_explanation="Teks kosong.",
        )
    response = _build_predict_response(prob_list[0], original_text=str(original_text))
    _maybe_log({"route": "/predict", "label": response.label, "p_hoax": response.hoax_probability})
    return response


# ==== Endpoint prediksi hoaks untuk beberapa teks sekaligus (batch) ====
@app.post("/predict-batch", response_model=BatchPredictResponse)
def predict_batch(request: BatchPredictRequest):
    texts     = request.texts or []
    prob_list = _predict_proba(texts, batch_size=PREDICT_BATCH_SIZE)
    results   = [
        _build_predict_response(pd, original_text=str(t))
        for t, pd in zip(texts, prob_list)
    ]
    return BatchPredictResponse(results=results)


# ==== Endpoint analisis dokumen lengkap: segmentasi kalimat, klasifikasi per kalimat,
# agregasi verdict dokumen, dan ekstraksi topik per paragraf ====
@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    original_text = _normalize_unit_text(request.text)

    base_meta = AnalyzeMeta(
        model_id=MODEL_ID, max_length=MAX_LENGTH,
        sentence_batch_size=SENTENCE_BATCH_SIZE,
        threshold_used=_THRESHOLD_OPTIMAL,
        topic_model_used="bertopic+rules",
    )

    if not original_text:
        return AnalyzeResponse(
            document=DocumentAnalysis(
                label="not_hoax", hoax_probability=0.0, confidence=0.0,
                risk_level="low", risk_explanation="Teks kosong.",
                sentence_aggregate_label="not_hoax",
                summary=DocumentSummary(
                    paragraph_count=0, sentence_count=0,
                    hoax_sentence_count=0, not_hoax_sentence_count=0,
                ),
            ),
            paragraphs=[], shared_topics=[], topics_global=None, meta=base_meta,
        )

    paragraph_texts = _split_paragraphs(original_text)
    sentence_texts: List[str] = []
    sentence_map:   List[Tuple[int, int]] = []
    for p_idx, paragraph in enumerate(paragraph_texts):
        for s_idx, sentence in enumerate(_split_sentences(paragraph)):
            sentence_texts.append(sentence)
            sentence_map.append((p_idx, s_idx))

    sentence_prob_list = _predict_proba(sentence_texts, batch_size=SENTENCE_BATCH_SIZE)

    paragraph_sentences: List[List[SentenceAnalysis]] = [[] for _ in paragraph_texts]
    for (p_idx, s_idx), sent_text, sent_prob_dict in zip(
        sentence_map, sentence_texts, sentence_prob_list
    ):
        p_hoax     = _extract_hoax_probability(sent_prob_dict)
        p_not_hoax = _extract_not_hoax_probability(sent_prob_dict, p_hoax)
        sent_label = _to_canonical_label(p_hoax, teks=sent_text)
        sent_conf  = max(p_hoax, p_not_hoax)
        paragraph_sentences[p_idx].append(SentenceAnalysis(
            sentence_index=int(s_idx),
            text=sent_text,
            label=sent_label,
            probabilities={"not_hoax": _round6(p_not_hoax), "hoax": _round6(p_hoax)},
            hoax_probability=_round6(p_hoax),
            confidence=_round6(sent_conf),
            color=_sentence_color(sent_label, sent_conf),
        ))

    all_sentences_flat = [s for plist in paragraph_sentences for s in plist]
    hoax_sentence_count     = sum(1 for s in all_sentences_flat if s.label == "hoax")
    not_hoax_sentence_count = sum(1 for s in all_sentences_flat if s.label == "not_hoax")

    doc_label, p_hoax_doc, doc_conf = _aggregate_verdict(all_sentences_flat)
    sentence_aggregate_label = doc_label

    risk_level, risk_explanation = analyze_risk(p_hoax_doc, original_text=original_text)

    per_paragraph_topics = _infer_topic_per_paragraf(paragraph_texts)

    label_counts: Counter = Counter(t.label for t in per_paragraph_topics)
    most_common_label = label_counts.most_common(1)[0][0] if label_counts else None
    topics_global = next(
        (t for t in per_paragraph_topics if t.label == most_common_label),
        _FALLBACK_TOPIC,
    )

    paragraphs: List[ParagraphAnalysis] = []
    for p_idx, p_text in enumerate(paragraph_texts):
        sents  = sorted(paragraph_sentences[p_idx], key=lambda x: x.sentence_index)
        n_hoax = sum(1 for s in sents if s.label == "hoax")
        n_not  = sum(1 for s in sents if s.label == "not_hoax")

        if sents:
            p_max_hoax = max(s.hoax_probability for s in sents)
            p_label    = "hoax" if n_hoax >= n_not and n_hoax > 0 else "not_hoax"
            p_conf     = p_max_hoax if p_label == "hoax" else (1.0 - p_max_hoax)
        else:
            p_max_hoax = 0.0
            p_label    = "not_hoax"
            p_conf     = 0.0

        topic_info = (
            per_paragraph_topics[p_idx]
            if p_idx < len(per_paragraph_topics)
            else _FALLBACK_TOPIC
        )
        paragraphs.append(ParagraphAnalysis(
            paragraph_index=int(p_idx),
            text=p_text,
            label=p_label,
            hoax_probability=_round6(p_max_hoax),
            confidence=_round6(p_conf),
            topic=topic_info,
            sentences=sents,
        ))

    shared_topic_map: Dict[str, List[int]] = defaultdict(list)
    for p in paragraphs:
        shared_topic_map[p.topic.label].append(int(p.paragraph_index))
    shared_topics = sorted(
        [SharedTopic(label=lbl, paragraph_indices=idxs)
         for lbl, idxs in shared_topic_map.items() if len(idxs) > 1],
        key=lambda x: (x.paragraph_indices[0], x.label),
    )

    _maybe_log({
        "route": "/analyze",
        "doc_label": doc_label,
        "doc_p_hoax": p_hoax_doc,
        "hoax_sentence_count": hoax_sentence_count,
        "paragraph_count": len(paragraphs),
    })

    return AnalyzeResponse(
        document=DocumentAnalysis(
            label=doc_label,
            hoax_probability=_round6(p_hoax_doc),
            confidence=_round6(doc_conf),
            risk_level=risk_level,
            risk_explanation=risk_explanation,
            sentence_aggregate_label=sentence_aggregate_label,
            summary=DocumentSummary(
                paragraph_count=len(paragraphs),
                sentence_count=hoax_sentence_count + not_hoax_sentence_count,
                hoax_sentence_count=hoax_sentence_count,
                not_hoax_sentence_count=not_hoax_sentence_count,
            ),
        ),
        paragraphs=paragraphs,
        shared_topics=shared_topics,
        topics_global=topics_global,
        meta=base_meta,
    )


# ==== Entry point: menjalankan server Uvicorn saat file dieksekusi langsung ====
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
