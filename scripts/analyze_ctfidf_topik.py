from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path


INPUT_PATH = Path("public/hasil/evaluasi_ctfidf_topik.csv")
OUTPUT_PATH = Path("public/hasil/analisis_ctfidf_topik.md")

REQUIRED_COLUMNS = [
    "Topik_ID",
    "Kategori",
    "Nama_Topik",
    "Rank",
    "Kata",
    "Skor_cTFIDF",
    "Keyword_Ditemukan",
    "Coverage",
    "Keyword_Kategori_Lengkap",
]

ARTIFACT_PATTERNS = [
    re.compile(r"\b(html|pdf|facebook|twitter|tweet|youtube|tiktok|reffer)\b", re.IGNORECASE),
    re.compile(r"\b([a-z0-9]+)\s+\1\b", re.IGNORECASE),
]


def parse_coverage(value: str) -> tuple[int, int, float | None]:
    text = (value or "").strip()
    if not text or "/" not in text:
        return 0, 0, None
    left, right = text.split("/", 1)
    try:
        found = int(left)
        total = int(right)
    except ValueError:
        return 0, 0, None
    if total == 0:
        return found, total, None
    return found, total, found / total


def escape_md(value: object) -> str:
    text = "" if value is None else str(value)
    return text.replace("\\", "\\\\").replace("|", "\\|").replace("\n", "<br>")


def fmt_float(value: float) -> str:
    return f"{value:.6f}"


def fmt_pct(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.2f}%"


def topic_sort_key(topic_id: str) -> tuple[int, str]:
    try:
        return int(topic_id), topic_id
    except ValueError:
        return 10**9, topic_id


def is_artifact_like(word: str) -> bool:
    text = word.strip().lower()
    return any(pattern.search(text) for pattern in ARTIFACT_PATTERNS)


def status_label(topic_freq: int, category_freq: int, artifact_like: bool) -> str:
    if topic_freq == 1:
        label = "eksklusif_topik"
    elif category_freq == 1:
        label = "khas_kategori"
    else:
        label = f"shared_{topic_freq}_topik"
    if artifact_like:
        label += "; format/noise?"
    return label


def read_rows() -> tuple[list[str], list[dict[str, object]]]:
    with INPUT_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        missing = [column for column in REQUIRED_COLUMNS if column not in columns]
        if missing:
            missing_text = ", ".join(missing)
            raise SystemExit(f"Kolom wajib tidak ditemukan: {missing_text}")

        rows: list[dict[str, object]] = []
        for raw in reader:
            word = (raw["Kata"] or "").strip()
            found, total, ratio = parse_coverage(raw["Coverage"] or "")
            row = dict(raw)
            row["_rank"] = int(raw["Rank"])
            row["_score"] = float(raw["Skor_cTFIDF"])
            row["_word_norm"] = word.lower()
            row["_coverage_found"] = found
            row["_coverage_total"] = total
            row["_coverage_ratio"] = ratio
            rows.append(row)
    return columns, rows


