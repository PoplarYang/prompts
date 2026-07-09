# pp MVP Build Plan

## Product Name

Working name: `pp`

Meaning: prompts, prompt palette, prompt picker.

## Recommended Architecture

```txt
Tauri app
  src/
    UI shell
    launcher
    settings
    prompt preview
    search
  src-tauri/
    global shortcut
    clipboard
    local cache paths
    sync commands
```

## Suggested Stack

- Tauri for the desktop shell.
- React and TypeScript for UI.
- Fuse.js for fuzzy search.
- react-markdown for Markdown preview.
- Shiki for code highlighting.
- gray-matter for YAML frontmatter parsing.
- Local JSON for v0.1 user state.

Architecture decision:

- Use Tauri 2 + TypeScript + Rust for the packaged desktop product.
- Keep Python only for build, verification, and release scripts.
- See [Desktop Architecture Decision](desktop-architecture-decision.md).

SQLite can wait until the product needs larger libraries, migrations, or analytics-like queries.

## v0.1 Milestone: Local Prototype

Goal: prove the core launcher interaction without GitHub sync.

Tasks:

- Add sample prompt files under `sample-prompts`.
- Parse Markdown and YAML frontmatter into a generated JSON index.
- Build prompt list.
- Build search input.
- Build preview pane.
- Copy selected prompt body to clipboard.
- Store favorites and use count in local JSON.
- Implement keyboard navigation.
- Add a local verification command.

Acceptance criteria:

- App opens locally.
- Search filters prompts immediately.
- Markdown preview renders code blocks.
- Enter copies the selected prompt body.
- Favorites and usage counts persist across app restarts.
- Prompt data comes from Markdown files, not hardcoded application data.

## v0.2 Milestone: GitHub Sync

Goal: load prompts from a GitHub repository and keep an offline cache.

Tasks:

- Add repository settings.
- Use `https://github.com/PoplarYang/prompts` as the default repository.
- Fetch public GitHub repository files by URL, branch, and prompts directory.
- Cache parsed prompts locally.
- Parse synced files into an index.
- Add manual sync button.
- Add sync-on-launch setting.
- Show sync status and last synced time.
- Use previous cache when sync fails.

Acceptance criteria:

- User can configure a public GitHub repository.
- App can sync prompt files from the repository.
- App remains usable offline after one successful sync.
- Failed sync is visible but non-blocking.

## v0.3 Milestone: Launcher Polish

Goal: make the app feel fast and utility-like.

Tasks:

- Register global shortcut.
- Add configurable wake shortcut.
- Add compact launcher window behavior.
- Add settings window.
- Add theme support.
- Add recent prompts.
- Add result ranking.
- Add empty states and sync diagnostics.
- Package test builds for macOS and Windows.

Acceptance criteria:

- Global shortcut opens the launcher.
- Search input is focused on open.
- Escape closes the launcher.
- Result ranking accounts for exact matches, favorites, recency, and usage count.
- App can be packaged for both target platforms.

## v1.0 Milestone: Open Source Ready

Goal: make the project understandable and installable by others.

Tasks:

- Write README.
- Write prompt repository template.
- Add contribution guide.
- Add release workflow.
- Add basic tests for parser and ranking.
- Add screenshots.
- Add license.

Acceptance criteria:

- New users can create a compatible prompt repository.
- New contributors can run the app locally.
- Releases include installable artifacts.

## Initial UI Sketch

```txt
┌──────────────────────────────────────────────────────────┐
│ Search prompts...                                  ⟳  ⚙ │
├──────────────────────────┬───────────────────────────────┤
│ ★ Code Review Assistant  │ Code Review Assistant          │
│   审查代码风险和测试缺口   │ #coding #review                │
│                          │                               │
│ Explain Error            │ 你是一名严格但友好的...          │
│ Rewrite Clearly          │                               │
│ Summarize Article        │ ```ts                         │
│                          │ {{code}}                      │
│                          │ ```                           │
├──────────────────────────┴───────────────────────────────┤
│ Enter Copy   ↑↓ Navigate   Cmd/Ctrl+F Favorite   Esc Close│
└──────────────────────────────────────────────────────────┘
```

## Risk Notes

- GitHub private repository support introduces authentication complexity. Defer it unless necessary.
- Direct paste into active apps introduces focus and permission complexity. Keep copy-only for v0.1.
- Local editing introduces sync conflicts. Keep source of truth in GitHub for the first release.
- Tauri global shortcut behavior should be tested early on both macOS and Windows.
