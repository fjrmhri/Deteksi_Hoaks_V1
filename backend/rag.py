"""
Evidence Retrieval (RAG) dari database cek-fakta Mafindo lewat API resmi.
Tidak mengubah bobot IndoBERT/BERTopic -- lapisan tambahan di runtime backend.

Spesifikasi API Mafindo Antihoax (v2)
──────────────────────────────────────
Base URL : https://yudistira.turnbackhoax.id/api
Method   : POST (semua endpoint, tanpa exception)
Auth     : field `key` di request body (application/x-www-form-urlencoded)
           -- BUKAN header Authorization: Bearer
Status   : "1" = fakta (truth), "2" = hoaks (fake)
           -- BUKAN string teks seperti "hoaks"/"fakta"

Endpoint yang dipakai:
  POST /antihoax/latest   – artikel terbaru (hanya perlu `key`, tanpa pagination)
  POST /antihoax/         – daftar artikel dengan `limit` & `offset` (bulk fetch awal)
"""

import html
import json
import os
import re
import shutil
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import requests


RAG_ENABLED         = os.getenv("RAG_ENABLED", "0") == "1"
RAG_DATA_DIR        = os.getenv(
    "RAG_DATA_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "rag_data"),
)
FETCH_INTERVAL_SEC  = int(os.getenv("RAG_FETCH_INTERVAL_SEC", str(6 * 3600)))
FETCH_MAX_PAGES     = int(os.getenv("RAG_FETCH_MAX_PAGES", "5"))
REQUEST_TIMEOUT     = float(os.getenv("RAG_REQUEST_TIMEOUT", "15"))
REQUEST_DELAY_SEC   = float(os.getenv("RAG_REQUEST_DELAY_SEC", "1.0"))
RAG_TOP_K           = int(os.getenv("RAG_TOP_K", "3"))
RAG_SIM_THRESHOLD   = float(os.getenv("RAG_SIM_THRESHOLD", "0.55"))
# Jumlah kandidat teratas yang diperiksa sebelum deduplikasi salinan sindikasi.
# Index berisi banyak entri untuk cerita yang sama (id & url berbeda), jadi pool
# harus lebih besar dari RAG_TOP_K agar top-k berisi cerita yang berbeda.
RAG_DEDUP_POOL      = int(os.getenv("RAG_DEDUP_POOL", "30"))
# Bersihkan HTML pada index lama sekali saat startup (hasil disimpan & dibackup).
RAG_AUTO_BERSIH     = os.getenv("RAG_AUTO_BERSIH", "1") == "1"
# Jumlah artikel minimum yang harus ada di index sebelum beralih ke mode
# "update saja" (/antihoax/latest). Selama n_articles < nilai ini,
# _update_once selalu menjalankan bulk fetch /antihoax/ (dengan pagination)
# agar index terisi dulu hingga jumlah yang memadai.
# Default 0 = mode lama (bulk hanya saat index benar-benar kosong).
RAG_MIN_ARTICLES    = int(os.getenv("RAG_MIN_ARTICLES", "0"))
# Mode persistensi index RAG: "local" (default, hanya file lokal di RAG_DATA_DIR)
# atau "hf_dataset" (backup/restore tambahan ke Hugging Face Hub Dataset repo).
RAG_PERSIST_MODE     = os.getenv("RAG_PERSIST_MODE", "local")
RAG_HF_DATASET_REPO  = os.getenv("RAG_HF_DATASET_REPO", "")

USER_AGENT = os.getenv(
    "RAG_USER_AGENT",
    "IndoHoaxDetector-EvidenceBot/1.0 (+kontak: isi-email-anda@domain.com)",
)

