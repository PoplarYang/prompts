#!/usr/bin/env python3
"""Verify the dependency-free pp v0.1 build artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "prototype" / "prompts.json"
APP_PATH = ROOT / "prototype" / "app.js"
HTML_PATH = ROOT / "prototype" / "index.html"
CSS_PATH = ROOT / "prototype" / "styles.css"


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def main() -> int:
    required_files = [INDEX_PATH, APP_PATH, HTML_PATH, CSS_PATH]
    missing = [path for path in required_files if not path.exists()]
    if missing:
        return fail("Missing required files: " + ", ".join(str(path) for path in missing))

    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    prompts = index.get("prompts")
    if not isinstance(prompts, list) or not prompts:
        return fail("Prompt index must contain at least one prompt")

    ids = set()
    for prompt in prompts:
        for field in ["id", "title", "path", "body"]:
            if not prompt.get(field):
                return fail(f"Prompt missing required field {field}: {prompt}")
        if prompt["id"] in ids:
            return fail(f"Duplicate prompt id: {prompt['id']}")
        ids.add(prompt["id"])
        if not isinstance(prompt.get("tags"), list):
            return fail(f"Prompt tags must be a list: {prompt['id']}")
        if not isinstance(prompt.get("aliases"), list):
            return fail(f"Prompt aliases must be a list: {prompt['id']}")
        if prompt["body"].startswith("---"):
            return fail(f"Prompt body still contains frontmatter: {prompt['id']}")

    app = APP_PATH.read_text(encoding="utf-8")
    required_snippets = [
        'fetch("./prompts.json"',
        "navigator.clipboard.writeText",
        "document.execCommand",
        "function showManualCopy",
        "localStorage.setItem",
        "function scorePrompt",
        "function renderMarkdown",
    ]
    for snippet in required_snippets:
        if snippet not in app:
            return fail(f"Missing app behavior snippet: {snippet}")

    html = HTML_PATH.read_text(encoding="utf-8")
    for element_id in ["searchInput", "results", "previewBody", "statusText", "copyButton", "manualCopyText"]:
        if f'id="{element_id}"' not in html:
            return fail(f"Missing required UI element: {element_id}")

    print(f"OK: verified pp static app baseline with {len(prompts)} prompts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
