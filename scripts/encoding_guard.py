#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

try:
    from ftfy import fix_text
except ImportError:  # pragma: no cover
    print(
        "Dependency missing: ftfy\n"
        "Install with: python -m pip install ftfy",
        file=sys.stderr,
    )
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parents[1]

TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
    ".css",
    ".scss",
    ".html",
    ".svg",
    ".xml",
    ".env",
    ".toml",
    ".ini",
    ".sh",
    ".ps1",
    ".bat",
    ".cmd",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
}

BINARY_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".ico",
    ".pdf",
    ".zip",
    ".gz",
    ".7z",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".mp4",
    ".mov",
    ".avi",
    ".exe",
    ".dll",
    ".so",
    ".bin",
    ".lockb",
}

MOJIBAKE_TOKENS = [
    "Ã¡",
    "Ã¢",
    "Ã£",
    "Ã¤",
    "Ã©",
    "Ãª",
    "Ã­",
    "Ã³",
    "Ã´",
    "Ãµ",
    "Ãº",
    "Ã§",
    "Ã€",
    "Ã‰",
    "Ã“",
    "Ãš",
    "Ã‡",
    "Ãƒ",
    "Ã‚",
    "Â·",
    "Â ",
    "â€¢",
    "â€“",
    "â€”",
    "â€˜",
    "â€™",
    "â€œ",
    "â€�",
    "â€¦",
    "�",
]


def is_text_file(path: Path) -> bool:
    suffix = path.suffix.lower()
    if suffix in BINARY_EXTENSIONS:
        return False
    if suffix in TEXT_EXTENSIONS:
        return True
    return path.name in {".env", ".gitignore", ".gitattributes", ".editorconfig", "Dockerfile"}


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=REPO_ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    files = [Path(p) for p in result.stdout.decode("utf-8", errors="replace").split("\x00") if p]
    return [REPO_ROOT / f for f in files]


def contains_mojibake(text: str) -> bool:
    return any(token in text for token in MOJIBAKE_TOKENS)


def decode_text(raw: bytes) -> tuple[str, bool]:
    try:
        return raw.decode("utf-8"), True
    except UnicodeDecodeError:
        try:
            return raw.decode("cp1252"), False
        except UnicodeDecodeError:
            return raw.decode("latin-1"), False


def normalize_text(text: str) -> str:
    # ftfy resolves common mojibake safely and normalizes Unicode.
    return fix_text(text, normalization="NFC")


def main() -> int:
    parser = argparse.ArgumentParser(description="Fix/check mojibake and UTF-8 encoding in tracked text files.")
    parser.add_argument("--apply", action="store_true", help="Apply fixes in-place (UTF-8).")
    parser.add_argument("--check", action="store_true", help="Check only; exit 1 if issues are found.")
    args = parser.parse_args()

    apply = args.apply and not args.check
    changed_files: list[Path] = []
    suspect_files: list[Path] = []

    for file_path in tracked_files():
        if not file_path.exists() or not is_text_file(file_path):
            continue

        raw = file_path.read_bytes()
        if b"\x00" in raw:
            continue

        original_text, was_utf8 = decode_text(raw)
        fixed_text = normalize_text(original_text)

        if contains_mojibake(fixed_text):
            suspect_files.append(file_path)

        should_write = (fixed_text != original_text) or (not was_utf8)
        if should_write:
            changed_files.append(file_path)
            if apply:
                file_path.write_text(fixed_text, encoding="utf-8", newline="")

    if args.check:
        if changed_files or suspect_files:
            print(f"[encoding_guard] pending fixes: {len(changed_files)} file(s)")
            if suspect_files:
                print(f"[encoding_guard] suspicious mojibake remains in: {len(suspect_files)} file(s)")
                for p in suspect_files[:50]:
                    print(f" - {p.relative_to(REPO_ROOT)}")
                if len(suspect_files) > 50:
                    print(f" ... and {len(suspect_files) - 50} more")
            return 1
        print("[encoding_guard] clean")
        return 0

    if apply:
        print(f"[encoding_guard] fixed {len(changed_files)} file(s)")
        if suspect_files:
            print(f"[encoding_guard] warning: {len(suspect_files)} file(s) still suspicious")
            for p in suspect_files[:50]:
                print(f" - {p.relative_to(REPO_ROOT)}")
            if len(suspect_files) > 50:
                print(f" ... and {len(suspect_files) - 50} more")
    else:
        print(f"[encoding_guard] dry-run: {len(changed_files)} file(s) would be updated")
        if suspect_files:
            print(f"[encoding_guard] suspicious mojibake in {len(suspect_files)} file(s)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

