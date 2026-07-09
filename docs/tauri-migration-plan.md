# Tauri Migration Plan

## Goal

Move `pp` from the static prototype into a packaged macOS/Windows desktop app without losing the proven v1.0 behavior.

## Target Directory

Keep the existing static app as a reference and create a new desktop app directory:

```txt
prototype/          static reference app
desktop/            Tauri 2 desktop app
docs/               product and architecture docs
scripts/            release and verification tooling
```

## Migration Order

### Phase 0: Install Prerequisites

- Install Node.js LTS.
- Install npm.
- Install Rust toolchain with `rustc` and `cargo`.
- Confirm Xcode Command Line Tools.
- See [Desktop Development Prerequisites](desktop-prerequisites.md).

Exit criteria:

- `node --version` works.
- `npm --version` works.
- `rustc --version` works.
- `cargo --version` works.
- `xcode-select -p` works on macOS.

### Phase 1: Desktop Shell

- Create `desktop/` with Tauri 2, Vite, React, and TypeScript.
- Add a compact launcher window matching the prototype dimensions.
- Add app config loading/saving from app data.
- Add local cache loading/saving from app data.
- Copy the existing UI styling into desktop first.

Exit criteria:

- `desktop` app launches locally.
- Search input is focused.
- Bundled prompt index renders.

Status: source scaffold and macOS `.app` bundle are complete; local GUI smoke testing is still pending.

### Phase 2: Shared Prompt Logic

- Extract prompt types, parser, ranking, and Markdown rendering helpers.
- Port GitHub/jsDelivr sync logic to TypeScript.
- Add unit tests for parser and ranking in the desktop package.
- Keep Python scripts for repository-level verification only.

Exit criteria:

- Desktop app can parse bundled prompts.
- Desktop app can sync public GitHub prompts.
- Desktop app uses local cache when offline.

### Phase 3: Native APIs

- Add OS clipboard copy through Tauri.
- Add configurable global wake shortcut through Tauri global shortcut plugin.
- Add show/hide/focus launcher window command.
- Add settings flow that validates and registers wake shortcut.

Exit criteria:

- Custom wake shortcut opens the launcher.
- Copy uses OS clipboard.
- Failed shortcut registration keeps the previous shortcut.

### Phase 4: Packaging

- Add macOS app bundle and DMG build.
- Add Windows installer build.
- Add CI workflow placeholders for platform builds.
- Document manual signing/notarization steps as deferred if certificates are not available.

Exit criteria:

- Local development build runs.
- Local production bundle can be generated on the current platform.
- Release docs explain macOS and Windows packaging.

## Suggested Tooling

- Tauri 2
- Vite
- React
- TypeScript
- Rust
- `@tauri-apps/plugin-global-shortcut`
- `@tauri-apps/plugin-clipboard-manager` or Tauri command wrapping clipboard behavior

## Preserve From Static v1.0

- Public GitHub repository sync.
- jsDelivr fallback.
- Markdown + YAML frontmatter prompt format.
- Offline cache.
- Favorites, usage count, and recent usage.
- Manual copy fallback as a UI backup.
- Demo prompt repository content.

## Do Not Move Yet

- Private GitHub authentication.
- Prompt editing.
- Git commit/push.
- Team sharing.
- Browser extension.
