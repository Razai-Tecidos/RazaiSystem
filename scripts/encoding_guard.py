#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
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

MOJIBAKE_REGEXES = [
    # Common UTF-8 interpreted as cp1252/latin1:
    # "Ã£", "Ã§", "Ã¡", etc.
    re.compile(r"\u00c3[\u0080-\u00bf]"),
    # Non-breaking space / symbols rendered as "Â ".
    re.compile(r"\u00c2[\u0080-\u00bf ]"),
    # Curly quotes and dash sequences rendered as "â...".
    re.compile(r"\u00e2[\u0080-\u00bf]{1,3}"),
    # Literal UTF-8 bytes for replacement char shown as text.
    re.compile(r"\u00ef\u00bf\u00bd"),
    # Replacement character itself.
    re.compile(r"\ufffd"),
]


def is_text_file(path: Path) -> bool:
    suffix = path.suffix.lower()
    if suffix in BINARY_EXTENSIONS:
        return False
    if suffix in TEXT_EXTENSIONS:
        return True
    return path.name in {".env", ".gitignore", ".gitattributes", ".editorconfig", "Dockerfile"}


def git_paths_from_command(command: list[str]) -> list[Path]:
    result = subprocess.run(
        command,
        cwd=REPO_ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    files = [Path(p) for p in result.stdout.decode("utf-8", errors="replace").split("\x00") if p]
    return [REPO_ROOT / f for f in files]


def tracked_files() -> list[Path]:
    return git_paths_from_command(["git", "ls-files", "-z"])


def staged_files() -> list[Path]:
    return git_paths_from_command(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])


def contains_mojibake(text: str) -> bool:
    return any(regex.search(text) for regex in MOJIBAKE_REGEXES)


def suspicious_line_samples(text: str, limit: int = 3) -> list[str]:
    samples: list[str] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if contains_mojibake(line):
            clean_line = line.strip().replace("\t", " ")
            if len(clean_line) > 160:
                clean_line = f"{clean_line[:157]}..."
            samples.append(f"L{line_number}: {clean_line}")
        if len(samples) >= limit:
            break
    return samples


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
    parser.add_argument("--staged", action="store_true", help="Process only staged files.")
    args = parser.parse_args()

    if args.apply and args.check:
        parser.error("Use either --apply or --check, not both.")

    apply = args.apply
    changed_files: list[Path] = []
    suspect_files: list[Path] = []
    suspect_examples: dict[Path, list[str]] = {}

    target_files = staged_files() if args.staged else tracked_files()

    for file_path in target_files:
        if not file_path.exists() or not is_text_file(file_path):
            continue

        raw = file_path.read_bytes()
        if b"\x00" in raw:
            continue

        original_text, was_utf8 = decode_text(raw)
        fixed_text = normalize_text(original_text)

        if contains_mojibake(fixed_text):
            suspect_files.append(file_path)
            suspect_examples[file_path] = suspicious_line_samples(fixed_text)

        should_write = (fixed_text != original_text) or (not was_utf8)
        if should_write:
            changed_files.append(file_path)
            if apply:
                file_path.write_text(fixed_text, encoding="utf-8", newline="")

    if args.check:
        if changed_files or suspect_files:
            print(f"[encoding_guard] pending fixes: {len(changed_files)} file(s)")
            if changed_files:
                for p in changed_files[:50]:
                    print(f" - {p.relative_to(REPO_ROOT)}")
                if len(changed_files) > 50:
                    print(f" ... and {len(changed_files) - 50} more")
            if suspect_files:
                print(f"[encoding_guard] suspicious mojibake remains in: {len(suspect_files)} file(s)")
                for p in suspect_files[:50]:
                    print(f" - {p.relative_to(REPO_ROOT)}")
                    for sample in suspect_examples.get(p, []):
                        print(f"   {sample}")
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
                for sample in suspect_examples.get(p, []):
                    print(f"   {sample}")
            if len(suspect_files) > 50:
                print(f" ... and {len(suspect_files) - 50} more")
    else:
        print(f"[encoding_guard] dry-run: {len(changed_files)} file(s) would be updated")
        if suspect_files:
            print(f"[encoding_guard] suspicious mojibake in {len(suspect_files)} file(s)")
            for p in suspect_files[:50]:
                print(f" - {p.relative_to(REPO_ROOT)}")
            if len(suspect_files) > 50:
                print(f" ... and {len(suspect_files) - 50} more")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
