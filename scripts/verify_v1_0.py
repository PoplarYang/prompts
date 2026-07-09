#!/usr/bin/env python3
"""Verify pp v1.0 open-source release readiness."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def main() -> int:
    required_files = [
        "README.md",
        "LICENSE",
        "CONTRIBUTING.md",
        "CODE_OF_CONDUCT.md",
        "CHANGELOG.md",
        "docs/release.md",
        "docs/assets/pp-launcher.png",
        "docs/prompt-repository-spec.md",
        "docs/v0.2-acceptance.md",
        "docs/desktop-architecture-decision.md",
        "docs/desktop-prerequisites.md",
        "docs/tauri-migration-plan.md",
        "docs/custom-shortcut-spec.md",
        "prompt-repo-template/manifest.yaml",
        "prompt-repo-template/prompts/coding/code-review.md",
        "demo-repo-content/manifest.yaml",
        "prototype/index.html",
        "prototype/app.js",
        "prototype/styles.css",
        "prototype/prompts.json",
        "scripts/package_release.py",
        ".github/workflows/verify.yml",
        ".github/workflows/release.yml",
        "tests/test_prompt_index.py",
        "scripts/verify_desktop.py",
    ]
    for relative in required_files:
        if not (ROOT / relative).exists():
            return fail(f"Missing v1.0 file: {relative}")

    index = json.loads((ROOT / "prototype/prompts.json").read_text(encoding="utf-8"))
    if len(index.get("prompts", [])) < 5:
        return fail("prototype/prompts.json should include at least 5 prompts")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    html = (ROOT / "prototype/index.html").read_text(encoding="utf-8")
    if "<title>pp v1.0</title>" not in html:
        return fail("prototype title should be pp v1.0")
    if "app.js?v=" not in html or "styles.css?v=" not in html:
        return fail("prototype should version static CSS and JS assets for cache busting")

    required_readme_text = [
        "https://github.com/PoplarYang/prompts",
        "python3 scripts/verify_all.py",
        "python3 scripts/package_release.py",
        "prompt-repo-template",
        "Desktop Architecture Decision",
        "Custom Wake Shortcut Spec",
    ]
    for text in required_readme_text:
        if text not in readme:
            return fail(f"README missing: {text}")

    print("OK: verified pp v1.0 release readiness")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
