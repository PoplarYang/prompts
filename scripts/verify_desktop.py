#!/usr/bin/env python3
"""Verify pp desktop Tauri source artifacts."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / "desktop"


def fail(message: str) -> int:
    print(f"FAIL: {message}")
    return 1


def main() -> int:
    required_files = [
        "package.json",
        "package-lock.json",
        "src/App.tsx",
        "src/App.css",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
        "src-tauri/src/lib.rs",
        "src-tauri/src/main.rs",
        "src-tauri/tauri.conf.json",
        "src-tauri/capabilities/default.json",
    ]
    for relative in required_files:
        if not (DESKTOP / relative).exists():
            return fail(f"Missing desktop file: {relative}")

    package = json.loads((DESKTOP / "package.json").read_text(encoding="utf-8"))
    if package.get("name") != "pp-desktop":
        return fail("desktop package name should be pp-desktop")

    dependencies = package.get("dependencies", {})
    for dependency in [
        "@tauri-apps/api",
        "@tauri-apps/plugin-global-shortcut",
        "@tauri-apps/plugin-clipboard-manager",
    ]:
        if dependency not in dependencies:
            return fail(f"Missing desktop npm dependency: {dependency}")

    cargo = (DESKTOP / "src-tauri/Cargo.toml").read_text(encoding="utf-8")
    for dependency in [
        "tauri-plugin-global-shortcut",
        "tauri-plugin-clipboard-manager",
    ]:
        if dependency not in cargo:
            return fail(f"Missing desktop Rust dependency: {dependency}")

    lib = (DESKTOP / "src-tauri/src/lib.rs").read_text(encoding="utf-8")
    for snippet in [
        "tauri::RunEvent::Reopen",
        "get_webview_window(\"main\")",
        "window.show()",
        "window.set_focus()",
    ]:
        if snippet not in lib:
            return fail(f"Missing desktop reopen behavior: {snippet}")

    capabilities = (DESKTOP / "src-tauri/capabilities/default.json").read_text(encoding="utf-8")
    for permission in [
        "core:window:allow-hide",
        "core:window:allow-is-visible",
        "core:window:allow-set-focus",
        "core:window:allow-set-always-on-top",
        "core:window:allow-show",
        "core:window:allow-unminimize",
        "global-shortcut:default",
        "global-shortcut:allow-is-registered",
        "global-shortcut:allow-register",
        "global-shortcut:allow-unregister",
        "clipboard-manager:default",
        "clipboard-manager:allow-write-text",
    ]:
        if permission not in capabilities:
            return fail(f"Missing desktop permission: {permission}")

    app = (DESKTOP / "src/App.tsx").read_text(encoding="utf-8")
    required_app_snippets = [
        "CommandOrControl+Shift+P",
        "@tauri-apps/plugin-global-shortcut",
        "@tauri-apps/plugin-clipboard-manager",
        "Wake shortcut registered",
        "Wake shortcut triggered",
        "searchInputRef.current?.focus()",
        "themeMode",
        "languageMode",
        "resolveLanguage",
        "selectedPromptId",
        "listMode",
        "pinFavorites",
        "parseSearchQuery",
        "levenshteinDistance",
        "fuzzyIncludes",
        "getHighlightCandidates",
        "highlightText",
        "highlightEscapedHtml",
        "renderMarkdown(selectedPrompt.body, search)",
        "buildSections",
        "alwaysOnTop",
        "setAlwaysOnTop",
        "onFocusChanged",
        "window.addEventListener(\"blur\"",
        "settingsOpenRef.current",
        "copy-spark",
        "hideLauncher",
        "syncPrompts",
        "https://data.jsdelivr.com/v1/package/gh/",
    ]
    for snippet in required_app_snippets:
        if snippet not in app:
            return fail(f"Missing desktop app behavior: {snippet}")

    config = json.loads((DESKTOP / "src-tauri/tauri.conf.json").read_text(encoding="utf-8"))
    if config.get("productName") != "pp":
        return fail("Tauri productName should be pp")
    if config.get("identifier") != "com.poplaryang.pp":
        return fail("Tauri identifier should be com.poplaryang.pp")

    css = (DESKTOP / "src/App.css").read_text(encoding="utf-8")
    for snippet in [
        ':root[data-theme="light"]',
        ':root[data-theme="system"]',
        ".copy-button.is-copied",
        "@keyframes copy-pop",
        "--tag-text",
        "--code-text",
        "backdrop-filter",
        "z-index: 30",
        ".topbar .icon-button",
        ".search-icon",
        ".mode-tabs",
        ".result-section-title",
        "mark",
    ]:
        if snippet not in css:
            return fail(f"Missing desktop CSS behavior: {snippet}")

    print("OK: verified pp desktop Tauri source artifacts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
