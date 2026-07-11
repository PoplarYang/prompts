# pp macOS Distribution Guide

This document records the working macOS distribution approach for pp when an Apple Developer account is not available.

## Target User Experience

The goal is not to make macOS fully trust the app. That requires Developer ID signing and notarization. The practical free target is:

```text
download
-> open a standard drag-and-drop DMG
-> move pp to Applications
-> right-click Open once
-> allow pp in Privacy & Security if macOS asks
```

The expected message is an unidentified-developer/security warning, not “pp is damaged”.

## Packaging Decisions

- Sign the complete app explicitly with deep ad-hoc signing:

  ```sh
  codesign --force --deep --sign - --timestamp=none pp.app
  codesign --verify --deep --strict pp.app
  ```

- Use `create-dmg` for the DMG. Its default layout provides the familiar `pp.app -> Applications` presentation, including the background and arrow.
- Keep ZIP as a fallback because it is simpler to download and extract.
- Do not describe ad-hoc signing as notarization. The app still needs one manual first-launch approval.

## Local Build

Install the DMG tool once:

```sh
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm install --global create-dmg
```

Build and package:

```sh
cd desktop
npm ci
npm run tauri build -- --bundles app
cd ..
python3 scripts/package_desktop.py
python3 scripts/verify_desktop_package.py
```

`scripts/package_desktop.py` performs the ad-hoc signing before producing the ZIP and DMG.

## Required Verification

Local verification should cover:

```sh
codesign -dv --verbose=4 desktop/src-tauri/target/release/bundle/macos/pp.app
python3 scripts/verify_all.py
```

Expected signature output includes:

```text
Signature=adhoc
TeamIdentifier=not set
```

The DMG should be mounted and checked for:

```text
pp.app
Applications (alias)
```

CI additionally checks both Apple Silicon and Intel builds, package contents, executable permissions, Mach-O format, Bundle ID, ad-hoc signature, and DMG layout.

## GitHub Actions

The Release workflow uses:

- `macos-14` for Apple Silicon.
- `macos-15-intel` for Intel.
- `create-dmg` installed on each macOS runner.
- Explicit deep ad-hoc signing before packaging.
- DMG mounting to a temporary directory for layout validation.

The release is created as a draft. A release is complete only when all matrix jobs and `Publish GitHub release` are successful and the GitHub draft contains both macOS architectures plus Windows and static assets.

## Why a Previous Validation Failed

The build and packages were successful, but the validation attempted to parse the output of `hdiutil attach -nomount -plist` with `PlistBuddy` to discover a device path. GitHub's macOS runner returned a plist shape that did not contain the expected entry:

```text
Cannot parse a NULL or zero-length data
```

The fix was to avoid device-number parsing and mount directly with:

```sh
hdiutil attach -nobrowse -readonly -mountpoint "$mountpoint" pp.dmg
```

This is simpler and matches the actual validation goal.

## First Launch Instructions

1. Download the ZIP or DMG for the Mac architecture.
2. If using DMG, drag pp to Applications.
3. Right-click pp in Applications and choose Open.
4. If macOS shows a security warning, allow pp in System Settings -> Privacy & Security.
5. If it still reports that the app is damaged, run:

   ```sh
   xattr -cr /Applications/pp.app
   open /Applications/pp.app
   ```

The command is a troubleshooting fallback, not an automatic installer action.

## Future Upgrade

Developer ID signing, notarization with `notarytool`, and stapling the ticket remain the only way to remove the manual approval step for general users. Until then, keep the ad-hoc signature, clear release notes, DMG layout, ZIP fallback, and CI verification together.
