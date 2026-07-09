# Desktop v0.1 Plan

Desktop v0.1 is the first native Tauri build.

## Current Status

Packaged and partially verified:

- `desktop/` Tauri 2 project exists.
- Vite + React + TypeScript UI exists.
- Static launcher UI has been ported to React.
- Public GitHub/jsDelivr sync logic has been ported to TypeScript.
- Wake shortcut setting exists in UI/config.
- Tauri global shortcut plugin is installed and initialized.
- Tauri clipboard manager plugin is installed and initialized.
- `npm run build` passes.
- `cargo check` passes.
- macOS app bundle succeeds with:

```sh
npm run tauri build -- --bundles app
```
- macOS distribution artifacts can be generated with:

```sh
python3 scripts/package_desktop.py
python3 scripts/verify_desktop_package.py
```

Current macOS outputs:

```txt
desktop/src-tauri/target/release/bundle/macos/pp.app
dist/pp-desktop-macos-aarch64.zip
dist/pp-desktop-macos-aarch64.dmg
```
- GUI smoke test passed for launch, search, OS clipboard copy, animated copy feedback, theme switching, and global wake shortcut focus in the packaged macOS app.

Still to verify with interactive GUI access:

- GitHub sync works in packaged app network context.
- Windows build and installer.

## Scope

- Tauri 2 app under `desktop/`.
- Vite + React + TypeScript UI.
- Rust native shell.
- Bundled prompt index.
- Search and preview.
- OS clipboard copy.
- Local config and cache files.
- Configurable global wake shortcut.
- Manual GitHub sync with jsDelivr fallback.

## Acceptance Criteria

- `desktop` app launches locally.
- Launcher opens centered.
- Search input is focused on launch.
- Prompt search and preview match static v1.0 behavior.
- Copy writes to OS clipboard.
- Copy shows a short visible success affordance.
- Wake shortcut opens/focuses the launcher.
- Wake shortcut focuses the search input.
- Wake shortcut can be changed in settings.
- Theme can be set to follow system, dark, or light.
- Invalid shortcut does not overwrite previous working shortcut.
- Public GitHub sync works or falls back without breaking local cache.
- App can be bundled on the current development platform.
- macOS zip and DMG artifacts can be generated from the packaged app.

## Commands To Target

Exact commands may change after scaffold, but target shape:

```sh
cd desktop
npm install
npm run dev
npm run tauri build
python3 scripts/package_desktop.py
```

Do not run these until [Desktop Development Prerequisites](desktop-prerequisites.md) pass.

## Open Questions

- Use npm, pnpm, or bun?
- Use React only, or add a component library?
- Should copy close the window after desktop users test the first build?
- Should tray/menu be included in desktop v0.1 or deferred?
