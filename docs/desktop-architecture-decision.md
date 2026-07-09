# Desktop Architecture Decision

## Decision

Use **Tauri 2 + TypeScript frontend + Rust native shell** for the packaged desktop product.

The current static app remains useful as a web prototype and verification harness. Python remains only for repository tooling:

- building bundled prompt indexes
- running parser/ranking tests
- packaging the static release
- CI verification

Python should not be the runtime for the packaged macOS/Windows product.

## Why Tauri

`pp` needs:

- cross-platform macOS and Windows packaging
- a compact utility-style launcher window
- configurable global wake shortcut
- clipboard access
- local file/cache storage
- HTTP sync from GitHub-compatible public repositories
- small install footprint

Tauri fits this shape better than Python desktop frameworks because it provides a native shell with a web frontend and Rust backend, official distribution docs, and a global shortcut plugin.

## Source Notes

- Tauri has an official global shortcut plugin that can register shortcuts from JavaScript or Rust and supports desktop platforms. See [Tauri Global Shortcut](https://v2.tauri.app/plugin/global-shortcut/).
- Tauri documents app distribution targets such as DMG, macOS app bundles, and Windows installers. See [Tauri Distribute](https://v2.tauri.app/distribute/).
- Tauri provides guidance for small binaries and release profile tuning. See [Tauri App Size](https://v2.tauri.app/concept/size/).
- Electron also supports global shortcuts through `globalShortcut`, but ships a heavier Chromium-based runtime. See [Electron globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut).
- Flutter supports desktop apps, but it is a larger UI framework and would require rewriting the current web prototype in Dart. See [Flutter desktop support](https://docs.flutter.dev/platform-integration/desktop).
- Wails is viable for Go teams, but `pp` benefits more from reusing the current TypeScript/web UI and Tauri's plugin ecosystem. See [Wails introduction](https://wails.io/docs/introduction/).

## Comparison

| Option | Fit | Notes |
| --- | --- | --- |
| Tauri 2 + TypeScript + Rust | Best | Reuses current web UI, provides native APIs, small footprint, official global shortcut plugin. |
| Electron + TypeScript | Good but heavier | Mature and easy, but larger runtime and memory footprint are less aligned with a lightweight launcher. |
| Flutter + Dart | Medium | Strong UI toolkit and desktop support, but requires a full rewrite from the current web implementation. |
| Wails + Go + Web UI | Medium | Good for Go-native teams, but fewer benefits for this project than Tauri. |
| Python desktop stack | Poor for product runtime | Convenient for scripts, but packaging, native shortcuts, signing, and polished desktop behavior are harder to make product-grade. |

## Target Architecture

```txt
pp-desktop/
  src/
    TypeScript launcher UI
    search and preview components
    settings UI
  src-tauri/
    Rust native shell
    global shortcut registration
    clipboard commands
    local cache paths
    GitHub/jsDelivr sync commands
    app window lifecycle
```

## Native Responsibilities

Rust/Tauri side:

- register and update global wake shortcut
- show/hide/focus launcher window
- copy prompt text to OS clipboard
- read/write app config and cache under platform app data directories
- perform HTTP sync with GitHub API and jsDelivr fallback
- package app for macOS and Windows

TypeScript UI side:

- render launcher
- search and rank prompts
- render Markdown preview
- show settings
- call native commands for shortcut, clipboard, config, cache, and sync

## Migration Plan

1. Keep `prototype/` as the reference UI and behavior harness.
2. Create a Tauri app shell.
3. Move UI into a TypeScript module structure.
4. Move prompt parsing/sync into shared TypeScript first.
5. Add Tauri commands for filesystem cache and clipboard.
6. Add configurable global shortcut registration.
7. Add platform packaging and release workflows.

## Non-Goals For Native Migration

- Private GitHub repository auth.
- Prompt editing and Git push.
- Team sync.
- Mobile apps.

