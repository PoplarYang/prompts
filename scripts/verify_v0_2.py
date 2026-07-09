#!/usr/bin/env python3
"""Verify the dependency-free pp v0.2 build artifacts."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "prototype" / "prompts.json"
APP_PATH = ROOT / "prototype" / "app.js"
HTML_PATH = ROOT / "prototype" / "index.html"
DEMO_ROOT = ROOT / "demo-repo-content"


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def main() -> int:
    for path in [INDEX_PATH, APP_PATH, HTML_PATH, DEMO_ROOT / "manifest.yaml"]:
        if not path.exists():
            return fail(f"Missing required file: {path}")

    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    if len(index.get("prompts", [])) < 5:
        return fail("Bundled prompt index should include at least 5 prompts")

    demo_prompts = sorted((DEMO_ROOT / "prompts").rglob("*.md"))
    if len(demo_prompts) < 5:
        return fail("Demo repo content should include at least 5 Markdown prompts")

    app = APP_PATH.read_text(encoding="utf-8")
    required_app_snippets = [
        "https://github.com/PoplarYang/prompts",
        "https://api.github.com/repos/",
        "raw.githubusercontent.com",
        "https://data.jsdelivr.com/v1/package/gh/",
        "https://cdn.jsdelivr.net/gh/",
        "localStorage.setItem(cacheKey",
        "function syncFromGitHub",
        "function listPromptFilesFromJsDelivr",
        "function fetchRawFileWithFallback",
        "function parseFrontmatter",
        "function parseGitHubRepo",
        "syncOnLaunch",
    ]
    for snippet in required_app_snippets:
        if snippet not in app:
            return fail(f"Missing v0.2 app behavior snippet: {snippet}")

    html = HTML_PATH.read_text(encoding="utf-8")
    required_elements = [
        "settingsPanel",
        "settingsForm",
        "repoUrlInput",
        "branchInput",
        "promptsDirInput",
        "syncOnLaunchInput",
        "wakeShortcutInput",
        "syncSettings",
    ]
    for element_id in required_elements:
        if f'id="{element_id}"' not in html:
            return fail(f"Missing v0.2 settings element: {element_id}")

    print("OK: verified pp v0.2 GitHub sync artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
