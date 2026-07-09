#!/usr/bin/env python3
"""Package pp v1.0 static release artifacts."""

from __future__ import annotations

import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.0.0"
DIST = ROOT / "dist"
ARTIFACT = DIST / f"pp-v{VERSION}-static.zip"

INCLUDE_PATHS = [
    "README.md",
    "LICENSE",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "CHANGELOG.md",
    "docs",
    "prototype",
    "sample-prompts",
    "demo-repo-content",
    "prompt-repo-template",
    "scripts/build_prompt_index.py",
    "scripts/verify_v0_1.py",
    "scripts/verify_v0_2.py",
    "scripts/verify_v1_0.py",
    "scripts/verify_all.py",
    "scripts/package_release.py",
    "tests",
]


def should_skip(path: Path) -> bool:
    parts = set(path.parts)
    return (
        "__pycache__" in parts
        or ".git" in parts
        or ".DS_Store" in parts
        or path.suffix == ".pyc"
    )


def add_path(zf: zipfile.ZipFile, path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(path)

    if path.is_file():
        if not should_skip(path):
            zf.write(path, path.relative_to(ROOT).as_posix())
        return

    for child in sorted(path.rglob("*")):
        if child.is_file() and not should_skip(child):
            zf.write(child, child.relative_to(ROOT).as_posix())


def main() -> int:
    DIST.mkdir(exist_ok=True)
    if ARTIFACT.exists():
        ARTIFACT.unlink()

    with zipfile.ZipFile(ARTIFACT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for relative in INCLUDE_PATHS:
            add_path(zf, ROOT / relative)

    print(f"OK: wrote {ARTIFACT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