# ── Konfigurasi API Mafindo Antihoax (v2) ──────────────────────────────────
#
# ✅ Base URL yang benar  : https://yudistira.turnbackhoax.id/api
# ❌ URL lama yang salah  : https://api.mafindo.or.id  (domain tidak ada)
#
# ✅ Autentikasi yang benar: field `key` di body POST (form-urlencoded)
# ❌ Auth lama yang salah  : header "Authorization: Bearer ..."
#
# ✅ Field status yang benar: "1" = fakta, "2" = hoaks (nilai numerik-string)
# ❌ Field lama yang salah  : "hoaks"/"fakta" sebagai teks, atau "verdict"
#
# ✅ Field tanggal yang benar: "tanggal" (format YYYY-MM-DD)
# ❌ Field lama yang salah  : "date" / "published_at" / "created_at"
#
# ✅ Field URL yang benar: "references" (URL artikel cek-fakta di pemeriksa fakta)
# ❌ Field lama yang salah: "url" / "link" (tidak ada di API Mafindo)
#
# ✅ Field teks yang benar: "content" + "fact" (narasi hoaks + klarifikasi fakta)
# ❌ Field lama yang salah: "excerpt" / "summary" (tidak ada di API Mafindo)
#
# /antihoax/latest  : hanya perlu `key`, TIDAK mendukung pagination (page/limit)
# /antihoax/        : mendukung `limit` dan `offset` untuk bulk fetch
MAFINDO_BASE_URL    = os.getenv("MAFINDO_BASE_URL", "https://yudistira.turnbackhoax.id/api").rstrip("/")
MAFINDO_LATEST_PATH = os.getenv("MAFINDO_LATEST_PATH", "/antihoax/latest")
MAFINDO_LIST_PATH   = os.getenv("MAFINDO_LIST_PATH",   "/antihoax/")
MAFINDO_API_KEY     = os.getenv("MAFINDO_API_KEY", "")
MAFINDO_PAGE_SIZE   = int(os.getenv("MAFINDO_PAGE_SIZE", "20"))


_rag_ready: bool = False
_last_fetch_ok: Optional[bool] = None
_last_fetch_error: Optional[str] = None
_last_backup_ok: Optional[bool] = None


# Pemetaan nilai field "status" dari API Mafindo ke label internal.
# Nilai numerik ("1"/"2") adalah nilai resmi dari dokumentasi API v2.
# Nilai teks dipertahankan sebagai fallback toleransi antar versi.
# PERHATIAN: _verdict_from_mafindo_status() menangani "1"/"2" SEBELUM
# masuk ke dict ini, karena normalisasi re.sub akan menghapus digit.
_MAFINDO_STATUS_MAP: Dict[str, str] = {
    # Teks (fallback toleransi)
    "hoaks": "hoax", "hoax": "hoax",     "salah": "hoax",
    "disinformasi": "hoax", "misinformasi": "hoax", "penipuan": "hoax",
    "fitnah": "hoax", "manipulasi": "hoax", "palsu": "hoax", "false": "hoax",
    "fakta": "fakta", "benar": "fakta",  "klarifikasi": "fakta",
    "valid": "fakta", "true": "fakta",
}


