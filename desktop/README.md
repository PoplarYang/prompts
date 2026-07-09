# pp desktop

Tauri 2 + React + TypeScript desktop app for `pp`.

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

## Implemented

- Prompt launcher UI
- Search and ranking
- Markdown preview
- GitHub sync with jsDelivr fallback
- Settings with configurable wake shortcut
- Tauri clipboard manager plugin
- Tauri global shortcut plugin

## Still Pending

- Manual packaged-app smoke test
- Windows packaging
- DMG issue investigation

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
