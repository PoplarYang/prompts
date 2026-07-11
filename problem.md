# pp Known Problems

## macOS unsigned distribution

The macOS builds are not signed with an Apple Developer ID certificate and are not notarized. Gatekeeper may block the first launch. A DMG drag-and-drop layout improves installation, but it cannot remove this security restriction.

## Why pp cannot always show the help dialog

If macOS blocks `pp.app` before launch, pp code is not running and cannot display an in-app dialog. The DMG therefore includes `README-MACOS.txt` with installation and troubleshooting steps. Once pp launches, a future onboarding dialog can guide users who are running it from Downloads instead of Applications.

## Current macOS installation paths

- DMG: open the image and drag `pp.app` to the `Applications` shortcut.
- ZIP: extract the app and move it to `Applications` manually.
- First launch: right-click `pp.app` and choose `Open`.
- If there is no approval button in Privacy & Security, users may need to run `xattr -cr /Applications/pp.app` and then open the app again.

## DMG versus ZIP

DMG provides the familiar drag-and-drop experience, but it is still subject to Gatekeeper and can be damaged by an incomplete download. ZIP is simpler and remains the fallback distribution format.

## Future resolution

The complete solution is Apple Developer ID signing, notarization with `notarytool`, and stapling the notarization ticket. That is the only approach expected to remove manual first-launch approval for general users.