class _EvidenceStore:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.embeddings: Optional[np.ndarray] = None
        self.metadata: List[Dict[str, Any]] = []
        self.seen_ids: set = set()
        self.last_updated: Optional[str] = None
        self.lock = threading.RLock()

    @property
    def _emb_path(self) -> str:
        return os.path.join(self.data_dir, "tbh_embeddings.npy")

    @property
    def _meta_path(self) -> str:
        return os.path.join(self.data_dir, "tbh_metadata.json")

    def load(self) -> None:
        with self.lock:
            os.makedirs(self.data_dir, exist_ok=True)
            if not (os.path.exists(self._emb_path) and os.path.exists(self._meta_path)):
                if RAG_PERSIST_MODE == "hf_dataset":
                    self._restore_from_hf_dataset()
            if not (os.path.exists(self._emb_path) and os.path.exists(self._meta_path)):
                return
            try:
                self.embeddings = np.load(self._emb_path)
                with open(self._meta_path, encoding="utf-8") as f:
                    payload = json.load(f)
                self.metadata = payload.get("articles", [])
                self.last_updated = payload.get("last_updated")
                self.seen_ids = {m["id"] for m in self.metadata if "id" in m}
                print(f"[INFO][RAG] Memuat index lokal: {len(self.metadata)} artikel")
            except Exception as e:
                print(f"[WARN][RAG] Gagal memuat index lokal: {e}")
                self.embeddings = None
                self.metadata = []
                self.seen_ids = set()

    def save(self) -> None:
        with self.lock:
            os.makedirs(self.data_dir, exist_ok=True)
            tmp_emb  = os.path.join(self.data_dir, "tbh_embeddings.tmp.npy")
            tmp_meta = self._meta_path + ".tmp"
            np.save(tmp_emb, self.embeddings)
            with open(tmp_meta, "w", encoding="utf-8") as f:
                json.dump(
                    {"last_updated": self.last_updated, "articles": self.metadata},
                    f, ensure_ascii=False,
                )
            os.replace(tmp_emb, self._emb_path)
            os.replace(tmp_meta, self._meta_path)

            if RAG_PERSIST_MODE == "hf_dataset":
                self._backup_to_hf_dataset()

    def _restore_from_hf_dataset(self) -> None:
        # Dipanggil dari load() saat file lokal belum ada -- coba tarik dulu dari
        # dataset repo (mis. setelah Space di-restart & storage lokal kosong).
        # Kegagalan di sini TIDAK fatal: pemanggil akan lanjut mulai dari index kosong.
        if not RAG_HF_DATASET_REPO:
            return
        try:
            from huggingface_hub import hf_hub_download
            token = os.getenv("HF_TOKEN")
            emb_src  = hf_hub_download(
                repo_id=RAG_HF_DATASET_REPO, filename="tbh_embeddings.npy",
                repo_type="dataset", token=token,
            )
            meta_src = hf_hub_download(
                repo_id=RAG_HF_DATASET_REPO, filename="tbh_metadata.json",
                repo_type="dataset", token=token,
            )
            shutil.copyfile(emb_src, self._emb_path)
            shutil.copyfile(meta_src, self._meta_path)
            print(f"[INFO][RAG] Index dipulihkan dari HF dataset: {RAG_HF_DATASET_REPO}")
        except Exception as e:
            print(f"[WARN][RAG] Gagal memulihkan index dari HF dataset (mulai kosong): {e}")

    def _backup_to_hf_dataset(self) -> None:
        # Dipanggil dari save() setelah tulis atomik lokal berhasil. Kegagalan
        # upload hanya di-log -- tidak mengganggu alur save() lokal.
        global _last_backup_ok
        if not RAG_HF_DATASET_REPO:
            print("[WARN][RAG] RAG_HF_DATASET_REPO belum diset, backup dilewati.")
            _last_backup_ok = False
            return
        try:
            from huggingface_hub import HfApi
            api = HfApi(token=os.getenv("HF_TOKEN"))
            api.upload_file(
                path_or_fileobj=self._emb_path,
                path_in_repo="tbh_embeddings.npy",
                repo_id=RAG_HF_DATASET_REPO,
                repo_type="dataset",
            )
            api.upload_file(
                path_or_fileobj=self._meta_path,
                path_in_repo="tbh_metadata.json",
                repo_id=RAG_HF_DATASET_REPO,
                repo_type="dataset",
            )
            _last_backup_ok = True
        except Exception as e:
            print(f"[WARN][RAG] Backup index ke HF dataset gagal: {e}")
            _last_backup_ok = False

    def add_articles(self, articles: List[Dict[str, Any]], embeddings: np.ndarray) -> int:
        with self.lock:
            if not articles:
                return 0
            new_articles, new_vecs = [], []
            for art, vec in zip(articles, embeddings):
                if art["id"] in self.seen_ids:
                    continue
                self.seen_ids.add(art["id"])
                new_articles.append(art)
                new_vecs.append(vec)
            if not new_articles:
                return 0
            new_vecs = np.asarray(new_vecs, dtype="float32")
            self.embeddings = (
                new_vecs if self.embeddings is None
                else np.vstack([self.embeddings, new_vecs])
            )
            self.metadata.extend(new_articles)
            self.last_updated = time.strftime("%Y-%m-%dT%H:%M:%S")
            self.save()
            return len(new_articles)


