#!/usr/bin/env python3
"""Basic parser and ranking tests for pp."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "scripts" / "build_prompt_index.py"


def load_build_module():
    spec = importlib.util.spec_from_file_location("build_prompt_index", BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def assert_equal(actual, expected, message):
    if actual != expected:
      raise AssertionError(f"{message}: expected {expected!r}, got {actual!r}")


def assert_true(value, message):
    if not value:
      raise AssertionError(message)


def score_prompt(prompt, query, local=None):
    local = local or {"favorite": False, "useCount": 0, "lastUsedAt": None}
    q = str(query or "").lower().strip()
    score = 0

    if not q:
        if local.get("favorite"):
            score += 140
        if local.get("lastUsedAt"):
            score += 100
        score += min(local.get("useCount", 0), 20) * 3
        return score

    title = prompt["title"].lower()
    description = prompt.get("description", "").lower()
    tags = " ".join(prompt.get("tags", [])).lower()
    aliases = " ".join(prompt.get("aliases", [])).lower()
    category = prompt.get("category", "").lower()
    path = prompt["path"].lower()
    body = prompt["body"].lower()

    if title == q:
        score += 300
    if any(alias.lower() == q for alias in prompt.get("aliases", [])):
        score += 260
    if q in title:
        score += 180
    if q in aliases:
        score += 160
    if q in tags:
        score += 130
    if q in category:
        score += 110
    if q in description:
        score += 90
    if q in path:
        score += 60
    if q in body:
        score += 35
    if local.get("favorite"):
        score += 16
    if local.get("lastUsedAt"):
        score += 10
    score += min(local.get("useCount", 0), 8)
    return score


def test_frontmatter_parser(build):
    raw = """---
title: Test Prompt
tags: [coding, review]
aliases: [tp, test]
category: coding
---

Body text.
"""
    meta, body = build.parse_frontmatter(raw)
    assert_equal(meta["title"], "Test Prompt", "title parsed")
    assert_equal(meta["tags"], ["coding", "review"], "tags parsed")
    assert_equal(meta["aliases"], ["tp", "test"], "aliases parsed")
    assert_equal(body, "Body text.\n", "body parsed without frontmatter")


def test_sample_index(build):
    index = build.build_index(ROOT / "sample-prompts")
    prompts = index["prompts"]
    assert_equal(len(prompts), 5, "sample prompt count")
    code_review = next(prompt for prompt in prompts if prompt["id"] == "prompts/coding/code-review.md")
    assert_equal(code_review["title"], "Code Review Assistant", "title from frontmatter")
    assert_true("{{code}}" in code_review["body"], "body keeps placeholder")
    assert_true(not code_review["body"].startswith("---"), "body excludes frontmatter")


def test_ranking_prefers_alias_and_favorite(build):
    index = build.build_index(ROOT / "sample-prompts")
    prompts = index["prompts"]
    ranked = sorted(prompts, key=lambda prompt: score_prompt(prompt, "cr"), reverse=True)
    assert_equal(ranked[0]["title"], "Code Review Assistant", "alias ranks first")

    weekly = next(prompt for prompt in prompts if prompt["title"] == "Weekly Review")
    rewrite = next(prompt for prompt in prompts if prompt["title"] == "Rewrite Clearly")
    assert_true(
        score_prompt(weekly, "", {"favorite": True, "useCount": 0, "lastUsedAt": None})
        > score_prompt(rewrite, "", {"favorite": False, "useCount": 20, "lastUsedAt": None}),
        "favorite ranks above usage-only prompt in empty query",
    )


def main() -> int:
    build = load_build_module()
    tests = [
        test_frontmatter_parser,
        test_sample_index,
        test_ranking_prefers_alias_and_favorite,
    ]
    for test in tests:
        test(build)
        print(f"OK: {test.__name__}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}")
        raise SystemExit(1)

