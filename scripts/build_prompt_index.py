#!/usr/bin/env python3
"""Build the local prompt index used by the pp v0.1 prototype."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LIBRARY = ROOT / "sample-prompts"
DEFAULT_OUTPUT = ROOT / "prototype" / "prompts.json"


def parse_scalar(value: str):
    value = value.strip()
    if value == "":
        return ""
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [strip_quotes(part.strip()) for part in inner.split(",")]
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    return strip_quotes(value)


def strip_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def parse_frontmatter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---\n"):
        return {}, raw

    end = raw.find("\n---", 4)
    if end == -1:
        return {}, raw

    frontmatter = raw[4:end].strip()
    body = raw[end + 4 :].lstrip("\n")
    data = {}

    for line in frontmatter.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = parse_scalar(value)

    return data, body


def title_from_path(path: Path) -> str:
    return " ".join(part.capitalize() for part in path.stem.replace("-", " ").split())


def load_manifest(library_dir: Path) -> dict:
    manifest_path = library_dir / "manifest.yaml"
    if not manifest_path.exists():
        return {"name": library_dir.name, "version": 1, "prompts_dir": "prompts"}

    manifest = {}
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        manifest[key.strip()] = parse_scalar(value)
    manifest.setdefault("version", 1)
    manifest.setdefault("prompts_dir", "prompts")
    return manifest


def normalize_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    return [str(value)] if str(value).strip() else []


def build_index(library_dir: Path) -> dict:
    manifest = load_manifest(library_dir)
    prompts_dir = library_dir / str(manifest.get("prompts_dir", "prompts"))

    if not prompts_dir.exists():
        raise FileNotFoundError(f"Prompts directory not found: {prompts_dir}")

    prompts = []
    errors = []

    for path in sorted(prompts_dir.rglob("*.md")):
        rel_path = path.relative_to(library_dir).as_posix()
        try:
            raw = path.read_text(encoding="utf-8")
            meta, body = parse_frontmatter(raw)
            prompts.append(
                {
                    "id": rel_path,
                    "title": str(meta.get("title") or title_from_path(path)),
                    "description": str(meta.get("description") or ""),
                    "tags": normalize_list(meta.get("tags")),
                    "category": str(meta.get("category") or path.parent.name),
                    "aliases": normalize_list(meta.get("aliases")),
                    "path": rel_path,
                    "body": body.rstrip() + "\n",
                }
            )
        except Exception as exc:  # pragma: no cover - keeps bad prompt files isolated.
            errors.append({"path": rel_path, "error": str(exc)})

    return {
        "library": {
            "name": str(manifest.get("name") or library_dir.name),
            "version": manifest.get("version", 1),
            "default_locale": str(manifest.get("default_locale") or ""),
            "prompts_dir": str(manifest.get("prompts_dir", "prompts")),
        },
        "generated_at": "",
        "prompts": prompts,
        "errors": errors,
    }


def main(argv: list[str]) -> int:
    library_dir = Path(argv[1]).resolve() if len(argv) > 1 else DEFAULT_LIBRARY
    output_path = Path(argv[2]).resolve() if len(argv) > 2 else DEFAULT_OUTPUT

    index = build_index(library_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if index["errors"]:
        print(f"Built {len(index['prompts'])} prompts with {len(index['errors'])} errors: {output_path}")
        return 1

    print(f"Built {len(index['prompts'])} prompts: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