_store = _EvidenceStore(RAG_DATA_DIR)


def _verdict_from_mafindo_status(status: str) -> str:
    """Terjemahkan nilai field 'status' dari API Mafindo ke label internal.

    Dokumentasi API v2 resmi:
      "1" → fakta (truth)
      "2" → hoaks (fake)

    Nilai teks (mis. "fakta", "hoaks") ditoleransi sebagai fallback kompatibilitas
    antar versi API. PENTING: pengecekan nilai numerik dilakukan SEBELUM normalisasi
    re.sub (yang akan menghapus digit), sehingga "1"/"2" tidak pernah di-strip.
    """
    raw = str(status).strip()
    # ① Nilai numerik -- standar dokumentasi resmi API Mafindo v2
    if raw == "1":
        return "fakta"
    if raw == "2":
        return "hoax"
    # ② Nilai teks -- normalisasi ke huruf kecil, buang non-alfa, cari di map
    key = re.sub(r"[^a-z]+", "", raw.lower())
    return _MAFINDO_STATUS_MAP.get(key, "tidak diketahui")


def _parse_mafindo_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parsing satu item respons API Mafindo ke format internal evidence store.

    Mapping field API Mafindo v2 → field internal:
      id          → id         (wajib ada)
      title       → title      (wajib ada)
      references  → url        (URL artikel cek-fakta; bukan source_link=URL hoaks asli)
      content     → excerpt    (digabung dengan fact untuk embedding lebih kaya konteks)
      fact        → (digabung ke excerpt)
      status      → verdict    ("1"=fakta, "2"=hoaks)
      tanggal     → date       (format YYYY-MM-DD; bukan "date"/"published_at")
    """
    article_id = item.get("id")
    title      = html.unescape(str(item.get("title") or "").strip())
    if not article_id or not title:
        return None

    # `references` = daftar tautan rujukan (satu per baris, bisa berisi banyak tautan).
    # Pada index terbaru, tautan pertama sering menunjuk ke sumber unggahan (Facebook,
    # Instagram, dll.), bukan selalu artikel cek-fakta. Disimpan apa adanya (kompatibel
    # dengan index lama); satu tautan bersih dipilih saat keluaran lewat _bersihkan_url.
    url = str(item.get("references") or "").strip()
    if not url:
        # Fallback ke source_link bila references kosong (kasus tidak umum)
        url = str(item.get("source_link") or "").strip()

    # Gabungkan content + fact untuk teks embedding yang kaya konteks (HTML sudah
    # dibuang lewat _bersihkan_html, supaya embedding tidak didominasi markup):
    # `content` = narasi/klaim hoaks yang beredar di masyarakat
    # `fact`    = klarifikasi/penjelasan fakta dari pemeriksa fakta
    content = _bersihkan_html(item.get("content"))
    fact    = _bersihkan_html(item.get("fact"))
    excerpt = f"{content} {fact}".strip()

    # `status` di API Mafindo v2: "1" = fakta, "2" = hoaks
    # (bukan "verdict", bukan teks "hoaks"/"fakta")
    status   = str(item.get("status") or "").strip()
    # `tanggal` di API Mafindo v2: format "YYYY-MM-DD"
    # (bukan "date", "published_at", atau "created_at")
    date_raw = item.get("tanggal") or item.get("date") or ""
    date_iso = str(date_raw)[:10]

    return {
        "id":      f"mafindo-{article_id}",
        "title":   title,
        "excerpt": excerpt[:300],
        "url":     url,
        "date":    date_iso,
        "verdict": _verdict_from_mafindo_status(status),
    }


def _build_post_headers() -> Dict[str, str]:
    """Header HTTP standar untuk semua request POST ke API Mafindo."""
    return {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
    }


def _fetch_latest_articles() -> Optional[List[Dict[str, Any]]]:
    """Ambil artikel terbaru via POST /antihoax/latest.

    Endpoint ini HANYA membutuhkan parameter `key` di body (form-urlencoded).
    Tidak mendukung pagination -- cukup satu request, tidak ada `page`/`limit`.
    Mengembalikan None bila error, atau list (mungkin kosong) bila berhasil.
    """
    global _last_fetch_error

    if not MAFINDO_API_KEY:
        _last_fetch_error = "MAFINDO_API_KEY belum diset di environment"
        print("[WARN][RAG] MAFINDO_API_KEY kosong, fetch /antihoax/latest dilewati.")
        return None

    try:
        resp = requests.post(
            f"{MAFINDO_BASE_URL}{MAFINDO_LATEST_PATH}",
            data={"key": MAFINDO_API_KEY},   # ✅ autentikasi di body, BUKAN header
            headers=_build_post_headers(),
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code != 200:
            _last_fetch_error = f"Status HTTP {resp.status_code} dari /antihoax/latest"
            print(f"[WARN][RAG] /antihoax/latest mengembalikan status {resp.status_code}.")
            return None

        payload   = resp.json()
        # Toleransi 2 bentuk payload: list langsung, atau dibungkus {"data": [...]}
        raw_items = payload if isinstance(payload, list) else payload.get("data", [])
        articles  = [a for a in (_parse_mafindo_item(it) for it in raw_items) if a]

        _last_fetch_error = None
        dedup: Dict[str, Dict[str, Any]] = {a["id"]: a for a in articles}
        return list(dedup.values())

    except Exception as e:
        _last_fetch_error = str(e)
        print(f"[WARN][RAG] Fetch /antihoax/latest gagal: {e}")
        return None


def _fetch_bulk_articles() -> Optional[List[Dict[str, Any]]]:
    """Ambil artikel dalam jumlah besar via POST /antihoax/ dengan offset pagination.

    Dipakai saat index masih kosong untuk membangun index awal yang komprehensif.
    Endpoint /antihoax/ mendukung `limit` dan `offset` (bukan `page`).
    Mengembalikan None bila error fatal, atau list (mungkin kosong) bila berhasil.
    """
    global _last_fetch_error

    if not MAFINDO_API_KEY:
        _last_fetch_error = "MAFINDO_API_KEY belum diset di environment"
        return None

    all_articles: List[Dict[str, Any]] = []

    try:
        for page in range(FETCH_MAX_PAGES):
            offset = page * MAFINDO_PAGE_SIZE
            resp = requests.post(
                f"{MAFINDO_BASE_URL}{MAFINDO_LIST_PATH}",
                data={
                    "key":    MAFINDO_API_KEY,   # ✅ autentikasi di body, BUKAN header
                    "limit":  MAFINDO_PAGE_SIZE,
                    "offset": offset,            # ✅ pakai offset, bukan `page`
                },
                headers=_build_post_headers(),
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code != 200:
                print(
                    f"[WARN][RAG] Bulk fetch status {resp.status_code} "
                    f"di offset {offset}, berhenti."
                )
                break

            payload       = resp.json()
            raw_items     = payload if isinstance(payload, list) else payload.get("data", [])
            page_articles = [a for a in (_parse_mafindo_item(it) for it in raw_items) if a]

            if not page_articles:
                print(f"[INFO][RAG] 0 artikel di offset {offset}, bulk fetch selesai.")
                break

            reached_known = any(a["id"] in _store.seen_ids for a in page_articles)
            all_articles.extend(a for a in page_articles if a["id"] not in _store.seen_ids)

            if reached_known:
                break
            time.sleep(REQUEST_DELAY_SEC)

        _last_fetch_error = None
    except Exception as e:
        _last_fetch_error = str(e)
        print(f"[WARN][RAG] Bulk fetch /antihoax/ gagal: {e}")
        return None

    dedup: Dict[str, Dict[str, Any]] = {a["id"]: a for a in all_articles}
    return list(dedup.values())


def _update_once(embed_fn: Callable[[List[str]], np.ndarray]) -> None:
    global _last_fetch_ok

    # Strategi dua-tahap:
    # • Index belum memenuhi RAG_MIN_ARTICLES → bulk fetch /antihoax/ (dengan
    #   offset pagination) untuk membangun/melengkapi index awal.
    # • Index sudah cukup → fetch /antihoax/latest (tambah artikel baru, efisien).
    n_current = len(_store.metadata)
    need_bulk = (n_current == 0) or (RAG_MIN_ARTICLES > 0 and n_current < RAG_MIN_ARTICLES)
    if need_bulk:
        print(
            f"[INFO][RAG] Index saat ini {n_current} artikel "
            f"(minimum: {RAG_MIN_ARTICLES}), memulai bulk fetch..."
        )
        articles = _fetch_bulk_articles()
    else:
        articles = _fetch_latest_articles()

    if articles is None:
        _last_fetch_ok = False
        return

    _last_fetch_ok = True
    if not articles:
        print("[INFO][RAG] Tidak ada artikel baru.")
        return

    texts      = [f"{a['title']}. {a['excerpt']}".strip() for a in articles]
    embeddings = embed_fn(texts)
    added      = _store.add_articles(articles, embeddings)
    print(f"[INFO][RAG] {added} artikel baru ditambahkan (total: {len(_store.metadata)}).")


def start_rag_background_update(
    embed_fn: Callable[[List[str]], np.ndarray],
    interval_sec: Optional[int] = None,
) -> None:
    if not RAG_ENABLED:
        print("[INFO][RAG] RAG_ENABLED=0, dinonaktifkan.")
        return

    interval_sec = interval_sec or FETCH_INTERVAL_SEC

    def _loop():
        global _rag_ready
        _store.load()
        _rag_ready = True
        if RAG_AUTO_BERSIH:
            _bersihkan_index_otomatis(embed_fn)
        while True:
            try:
                _update_once(embed_fn)
            except Exception as e:
                print(f"[WARN][RAG] Kegagalan tak terduga: {e}")
            time.sleep(interval_sec)

    threading.Thread(target=_loop, daemon=True, name="rag-updater").start()


_PREFIKS_JUDUL_RE = re.compile(
    r"^\s*(\[[^\]]+\]|(cek\s*fakta|hoaks|hoax|keliru|salah|tidak\s*benar|sebagian\s*salah|"
    r"misinformasi|disinformasi|fakta|belum\s*terbukti)\s*[,:\-!]+|"
    r"(hoaks|hoax|keliru|tidak\s*benar|misinformasi|disinformasi)\s+)\s*",
    re.IGNORECASE,
)
_URL_HTTP_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


def _kunci_cerita(judul: str) -> str:
    """Judul tanpa label ([SALAH], "Cek Fakta: Hoaks", Keliru, ...), tanda baca, dan
    spasi di "Rp 500" -> "rp500", huruf kecil. Dipakai mengenali salinan sindikasi
    cerita yang sama (id & url berbeda)."""
    j = str(judul or "")
    for _ in range(3):  # label bisa bertumpuk: "Cek Fakta: Hoaks ..."
        j2 = _PREFIKS_JUDUL_RE.sub("", j, count=1)
        if j2 == j:
            break
        j = j2
    j = j.lower()
    j = re.sub(r"\brp\.?\s*(?=\d)", "rp", j)
    j = re.sub(r"[^\w\s]", " ", j)
    return re.sub(r"\s+", " ", j).strip()


def _bersihkan_url(raw: Any) -> str:
    """Ambil SATU tautan http/https pertama dari field `references` (multi-baris,
    bisa memuat entitas HTML seperti &amp;). String kosong bila tidak ada tautan
    valid. Skema selain http/https (mis. javascript:) tidak pernah lolos."""
    m = _URL_HTTP_RE.search(html.unescape(str(raw or "")))
    return m.group(0).rstrip(".,;") if m else ""


_BLOK_HTML_RE = re.compile(r"<(script|style)\b.*?</\1\s*>", re.IGNORECASE | re.DOTALL)
_TAG_HTML_RE  = re.compile(r"<[^>]*>")
_TAG_SISA_RE  = re.compile(r"<[^>]*$")


def _bersihkan_html(teks: Any) -> str:
    """Ubah konten HTML dari API menjadi teks biasa: buang blok script/style dan
    tag (termasuk tag yang terpotong di akhir string), dekode entitas (&amp;,
    &nbsp;, ...), rapikan spasi. Tanpa ini, embedding didominasi markup."""
    t = str(teks or "")
    for _ in range(2):  # dua putaran: menangani entitas ganda seperti &lt;p&gt;
        t = _BLOK_HTML_RE.sub(" ", t)
        t = _TAG_HTML_RE.sub(" ", t)
        t = _TAG_SISA_RE.sub(" ", t)
        t = html.unescape(t)
    return re.sub(r"\s+", " ", t).strip()


def bangun_ulang_index_bersih(
    metadata: List[Dict[str, Any]],
    embed_fn: Callable[[List[str]], np.ndarray],
) -> Tuple[List[Dict[str, Any]], np.ndarray, Dict[str, int]]:
    """Bersihkan HTML pada excerpt index yang sudah ada lalu hitung ulang SEMUA
    embedding. Keterbatasan: excerpt lama sudah terpotong 300 karakter, jadi entri
    yang awalnya dipenuhi markup menyisakan sedikit teks (embedding condong ke
    judul). Perbaikan penuh butuh pengambilan ulang konten dari API."""
    baru: List[Dict[str, Any]] = []
    n_berubah = n_pendek = 0
    for m in metadata:
        mm = dict(m)
        lama = str(m.get("excerpt", ""))
        ex = _bersihkan_html(lama)[:300]
        n_berubah += int(ex != lama)
        n_pendek += int(len(ex) < 30)
        mm["excerpt"] = ex
        baru.append(mm)
    texts = [f"{a.get('title', '')}. {a['excerpt']}".strip() for a in baru]
    emb = np.asarray(embed_fn(texts), dtype="float32")
    return baru, emb, {"n_excerpt_berubah": n_berubah, "n_excerpt_pendek": n_pendek}


_HTML_SISA_RE = re.compile(r"<[^>]*>|&(?:[a-zA-Z]{2,8}|#\d{1,6});")


def _bersihkan_index_otomatis(
    embed_fn: Callable[[List[str]], np.ndarray],
    percobaan: int = 20,
    jeda_sec: float = 30.0,
) -> bool:
    """Bersihkan excerpt ber-HTML pada index yang dimuat, hitung ulang embedding,
    lalu simpan (save() juga membackup ke HF dataset). Tidak melakukan apa pun bila
    index sudah bersih, sehingga aman dipanggil di setiap startup. Embedder bisa
    belum siap saat startup, jadi dicoba ulang beberapa kali."""
    with _store.lock:
        if _store.embeddings is None or not _store.metadata:
            return False
        snapshot = [dict(m) for m in _store.metadata]
    n_kotor = sum(1 for m in snapshot if _HTML_SISA_RE.search(str(m.get("excerpt", ""))))
    if n_kotor == 0:
        print("[INFO][RAG] Index sudah bersih dari HTML, pembersihan dilewati.")
        return False
    print(f"[INFO][RAG] {n_kotor}/{len(snapshot)} excerpt memuat HTML, membersihkan index...")
    for ke in range(1, percobaan + 1):
        try:
            baru, emb, info = bangun_ulang_index_bersih(snapshot, embed_fn)
            break
        except Exception as e:
            print(f"[WARN][RAG] Pembersihan index tertunda ({ke}/{percobaan}): {e}")
            time.sleep(jeda_sec)
    else:
        print("[WARN][RAG] Pembersihan index dibatalkan, index lama tetap dipakai.")
        return False
    with _store.lock:
        # Updater adalah satu-satunya penulis dan belum berjalan, tetapi tetap
        # diperiksa agar tidak menimpa index yang jumlahnya berubah.
        if len(_store.metadata) != len(baru) or emb.shape[0] != len(baru):
            print("[WARN][RAG] Ukuran index berubah/tidak cocok, pembersihan dibatalkan.")
            return False
        _store.metadata = baru
        _store.embeddings = emb
        _store.last_updated = time.strftime("%Y-%m-%dT%H:%M:%S")
        _store.save()
    print(f"[INFO][RAG] Index dibersihkan: {info}")
    return True


def retrieve_evidence(
    query_text: str,
    embed_fn: Callable[[List[str]], np.ndarray],
    top_k: Optional[int] = None,
    threshold: Optional[float] = None,
) -> List[Dict[str, Any]]:
    if not RAG_ENABLED or not _rag_ready or not query_text:
        return []
    top_k     = top_k or RAG_TOP_K
    threshold = RAG_SIM_THRESHOLD if threshold is None else threshold

    with _store.lock:
        if _store.embeddings is None or not _store.metadata:
            return []
        try:
            q_emb = embed_fn([query_text])[0]
        except Exception as e:
            print(f"[WARN][RAG] Gagal encode query: {e}")
            return []

        sims = _store.embeddings @ np.asarray(q_emb, dtype="float32")
        n    = min(int(sims.shape[0]), len(_store.metadata))
        pool = min(n, max(top_k * 10, RAG_DEDUP_POOL))
        if pool < n:
            kandidat = np.argpartition(-sims[:n], pool - 1)[:pool]
            kandidat = kandidat[np.argsort(-sims[kandidat])]
        else:
            kandidat = np.argsort(-sims[:n])

        # Urut similarity menurun. Salinan sindikasi cerita yang sama dilewati
        # (yang tertinggi dipertahankan) sehingga top-k berisi cerita berbeda.
        # Item pertama dan similarity-nya tidak berubah, jadi aturan override
        # RAG (_reconcile_verdict_with_rag) tidak terpengaruh.
        results: List[Dict[str, Any]] = []
        terlihat: Dict[str, int] = {}
        for i in kandidat:
            score = float(sims[i])
            if score < threshold:
                break
            meta  = _store.metadata[int(i)]
            kunci = _kunci_cerita(meta.get("title", ""))
            url   = _bersihkan_url(meta.get("url", ""))
            if kunci and kunci in terlihat:
                wakil = results[terlihat[kunci]]
                if not wakil["url"] and url:
                    wakil["url"] = url
                continue
            if kunci:
                terlihat[kunci] = len(results)
            results.append({
                "title":      meta.get("title", ""),
                "url":        url,
                "verdict":    meta.get("verdict", "tidak diketahui"),
                "date":       meta.get("date", ""),
                "similarity": round(score, 4),
            })
            if len(results) >= top_k:
                break
        return results


def rag_status() -> Dict[str, Any]:
    return {
        "enabled":          RAG_ENABLED,
        "ready":            _rag_ready,
        "n_articles":       len(_store.metadata),
        "last_updated":     _store.last_updated,
        "last_fetch_ok":    _last_fetch_ok,
        "last_fetch_error": _last_fetch_error,
        "persist_mode":     RAG_PERSIST_MODE,
        "last_backup_ok":   _last_backup_ok,
    }