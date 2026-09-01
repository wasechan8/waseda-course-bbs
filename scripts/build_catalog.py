"""Build a public, metadata-only course catalog from the private scraper CSVs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode


DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "waseda-classes" / "scraper"
DEFAULT_OVERLAY_SOURCE = DEFAULT_SOURCE / "catalog"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data"

FACULTY_LABELS = {
    "politics_economics": "政治経済学部",
    "law": "法学部",
    "education": "教育学部",
    "commerce": "商学部",
    "social_sciences": "社会科学部",
    "human_sciences": "人間科学部",
    "sport_sciences": "スポーツ科学部",
    "international": "国際教養学部",
    "culture_community": "文化構想学部",
    "letters": "文学部",
    "human_correspondence": "人間科学部（通信教育）",
    "fundamental_sci": "基幹理工学部",
    "creative_sci": "創造理工学部",
    "advanced_sci": "先進理工学部",
    "global_education": "グローバルエデュケーションセンター",
}

FACULTY_ORDER = list(FACULTY_LABELS)

# Only these fields can leave the private scraper directory.
PUBLIC_FIELDS = {
    "year",
    "course_code",
    "name",
    "teacher",
    "faculty",
    "term",
    "schedule",
    "p_key",
    "course_code_full",
    "credits",
    "method_type",
}

DAY_MAP = {day: index for index, day in enumerate("月火水木金土日", start=1)}
KANJI_NUM_MAP = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
}
ZEN_TO_HAN = str.maketrans("０１２３４５６７８９①②③④⑤⑥⑦", "01234567891234567")
SLOT_PATTERN = re.compile(
    r"([月火水木金土日])\s*([1-7一二三四五六七])\s*(?:時限目|限目|時限|限)?"
)


def faculty_slug_from_filename(path: Path) -> str | None:
    match = re.match(r"(.+)_(spring|fall)\.csv$", path.name)
    if not match:
        return None
    slug = match.group(1)
    return slug if slug in FACULTY_LABELS else None


def text(value: str | None) -> str:
    return (value or "").strip()


def syllabus_url(p_key: str | None) -> str | None:
    key = text(p_key)
    if not key:
        return None
    query = urlencode({"pKey": key, "pLng": "jp"})
    return f"https://www.wsl.waseda.jp/syllabus/JAA104.php?{query}"


def parse_schedule(schedule: str | None) -> list[dict[str, int]]:
    normalized = text(schedule).translate(ZEN_TO_HAN)
    if not normalized:
        return []

    slots: list[dict[str, int]] = []
    seen: set[tuple[int, int]] = set()
    for day_label, period_label in SLOT_PATTERN.findall(normalized):
        day = DAY_MAP[day_label]
        period = KANJI_NUM_MAP.get(period_label)
        if period is None:
            period = int(period_label)
        key = (day, period)
        if key in seen:
            continue
        seen.add(key)
        slots.append({"day": day, "period": period})
    return slots


def public_id(row: dict[str, str], faculty_slug: str) -> str:
    source = text(row.get("p_key")) or "|".join(
        [
            faculty_slug,
            text(row.get("year")),
            text(row.get("course_code_full") or row.get("course_code")),
            text(row.get("name")),
            text(row.get("teacher")),
            text(row.get("term")),
            text(row.get("schedule")),
        ]
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:20]


def source_csv_files(sources: list[Path]) -> list[Path]:
    """Return one CSV per filename, with later sources overriding earlier ones."""
    selected: dict[str, Path] = {}
    for source in sources:
        if not source.exists():
            continue
        for csv_path in sorted(source.glob("*.csv")):
            if faculty_slug_from_filename(csv_path):
                selected[csv_path.name] = csv_path
    return [selected[name] for name in sorted(selected)]


def build_catalog(sources: list[Path], output: Path) -> None:
    courses_by_faculty: dict[str, list[dict[str, object]]] = defaultdict(list)
    seen_ids_by_faculty: dict[str, set[str]] = defaultdict(set)

    for csv_path in source_csv_files(sources):
        faculty_slug = faculty_slug_from_filename(csv_path)
        if not faculty_slug:
            continue

        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames or not PUBLIC_FIELDS.issubset(reader.fieldnames):
                missing = sorted(PUBLIC_FIELDS.difference(reader.fieldnames or []))
                raise ValueError(f"{csv_path.name}: missing required columns: {missing}")

            for row in reader:
                course_id = public_id(row, faculty_slug)
                if course_id in seen_ids_by_faculty[faculty_slug]:
                    continue
                seen_ids_by_faculty[faculty_slug].add(course_id)

                raw_credits = text(row.get("credits"))
                try:
                    credits: float | None = float(raw_credits) if raw_credits else None
                except ValueError:
                    credits = None

                courses_by_faculty[faculty_slug].append(
                    {
                        "id": course_id,
                        "code": text(row.get("course_code_full") or row.get("course_code")),
                        "name": text(row.get("name")),
                        "teacher": text(row.get("teacher")) or None,
                        "faculty": FACULTY_LABELS[faculty_slug],
                        "facultySlug": faculty_slug,
                        "term": text(row.get("term")) or None,
                        "schedule": text(row.get("schedule")) or None,
                        "slots": parse_schedule(row.get("schedule")),
                        "credits": credits,
                        "methodType": text(row.get("method_type")) or None,
                        "year": int(text(row.get("year")) or 0) or None,
                        "syllabusUrl": syllabus_url(row.get("p_key")),
                    }
                )

    courses_output = output / "courses"
    courses_output.mkdir(parents=True, exist_ok=True)
    for old_file in courses_output.glob("*.json"):
        old_file.unlink()

    faculties: list[dict[str, object]] = []
    course_index: dict[str, dict[str, object]] = {}
    for slug in FACULTY_ORDER:
        courses = courses_by_faculty.get(slug, [])
        if not courses:
            continue
        courses.sort(key=lambda course: (str(course["name"]), str(course["teacher"] or "")))
        (courses_output / f"{slug}.json").write_text(
            json.dumps(courses, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        for course in courses:
            course_index[str(course["id"])] = {
                "name": course["name"],
                "facultySlug": course["facultySlug"],
            }
        faculties.append(
            {
                "slug": slug,
                "label": FACULTY_LABELS[slug],
                "courseCount": len(courses),
            }
        )

    output.mkdir(parents=True, exist_ok=True)
    (output / "faculties.json").write_text(
        json.dumps(faculties, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (output / "course-index.json").write_text(
        json.dumps(course_index, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Built {sum(len(value) for value in courses_by_faculty.values()):,} courses")
    print(f"Faculties: {len(faculties)}")
    for faculty in faculties:
        print(f"  - {faculty['label']}: {faculty['courseCount']:,}")
    print(f"Output: {output}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        action="append",
        type=Path,
        dest="sources",
        help="CSV directory. Repeat to add an overlay; later sources win.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    sources = args.sources or [DEFAULT_SOURCE, DEFAULT_OVERLAY_SOURCE]
    build_catalog([source.resolve() for source in sources], args.output.resolve())


if __name__ == "__main__":
    main()
