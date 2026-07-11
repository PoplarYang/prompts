# Release Guide

`pp` is released as static web artifacts plus desktop packages. Until Developer ID signing and notarization are configured, macOS ZIP is the primary distribution format and requires one manual Gatekeeper approval.

The complete macOS packaging history and troubleshooting decisions are documented in [macOS Distribution Guide](macos-distribution-guide.md).

## Build

```sh
python3 scripts/build_prompt_index.py
python3 scripts/verify_all.py
python3 scripts/package_release.py
```

The release artifact is written to:

```txt
dist/pp-v1.0.0-static.zip
```

## Contents

The zip contains:

- `prototype/`
- `sample-prompts/`
- `demo-repo-content/`
- `prompt-repo-template/`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `docs/`
- `scripts/`
- `tests/`

## Manual Smoke Test

Unzip the release, then run:

```sh
python3 -m http.server 8765
```

Open:

```txt
http://localhost:8765/prototype/
```

Verify:

- The app loads prompts.
- Search works.
- Settings default to `https://github.com/PoplarYang/prompts`.
- Copy either writes to clipboard or opens the manual fallback.

## Desktop Track

The Tauri desktop source lives under:

```txt
desktop/
```

Build the macOS `.app` bundle:

```sh
cd desktop
npm install
npm run tauri build -- --bundles app
cd ..
python3 scripts/package_desktop.py
python3 scripts/verify_desktop_package.py
# Windows CI equivalent:
python3 scripts/verify_windows_package.py path/to/pp-setup.exe
```

The macOS DMG uses `create-dmg`. Install it once before local packaging:

```sh
npm install --global create-dmg
```

Outputs:

```txt
desktop/src-tauri/target/release/bundle/macos/pp.app
dist/pp-desktop-macos-aarch64.zip
dist/pp-desktop-macos-aarch64.dmg
dist/pp-desktop-macos-x64.zip
dist/pp-desktop-macos-x64.dmg
```

GitHub Actions builds both macOS architectures: Apple Silicon on `macos-14` and Intel on `macos-15-intel`. The local package script produces the architecture of the current Mac.

The DMG uses the standard drag-and-drop layout: `pp.app` beside an `Applications` shortcut with a light background and arrow. The ZIP remains the fallback artifact; installation troubleshooting is documented in the Release notes and the app's first-launch help.

The current macOS artifacts use explicit deep ad-hoc signing but are not notarized. This is intended to avoid the “app is damaged” failure mode while keeping the expected first-launch warning: extract `pp.app`, move it to Applications, right-click it, choose Open, and allow it in Privacy & Security if prompted. If macOS still reports that it is damaged, run `xattr -cr /Applications/pp.app`. GitHub Actions verifies the ad-hoc signature and package layout; only Apple Developer ID signing and notarization can remove the manual approval step.

## Windows Desktop

Windows desktop packages are built by GitHub Actions on `windows-latest`:

```sh
cd desktop
npm ci
npm run tauri build -- --bundles nsis
```

Output in CI:

```txt
desktop/src-tauri/target/release/bundle/nsis/*.exe
```

The local macOS development machine is not currently configured for Windows packaging: it has no Windows Rust target and no NSIS/WiX tooling installed. Use the Release workflow to produce the Windows `.exe` installer.

## First GitHub Release

The repository remote is:

```txt
https://github.com/PoplarYang/prompts.git
```

Create the first release by pushing a version tag:

```sh
git add .
git commit -m "Prepare pp desktop v0.1.0 release"
git push -u origin main
git tag v0.1.0
git push origin v0.1.0
```

The `.github/workflows/release.yml` workflow builds:

- static zip
- macOS zip and DMG
- Windows NSIS `.exe`

The GitHub release is created as a draft so the generated assets can be inspected before publishing.

## Release Notes

Add bilingual release notes before pushing a version tag:

```txt
docs/release-notes/v0.1.5.md
```

The Release workflow automatically attaches `docs/release-notes/<tag>.md` to the GitHub draft release. If the file is missing, the draft is created with a short placeholder body so the notes can still be added manually before publishing.

## Desktop Smoke Test

After building and packaging:

```sh
open desktop/src-tauri/target/release/bundle/macos/pp.app
python3 scripts/verify_desktop_package.py
```

Verify in the app:

- Search filters the bundled prompt list.
- Copy writes the selected prompt body to the OS clipboard.
- Sync can load the default repository or use the jsDelivr fallback.
- The wake shortcut setting registers a valid shortcut and can focus the app window.

Current macOS smoke test status:

- Packaged app launch: passed.
- Search filtering: passed.
- OS clipboard copy: passed.
- Animated copy feedback: passed.
- Theme setting for follow system, dark, and light: passed.
- Global wake shortcut: passed with `Command+Shift+P`.
- Wake shortcut search focus: passed.
- Live GitHub sync: still requires manual/interactive verification.

Optional DMG mount check:

```sh
hdiutil attach -nobrowse -readonly dist/pp-desktop-macos-<arch>.dmg
test -x /Volumes/pp/pp.app/Contents/MacOS/pp
hdiutil detach /Volumes/pp
```
