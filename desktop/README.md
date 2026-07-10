# pp desktop

Tauri 2 + React + TypeScript desktop app for `pp`.

Current desktop version: `0.1.4`.

## Development

```sh
npm install
npm run tauri dev
```

## Build

```sh
npm run build
npm run tauri build -- --bundles app
```

Verified macOS output:

```txt
src-tauri/target/release/bundle/macos/pp.app
```

Create local macOS distribution artifacts from the repository root:

```sh
python3 scripts/package_desktop.py
python3 scripts/verify_desktop_package.py
```

Outputs:

```txt
dist/pp-desktop-macos-aarch64.zip
dist/pp-desktop-macos-aarch64.dmg
```

## Implemented

- Prompt launcher UI
- Search and ranking across prompt metadata, path, and body
- Fuzzy search plus `#tag`, `fav:`, and `recent:` filters
- Search highlighting in result metadata and Markdown body content
- Markdown preview with code blocks
- Smart, relevance, recent, favorites, and most-used list modes
- Favorite pinning, recent usage, and usage-count display
- GitHub sync with jsDelivr fallback
- Local folder prompt source with separate local cache
- GitHub/local source indicators on prompt rows and detail metadata
- Settings with configurable wake shortcut
- Theme setting for system, dark, and light modes
- Language setting for system, Chinese, and English
- Always-on-top setting
- Copy feedback and hide-after-copy behavior
- Tauri clipboard manager plugin
- Tauri global shortcut plugin
- macOS Dock/app icon reopen behavior
- Automatic and manual update checks through GitHub Releases

## Release

The GitHub release workflow builds:

- static zip package
- macOS `.zip` and `.dmg`
- Windows NSIS installer

GitHub releases are created as drafts so the generated artifacts can be checked before publishing.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
