from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from html import unescape
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "mas202" / "exams"
BASE_URL = "https://fuoverflow.com/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139 Safari/537.36"
)


@dataclass(frozen=True)
class ExamSource:
    exam_id: str
    exam_type: str
    term: str
    date: str
    thread_url: str


EXAMS = (
    ExamSource(
        exam_id="SP26-B5FE",
        exam_type="FE",
        term="SP26",
        date="2026-04-25",
        thread_url="https://fuoverflow.com/threads/mas202-sp26-b5fe.6388/",
    ),
    ExamSource(
        exam_id="SP26-FE",
        exam_type="FE",
        term="SP26",
        date="2026-04-18",
        thread_url="https://fuoverflow.com/threads/mas202-sp26-fe.6238/",
    ),
    ExamSource(
        exam_id="SP26-B5RE",
        exam_type="RE",
        term="SP26",
        date="2026-05-04",
        thread_url="https://fuoverflow.com/threads/mas202-sp26-b5re.6486/",
    ),
    ExamSource(
        exam_id="SP26-RE",
        exam_type="RE",
        term="SP26",
        date="2026-04-18",
        thread_url="https://fuoverflow.com/threads/mas202-sp26-re.6283/",
    ),
)


def without_query(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def sign_in(username: str, password: str) -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    login_page = session.get(urljoin(BASE_URL, "/login/"), timeout=30)
    login_page.raise_for_status()
    match = re.search(
        r'name="_xfToken"\s+value="([^"]*)"',
        login_page.text,
        flags=re.IGNORECASE,
    )
    if not match:
        raise RuntimeError("FUOverflow login token was not found")

    response = session.post(
        urljoin(BASE_URL, "/login/login"),
        data={
            "login": username,
            "password": password,
            "remember": "1",
            "_xfRedirect": BASE_URL,
            "_xfToken": unescape(match.group(1)),
        },
        timeout=30,
        allow_redirects=True,
    )
    response.raise_for_status()
    if username not in response.text:
        raise RuntimeError("FUOverflow login did not complete")
    return session


def attachment_links(session: requests.Session, source: ExamSource) -> dict[int, str]:
    response = session.get(source.thread_url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    links: dict[int, str] = {}

    for image in soup.find_all("img", alt=True):
        match = re.fullmatch(r"Q(\d+)\.(?:jpe?g|png|webp)", image["alt"], re.I)
        if not match:
            continue
        anchor = image.find_parent("a", href=True)
        if not anchor:
            continue
        number = int(match.group(1))
        links[number] = urljoin(BASE_URL, unescape(anchor["href"]))

    expected = set(range(1, 51))
    if set(links) != expected:
        missing = sorted(expected - set(links))
        extra = sorted(set(links) - expected)
        raise RuntimeError(
            f"{source.exam_id}: expected Q1-Q50, missing={missing}, extra={extra}"
        )
    return links


def download_exam(
    session: requests.Session,
    source: ExamSource,
    output_root: Path,
    force: bool,
) -> None:
    exam_root = output_root / source.exam_id
    image_root = exam_root / "images"
    image_root.mkdir(parents=True, exist_ok=True)
    links = attachment_links(session, source)
    manifest: list[dict[str, object]] = []

    for number in range(1, 51):
        output_path = image_root / f"Q{number}.jpg"
        if output_path.exists() and not force:
            content = output_path.read_bytes()
        else:
            response = session.get(links[number], timeout=45)
            response.raise_for_status()
            if not (response.headers.get("content-type") or "").startswith("image/"):
                raise RuntimeError(
                    f"{source.exam_id} Q{number}: attachment is not an image"
                )
            content = response.content
            output_path.write_bytes(content)

        with Image.open(BytesIO(content)) as image:
            width, height = image.size
            image_format = image.format
            image.verify()

        if width < 1200 or height < 600:
            raise RuntimeError(
                f"{source.exam_id} Q{number}: resolution {width}x{height} is not original"
            )

        manifest.append(
            {
                "question": number,
                "file": output_path.name,
                "bytes": len(content),
                "width": width,
                "height": height,
                "format": image_format,
                "sha256": hashlib.sha256(content).hexdigest(),
                "source": without_query(links[number]),
            }
        )
        print(f"{source.exam_id}: {number:02d}/50", flush=True)

    with (exam_root / "manifest.csv").open(
        "w",
        newline="",
        encoding="utf-8-sig",
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=manifest[0].keys())
        writer.writeheader()
        writer.writerows(manifest)

    (exam_root / "source.json").write_text(
        json.dumps(
            {
                "course": "MAS202",
                "exam": source.exam_id,
                "type": source.exam_type,
                "term": source.term,
                "date": source.date,
                "thread": source.thread_url,
                "imageCount": len(manifest),
                "minimumResolution": {
                    "width": min(item["width"] for item in manifest),
                    "height": min(item["height"] for item in manifest),
                },
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Destination for MAS202 source exams",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace existing source images",
    )
    parser.add_argument(
        "--exam",
        action="append",
        choices=[source.exam_id for source in EXAMS],
        help="Download only this exam (repeat to select multiple exams)",
    )
    args = parser.parse_args()

    username = os.environ.get("FUO_USERNAME")
    password = os.environ.get("FUO_PASSWORD")
    if not username or not password:
        raise RuntimeError("Set FUO_USERNAME and FUO_PASSWORD before running")

    selected = [
        source for source in EXAMS if not args.exam or source.exam_id in args.exam
    ]

    for source in selected:
        exam_root = args.output.resolve() / source.exam_id
        existing = sorted(
            (exam_root / "images").glob("Q*.jpg"),
            key=lambda path: int(re.search(r"\d+", path.stem).group()),
        )
        if (
            not args.force
            and len(existing) == 50
            and (exam_root / "manifest.csv").exists()
            and (exam_root / "source.json").exists()
        ):
            print(f"{source.exam_id}: already complete, skipped", flush=True)
            continue

        # FUOverflow limits long-lived bulk sessions. A fresh authenticated
        # session per exam keeps every 50-image download within that window.
        session = sign_in(username, password)
        download_exam(session, source, args.output.resolve(), args.force)
    print(f"Processed {len(selected)} MAS202 exams in {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