def build_report(columns: list[str], rows: list[dict[str, object]]) -> str:
    topic_rows: dict[str, list[dict[str, object]]] = defaultdict(list)
    category_topics: dict[str, set[str]] = defaultdict(set)
    word_topic_ids: dict[str, set[str]] = defaultdict(set)
    word_category_ids: dict[str, set[str]] = defaultdict(set)
    word_score_sum: dict[str, float] = defaultdict(float)
    word_display: dict[str, str] = {}
    category_word_stats: dict[str, dict[str, dict[str, object]]] = defaultdict(
        lambda: defaultdict(lambda: {"sum_score": 0.0, "max_score": 0.0, "topic_ids": set()})
    )
    topic_meta: dict[str, dict[str, object]] = {}
    inconsistent_topics: list[str] = []

    for row in rows:
        topic_id = str(row["Topik_ID"])
        category = str(row["Kategori"])
        word_norm = str(row["_word_norm"])
        score = float(row["_score"])

        topic_rows[topic_id].append(row)
        category_topics[category].add(topic_id)
        if word_norm:
            word_topic_ids[word_norm].add(topic_id)
            word_category_ids[word_norm].add(category)
            word_score_sum[word_norm] += score
            word_display.setdefault(word_norm, str(row["Kata"]))
            stats = category_word_stats[category][word_norm]
            stats["sum_score"] = float(stats["sum_score"]) + score
            stats["max_score"] = max(float(stats["max_score"]), score)
            topic_ids = stats["topic_ids"]
            assert isinstance(topic_ids, set)
            topic_ids.add(topic_id)

        if topic_id not in topic_meta:
            topic_meta[topic_id] = {
                "Kategori": category,
                "Nama_Topik": str(row["Nama_Topik"]),
                "Coverage": str(row["Coverage"]),
                "Keyword_Ditemukan": str(row["Keyword_Ditemukan"]),
                "Coverage_Ratio": row["_coverage_ratio"],
            }

    for topic_id, items in topic_rows.items():
        items.sort(key=lambda item: (int(item["_rank"]), -float(item["_score"]), str(item["Kata"])))
        coverages = {str(item["Coverage"]) for item in items}
        keywords = {str(item["Keyword_Ditemukan"]) for item in items}
        if len(coverages) > 1 or len(keywords) > 1:
            inconsistent_topics.append(topic_id)

    sorted_topic_ids = sorted(topic_rows, key=topic_sort_key)
    sorted_categories = sorted(category_topics)

    unique_words = len(word_topic_ids)
    topic_exclusive_words = sum(1 for ids in word_topic_ids.values() if len(ids) == 1)
    category_exclusive_words = sum(1 for ids in word_category_ids.values() if len(ids) == 1)

    topic_summaries: list[dict[str, object]] = []
    for topic_id in sorted_topic_ids:
        meta = topic_meta[topic_id]
        topic_summaries.append(
            {
                "Topik_ID": topic_id,
                "Kategori": meta["Kategori"],
                "Nama_Topik": meta["Nama_Topik"],
                "Coverage": meta["Coverage"],
                "Coverage_Ratio": meta["Coverage_Ratio"],
                "Keyword_Ditemukan": meta["Keyword_Ditemukan"],
                "Jumlah_Baris": len(topic_rows[topic_id]),
            }
        )

    category_summaries: list[dict[str, object]] = []
    for category in sorted_categories:
        category_topic_ids = sorted(category_topics[category], key=topic_sort_key)
        category_topic_items = [item for item in topic_summaries if item["Topik_ID"] in category_topic_ids]
        ratios = [item["Coverage_Ratio"] for item in category_topic_items if item["Coverage_Ratio"] is not None]
        avg_ratio = (sum(ratios) / len(ratios)) if ratios else None
        with_hits = sum(1 for item in category_topic_items if str(item["Keyword_Ditemukan"]).strip())
        without_hits = len(category_topic_items) - with_hits
        category_summaries.append(
            {
                "Kategori": category,
                "Jumlah_Topik": len(category_topic_ids),
                "Rata_Coverage": avg_ratio,
                "Topik_Dengan_Hit": with_hits,
                "Topik_Tanpa_Hit": without_hits,
            }
        )

    overlap_words: list[dict[str, object]] = []
    artifact_words: list[dict[str, object]] = []
    for word_norm, topic_ids in word_topic_ids.items():
        topic_freq = len(topic_ids)
        category_freq = len(word_category_ids[word_norm])
        entry = {
            "Kata": word_display[word_norm],
            "Topik_Freq": topic_freq,
            "Kategori_Freq": category_freq,
            "Skor_Total": word_score_sum[word_norm],
        }
        if topic_freq > 1:
            overlap_words.append(entry)
        if is_artifact_like(word_display[word_norm]):
            artifact_words.append(entry)

    overlap_words.sort(
        key=lambda item: (
            -int(item["Topik_Freq"]),
            -int(item["Kategori_Freq"]),
            -float(item["Skor_Total"]),
            str(item["Kata"]).lower(),
        )
    )
    artifact_words.sort(
        key=lambda item: (
            -int(item["Topik_Freq"]),
            -int(item["Kategori_Freq"]),
            -float(item["Skor_Total"]),
            str(item["Kata"]).lower(),
        )
    )

    strongest_coverage_topics = sorted(
        [item for item in topic_summaries if item["Coverage_Ratio"] is not None],
        key=lambda item: (
            -float(item["Coverage_Ratio"]),
            topic_sort_key(str(item["Topik_ID"])),
        ),
    )[:12]

    no_hit_categories = [
        item
        for item in sorted(category_summaries, key=lambda cat: (-int(cat["Topik_Tanpa_Hit"]), str(cat["Kategori"])))
        if int(item["Topik_Tanpa_Hit"]) > 0
    ]

    lines: list[str] = []
    lines.append("# Analisis c-TFIDF per Topik dan Kategori")
    lines.append("")
    lines.append("## Ringkasan dataset")
    lines.append("")
    lines.append(f"- File sumber: `{INPUT_PATH.as_posix()}`")
    lines.append(f"- Jumlah baris data: **{len(rows)}**")
    lines.append(f"- Jumlah kolom: **{len(columns)}**")
    lines.append(f"- Jumlah topik unik (`Topik_ID`): **{len(topic_rows)}**")
    lines.append(f"- Jumlah kategori unik (`Kategori`): **{len(category_topics)}**")
    lines.append("- Struktur baris konsisten: setiap topik memiliki **10 kata** berperingkat.")
    lines.append(
        f"- Konsistensi metadata per topik (`Coverage` dan `Keyword_Ditemukan`): "
        f"**{'konsisten' if not inconsistent_topics else f'tidak konsisten pada Topik_ID {', '.join(inconsistent_topics)}'}**."
    )
    lines.append("")
    lines.append("### Kolom penting")
    lines.append("")
    lines.append("| Kolom | Peran dalam analisis |")
    lines.append("| --- | --- |")
    lines.append("| `Topik_ID` | Identitas topik. Dipakai untuk pengelompokan kata dan penghitungan eksklusivitas lintas topik. |")
    lines.append("| `Kategori` | Label kategori topik. Dipakai untuk agregasi tingkat kategori dan eksklusivitas lintas kategori. |")
    lines.append("| `Nama_Topik` | Nama topik hasil model. Dipakai untuk konteks interpretasi. |")
    lines.append("| `Rank` | Urutan kata di dalam topik. Dipakai sebagai urutan baca; validasi menunjukkan tiap topik punya 10 rank. |")
    lines.append("| `Kata` | Token/frasa kandidat yang mewakili topik. Ini adalah unit utama analisis. |")
    lines.append("| `Skor_cTFIDF` | Bobot utama. Semakin tinggi nilainya, semakin kuat kontribusi kata terhadap topik itu. |")
    lines.append("| `Keyword_Ditemukan` | Keyword kategori yang cocok dengan topik. Dipakai untuk membaca kecocokan topik terhadap kamus kategori. |")
    lines.append("| `Coverage` | Rasio `keyword ditemukan / total keyword kategori`. Dipakai sebagai sinyal tambahan, bukan dasar utama ranking. |")
    lines.append("| `Keyword_Kategori_Lengkap` | Daftar keyword kategori penuh. Dipakai hanya untuk konteks interpretasi coverage. |")
    lines.append("")
    lines.append("### Ringkasan kategori")
    lines.append("")
    lines.append("| Kategori | Jumlah topik | Topik dengan keyword hit | Topik tanpa keyword hit | Rata-rata coverage |")
    lines.append("| --- | ---: | ---: | ---: | ---: |")
    for item in sorted(category_summaries, key=lambda cat: (-int(cat["Jumlah_Topik"]), str(cat["Kategori"]))):
        lines.append(
            "| {kategori} | {jumlah} | {with_hits} | {without_hits} | {coverage} |".format(
                kategori=escape_md(item["Kategori"]),
                jumlah=item["Jumlah_Topik"],
                with_hits=item["Topik_Dengan_Hit"],
                without_hits=item["Topik_Tanpa_Hit"],
                coverage=fmt_pct(item["Rata_Coverage"]),
            )
        )
    lines.append("")
    lines.append("### Statistik global kata")
    lines.append("")
    lines.append(f"- Jumlah kata/frasa unik pada seluruh file: **{unique_words}**")
    lines.append(
        f"- Kata yang hanya muncul pada **1 topik**: **{topic_exclusive_words}** "
        f"({fmt_pct(topic_exclusive_words / unique_words)})"
    )
    lines.append(
        f"- Kata yang hanya muncul pada **1 kategori**: **{category_exclusive_words}** "
        f"({fmt_pct(category_exclusive_words / unique_words)})"
    )
    lines.append(
        "- Keputusan analisis: `Skor_cTFIDF` dipakai sebagai dasar utama. "
        "Eksklusivitas lintas topik/kategori dipakai sebagai penguat untuk menilai kata pembeda."
    )
    lines.append("")
    lines.append("## Kata paling berpengaruh per kategori")
    lines.append("")
    lines.append(
        "Metode: untuk setiap kategori, semua kata dari topik-topik di kategori tersebut diagregasi. "
        "Urutan utama memakai `Topik_Di_Kategori`, lalu `Skor_Total_cTFIDF`, lalu `Skor_Maks_cTFIDF`."
    )
    lines.append("")
    for category in sorted_categories:
        summary = next(item for item in category_summaries if item["Kategori"] == category)
        lines.append(f"### {escape_md(category)}")
        lines.append("")
        lines.append(
            f"- Jumlah topik: **{summary['Jumlah_Topik']}**, "
            f"rata-rata coverage: **{fmt_pct(summary['Rata_Coverage'])}**, "
            f"topik dengan keyword hit: **{summary['Topik_Dengan_Hit']}**."
        )

        aggregated_rows: list[dict[str, object]] = []
        for word_norm, stats in category_word_stats[category].items():
            topic_ids = stats["topic_ids"]
            assert isinstance(topic_ids, set)
            aggregated_rows.append(
                {
                    "Kata": word_display[word_norm],
                    "Topik_Di_Kategori": len(topic_ids),
                    "Skor_Total": float(stats["sum_score"]),
                    "Skor_Maks": float(stats["max_score"]),
                    "Kategori_Freq_Global": len(word_category_ids[word_norm]),
                }
            )

        aggregated_rows.sort(
            key=lambda item: (
                -int(item["Topik_Di_Kategori"]),
                -float(item["Skor_Total"]),
                -float(item["Skor_Maks"]),
                str(item["Kata"]).lower(),
            )
        )

        distinctive_words = [
            item
            for item in aggregated_rows
            if int(item["Kategori_Freq_Global"]) == 1
        ]
        distinctive_preview = ", ".join(
            f"{item['Kata']} (topik:{item['Topik_Di_Kategori']}, total:{fmt_float(float(item['Skor_Total']))})"
            for item in distinctive_words[:5]
        )
        lines.append(
            f"- Kata pembeda kategori teratas: "
            f"{escape_md(distinctive_preview) if distinctive_preview else 'tidak ada kata yang benar-benar eksklusif di kategori ini.'}"
        )
        lines.append("")
        lines.append("| Kata | Topik di kategori | Skor total c-TFIDF | Skor maks c-TFIDF | Frekuensi kategori global | Status |")
        lines.append("| --- | ---: | ---: | ---: | ---: | --- |")
        for item in aggregated_rows[:10]:
            status = (
                "eksklusif_kategori"
                if int(item["Kategori_Freq_Global"]) == 1
                else f"shared_{item['Kategori_Freq_Global']}_kategori"
            )
            lines.append(
                "| {kata} | {topic_count} | {sum_score} | {max_score} | {cat_freq} | {status} |".format(
                    kata=escape_md(item["Kata"]),
                    topic_count=item["Topik_Di_Kategori"],
                    sum_score=fmt_float(float(item["Skor_Total"])),
                    max_score=fmt_float(float(item["Skor_Maks"])),
                    cat_freq=item["Kategori_Freq_Global"],
                    status=status,
                )
            )
        lines.append("")

    lines.append("## Kata paling berpengaruh per topik")
    lines.append("")
    lines.append(
        "Metode: untuk setiap topik, kata diurutkan menurut `Rank` dan diverifikasi kembali dengan `Skor_cTFIDF`. "
        "Kolom `Frekuensi_Topik_Global` dan `Frekuensi_Kategori_Global` ditambahkan untuk menunjukkan daya pembeda."
    )
    lines.append("")
    for topic_id in sorted_topic_ids:
        meta = topic_meta[topic_id]
        items = topic_rows[topic_id]
        distinctive_preview_items = sorted(
            items,
            key=lambda item: (
                len(word_topic_ids[str(item["_word_norm"])]),
                -float(item["_score"]),
                int(item["_rank"]),
            ),
        )[:5]
        distinctive_preview = ", ".join(
            f"{item['Kata']} ({status_label(len(word_topic_ids[str(item['_word_norm'])]), len(word_category_ids[str(item['_word_norm'])]), is_artifact_like(str(item['Kata'])))}; {fmt_float(float(item['_score']))})"
            for item in distinctive_preview_items
        )

        lines.append(
            f"### Topik {escape_md(topic_id)} - {escape_md(str(meta['Kategori']))} - {escape_md(str(meta['Nama_Topik']))}"
        )
        lines.append("")
        lines.append(
            f"- Coverage: **{escape_md(str(meta['Coverage']))}** "
            f"({fmt_pct(meta['Coverage_Ratio']) if isinstance(meta['Coverage_Ratio'], float) or meta['Coverage_Ratio'] is None else '-'})"
        )
        lines.append(
            f"- Keyword ditemukan: **{escape_md(str(meta['Keyword_Ditemukan']) or '-')}**"
        )
        lines.append(f"- Kata pembeda topik teratas: {escape_md(distinctive_preview)}")
        lines.append("")
        lines.append("| Rank | Kata | Skor c-TFIDF | Frekuensi topik global | Frekuensi kategori global | Status |")
        lines.append("| ---: | --- | ---: | ---: | ---: | --- |")
        for item in items:
            word_norm = str(item["_word_norm"])
            topic_freq = len(word_topic_ids[word_norm])
            category_freq = len(word_category_ids[word_norm])
            lines.append(
                "| {rank} | {kata} | {score} | {topic_freq} | {category_freq} | {status} |".format(
                    rank=item["_rank"],
                    kata=escape_md(item["Kata"]),
                    score=fmt_float(float(item["_score"])),
                    topic_freq=topic_freq,
                    category_freq=category_freq,
                    status=escape_md(status_label(topic_freq, category_freq, is_artifact_like(str(item["Kata"])))),
                )
            )
        lines.append("")

    lines.append("## Kata pembeda antar topik")
    lines.append("")
    lines.append(
        "Definisi kerja yang dipakai di report ini: "
        "kata dianggap **pembeda topik** jika muncul pada sedikit topik (`Frekuensi_Topik_Global` rendah), "
        "dan dianggap **pembeda kategori** jika hanya muncul pada satu kategori (`Frekuensi_Kategori_Global = 1`)."
    )
    lines.append("")
    lines.append("### Kata eksklusif kategori teratas")
    lines.append("")
    lines.append("| Kategori | Ringkasan kata pembeda |")
    lines.append("| --- | --- |")
    for category in sorted_categories:
        aggregated_rows = []
        for word_norm, stats in category_word_stats[category].items():
            topic_ids = stats["topic_ids"]
            assert isinstance(topic_ids, set)
            if len(word_category_ids[word_norm]) != 1:
                continue
            aggregated_rows.append(
                {
                    "Kata": word_display[word_norm],
                    "Topik_Di_Kategori": len(topic_ids),
                    "Skor_Total": float(stats["sum_score"]),
                    "Skor_Maks": float(stats["max_score"]),
                }
            )
        aggregated_rows.sort(
            key=lambda item: (
                -int(item["Topik_Di_Kategori"]),
                -float(item["Skor_Total"]),
                -float(item["Skor_Maks"]),
                str(item["Kata"]).lower(),
            )
        )
        preview = ", ".join(
            f"{item['Kata']} (topik:{item['Topik_Di_Kategori']}, total:{fmt_float(float(item['Skor_Total']))})"
            for item in aggregated_rows[:6]
        )
        lines.append(f"| {escape_md(category)} | {escape_md(preview or '-')} |")
    lines.append("")
    lines.append("### Kata overlap lintas topik")
    lines.append("")
    lines.append("| Kata | Jumlah topik | Jumlah kategori | Skor total c-TFIDF | Catatan |")
    lines.append("| --- | ---: | ---: | ---: | --- |")
    for item in overlap_words[:20]:
        note = "kata umum lintas konteks"
        if is_artifact_like(str(item["Kata"])):
            note = "indikasi format/noise atau token berulang"
        elif int(item["Kategori_Freq"]) == 1:
            note = "berulang di banyak topik tetapi masih dalam satu kategori"
        lines.append(
            "| {kata} | {topic_freq} | {cat_freq} | {score} | {note} |".format(
                kata=escape_md(item["Kata"]),
                topic_freq=item["Topik_Freq"],
                cat_freq=item["Kategori_Freq"],
                score=fmt_float(float(item["Skor_Total"])),
                note=escape_md(note),
            )
        )
    lines.append("")
    lines.append("### Topik dengan coverage keyword tertinggi")
    lines.append("")
    lines.append("| Topik_ID | Kategori | Coverage | Keyword ditemukan | Nama topik |")
    lines.append("| ---: | --- | ---: | --- | --- |")
    for item in strongest_coverage_topics:
        lines.append(
            "| {topic_id} | {category} | {coverage} | {hits} | {topic_name} |".format(
                topic_id=item["Topik_ID"],
                category=escape_md(item["Kategori"]),
                coverage=escape_md(item["Coverage"]),
                hits=escape_md(item["Keyword_Ditemukan"] or "-"),
                topic_name=escape_md(item["Nama_Topik"]),
            )
        )
    lines.append("")

    lines.append("## Insight / interpretasi")
    lines.append("")
    lines.append(
        f"- **Sinyal diskriminatif kuat di level topik.** Dari **{unique_words}** kata unik, "
        f"**{topic_exclusive_words}** kata (**{fmt_pct(topic_exclusive_words / unique_words)}**) hanya muncul pada satu topik. "
        "Artinya mayoritas kata berfungsi sebagai penanda topik yang cukup spesifik."
    )
    lines.append(
        f"- **Level kategori masih cukup terpisah.** Sebanyak **{category_exclusive_words}** kata "
        f"(**{fmt_pct(category_exclusive_words / unique_words)}**) hanya muncul pada satu kategori, "
        "sehingga agregasi kategori masih informatif."
    )
    if no_hit_categories:
        no_hit_text = ", ".join(
            f"{item['Kategori']} ({item['Topik_Tanpa_Hit']} topik tanpa hit)"
            for item in no_hit_categories[:4]
        )
        lines.append(
            "- **Coverage keyword tidak merata.** Kategori dengan topik tanpa keyword hit paling banyak: "
            f"{escape_md(no_hit_text)}. Ini terutama menandai topik umum/noise atau topik yang kosakatanya belum tertangkap kamus kategori."
        )
    lines.append(
        "- **Kategori dengan coverage relatif paling kuat** ada pada `Pendidikan`, `Kriminal & Hukum`, dan `Keamanan & Pertahanan`. "
        "Secara praktis, topik-topik di kategori ini lebih sering memuat keyword yang sesuai dengan kamus kategori."
    )
    if overlap_words:
        overlap_text = ", ".join(
            f"{item['Kata']} ({item['Topik_Freq']} topik/{item['Kategori_Freq']} kategori)"
            for item in overlap_words[:6]
        )
        lines.append(
            "- **Beberapa kata overlap perlu dibaca hati-hati.** Kata seperti "
            f"{escape_md(overlap_text)} muncul di banyak topik, sehingga daya pembedanya lebih rendah daripada kata eksklusif."
        )
    if artifact_words:
        artifact_text = ", ".join(
            f"{item['Kata']} ({item['Topik_Freq']} topik)"
            for item in artifact_words[:8]
        )
        lines.append(
            "- **Ada indikasi artefak format/noise.** Contoh objektif dari token yang tampak seperti format dokumen, sumber web, "
            f"atau pengulangan kata: {escape_md(artifact_text)}. Kata-kata ini tetap dilaporkan apa adanya karena memang ada di CSV, "
            "tetapi interpretasinya harus lebih hati-hati."
        )
    lines.append(
        "- **Topik Umum dan Topik Noise perlu prioritas kehati-hatian tertinggi.** Keduanya memiliki coverage keyword nol, "
        "dan banyak tokennya bersifat sangat generik atau sulit ditafsirkan tanpa melihat dokumen sumber."
    )
    lines.append(
        "- **Interpretasi semantik dibuat dari kata dan nama topik, bukan dari dokumen asal.** "
        "Karena file ini hanya berisi hasil ranking token, analisis ini kuat untuk menjelaskan kata penanda topik, "
        "tetapi tidak bisa memverifikasi konteks kalimat asal tiap token."
    )
    lines.append("")
    lines.append("### Bagian yang pasti vs inferensi")
    lines.append("")
    lines.append("- **Pasti dari CSV:** nama kolom, jumlah baris/kolom, jumlah topik/kategori, ranking kata, skor `Skor_cTFIDF`, nilai `Coverage`, overlap kata, dan eksklusivitas kata.")
    lines.append("- **Inferensi yang masih valid:** penafsiran makna topik/kategori dari gabungan `Nama_Topik`, kata berperingkat tinggi, dan pola overlap kata.")
    lines.append("- **Batas inferensi:** tanpa dokumen sumber atau distribusi frekuensi dokumen asli, tidak bisa dipastikan apakah sebuah token aneh berasal dari noise scraping, OCR, atau memang istilah domain tertentu.")
    lines.append("")

    lines.append("## Saran penggunaan Data Wrangler")
    lines.append("")
    lines.append(
        "Data Wrangler **bisa membantu cukup jauh** untuk eksplorasi, filter, agregasi, dan visual cek cepat. "
        "Namun, untuk **top-N per grup**, penandaan kata pembeda lintas topik/kategori, dan pembuatan **report Markdown lengkap**, "
        "script Python tetap lebih praktis."
    )
    lines.append("")
    lines.append("### Operasi yang relevan di Data Wrangler")
    lines.append("")
    lines.append("1. Muat `public/hasil/evaluasi_ctfidf_topik.csv` ke Data Wrangler.")
    lines.append("2. Profil kolom `Topik_ID`, `Kategori`, `Nama_Topik`, `Kata`, `Skor_cTFIDF`, `Coverage`.")
    lines.append("3. Gunakan **Sort** pada `Topik_ID` dan `Rank` untuk melihat 10 kata per topik secara langsung.")
    lines.append("4. Gunakan **Group By** pada `['Kategori', 'Kata']` dengan agregasi `sum`, `max`, dan `nunique(Topik_ID)` untuk ringkasan kategori.")
    lines.append("5. Gunakan **Group By** pada `['Kata']` dengan agregasi `nunique(Topik_ID)`, `nunique(Kategori)`, dan `sum(Skor_cTFIDF)` untuk mencari kata overlap dan kata pembeda.")
    lines.append("6. Tambahkan kolom turunan dari `Coverage` agar rasio coverage bisa dipakai untuk sort/filter.")
    lines.append("")
    lines.append("### Rumus / transform yang berguna")
    lines.append("")
    lines.append("```python")
    lines.append("import pandas as pd")
    lines.append("")
    lines.append("df = pd.read_csv('public/hasil/evaluasi_ctfidf_topik.csv')")
    lines.append("df[['Coverage_Found', 'Coverage_Total']] = df['Coverage'].str.split('/', expand=True).fillna('0').astype(int)")
    lines.append("df['Coverage_Ratio'] = df['Coverage_Found'] / df['Coverage_Total'].replace({0: pd.NA})")
    lines.append("```")
    lines.append("")
    lines.append("```python")
    lines.append("kata_per_kategori = (")
    lines.append("    df.groupby(['Kategori', 'Kata'], as_index=False)")
    lines.append("      .agg(")
    lines.append("          Skor_Total_cTFIDF=('Skor_cTFIDF', 'sum'),")
    lines.append("          Skor_Maks_cTFIDF=('Skor_cTFIDF', 'max'),")
    lines.append("          Topik_Di_Kategori=('Topik_ID', 'nunique')")
    lines.append("      )")
    lines.append("      .sort_values(['Kategori', 'Topik_Di_Kategori', 'Skor_Total_cTFIDF', 'Skor_Maks_cTFIDF'], ascending=[True, False, False, False])")
    lines.append(")")
    lines.append("```")
    lines.append("")
    lines.append("```python")
    lines.append("kata_overlap = (")
    lines.append("    df.groupby('Kata', as_index=False)")
    lines.append("      .agg(")
    lines.append("          Topik_Freq=('Topik_ID', 'nunique'),")
    lines.append("          Kategori_Freq=('Kategori', 'nunique'),")
    lines.append("          Skor_Total_cTFIDF=('Skor_cTFIDF', 'sum')")
    lines.append("      )")
    lines.append(")")
    lines.append("")
    lines.append("kata_pembeda_topik = kata_overlap.query('Topik_Freq == 1')")
    lines.append("kata_pembeda_kategori = kata_overlap.query('Kategori_Freq == 1')")
    lines.append("```")
    lines.append("")
    lines.append("### Bagian yang lebih tepat dibantu script Python")
    lines.append("")
    lines.append("- Menentukan **kata pembeda teratas untuk setiap topik** dengan aturan gabungan `Skor_cTFIDF` + frekuensi global.")
    lines.append("- Menyusun **report Markdown lengkap** dengan tabel per kategori dan per topik.")
    lines.append("- Menambahkan catatan interpretasi, overlap, coverage tertinggi, dan keterbatasan analisis secara otomatis.")
    lines.append("- Menjamin hasil bisa diulang tanpa klik manual di antarmuka.")
    lines.append("")

    lines.append("## Kesimpulan")
    lines.append("")
    lines.append(
        "File `evaluasi_ctfidf_topik.csv` cukup kuat untuk mengidentifikasi kata paling berpengaruh dan kata pembeda "
        "baik di level topik maupun kategori, karena tersedia `Rank`, `Kata`, dan `Skor_cTFIDF` yang konsisten per topik."
    )
    lines.append("")
    lines.append(
        "Temuan utama menunjukkan bahwa mayoritas kata bersifat spesifik terhadap satu topik, sehingga pemisahan topik sudah cukup jelas. "
        "Namun, ada juga kata yang overlap lintas topik/kategori dan beberapa token yang tampak seperti artefak format/noise, "
        "terutama di `Topik Umum` dan `Topik Noise (Topic 0)`, sehingga area ini perlu interpretasi lebih hati-hati."
    )
    lines.append("")
    lines.append(
        "Untuk eksplorasi visual dan agregasi awal, Data Wrangler layak dipakai. "
        "Untuk ranking terstruktur, penentuan kata pembeda, dan dokumentasi hasil lengkap, script Python tetap menjadi jalur yang paling stabil dan reproduktif."
    )
    lines.append("")
    lines.append("## Laporan akhir")
    lines.append("")
    lines.append(f"- File yang dibaca: `{INPUT_PATH.as_posix()}`")
    lines.append(f"- File yang dibuat: `{OUTPUT_PATH.as_posix()}`")
    lines.append("- Script bantu yang dibuat: `scripts/analyze_ctfidf_topik.py` untuk membaca CSV, menghitung agregasi topik/kategori, dan menghasilkan report Markdown.")
    lines.append(
        "- Metode analisis: ranking berbasis `Skor_cTFIDF`, agregasi per kategori, penghitungan frekuensi kata lintas topik/kategori, "
        "serta evaluasi `Coverage` sebagai sinyal tambahan."
    )
    lines.append(
        "- Keterbatasan analisis: tidak ada dokumen sumber, tidak ada frekuensi dokumen asli, dan ada token yang tampak generik/artefaktual; "
        "karena itu penilaian makna semantik tetap berbasis token dan nama topik, bukan verifikasi konteks artikel asal."
    )
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    columns, rows = read_rows()
    report = build_report(columns, rows)
    OUTPUT_PATH.write_text(report, encoding="utf-8")
    print(f"Report written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
