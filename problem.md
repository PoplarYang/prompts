# pp Known Problems

## macOS full-screen wake shortcut remains unresolved

### Scope

`pp` is intended to show or hide with its configurable global shortcut even while another macOS application is in a native full-screen Space. This is not yet verified as reliable.

### Confirmed evidence

- The app's Rust handler can receive the global shortcut and run its native show/hide path. Earlier diagnostic logs recorded `native hotkey received` followed by `native launcher shown` or `native launcher hidden`.
- A later isolated test recorded only `native wake handler initialized`; the physical shortcut produced no subsequent `native hotkey received` entry. This proves that some failures occur before window display, at shortcut delivery or registration.
- The default `CommandOrControl+Shift+P` can conflict with Chrome DevTools' Command Menu shortcut when DevTools is active. It must not be treated as a universally conflict-free default.
- Earlier implementations also mixed native `NSScreenSaverWindowLevel` configuration with Tauri's JavaScript `setAlwaysOnTop`. On macOS, Tauri maps that API to `NSFloatingWindowLevel`, which can undo the higher native level required for a full-screen overlay.

### Current implementation direction

- Register and handle the wake shortcut in Rust instead of routing the critical show/hide action through a hidden WebView callback.
- Keep macOS collection behavior and window level under native control: `CanJoinAllSpaces`, `FullScreenAuxiliary`, `Transient`, `IgnoresCycle`, and `NSScreenSaverWindowLevel`.
- Decide whether to hide based on native `isKeyWindow`, not Tauri `isVisible`, because a window can be visible in another Space while not visible to the user.
- Write a local diagnostic log to `~/Library/Application Support/pp/wake.log` while this work is active. It distinguishes shortcut-delivery failures from window-display failures.

### Remaining investigation and acceptance test

The current Tauri main window is a standard `NSWindow`. Agent Island's reliable full-screen alarm uses a newly created native `NSPanel` configured before display; its persistent island does not implement a comparable global launcher shortcut. If native shortcut delivery is confirmed but a standard Tauri window still cannot appear over a full-screen app, evaluate a macOS-specific `NSPanel`-backed launcher window or plugin.

Before describing this as fixed, verify all of the following with a physical keyboard and a single running pp instance:

1. A non-conflicting configured shortcut writes `native hotkey received` to `wake.log` while another app is full-screen.
2. The same event writes a `window state` entry with the expected native level and collection behavior.
3. pp is visibly shown above the full-screen application and its search input receives focus.
4. Pressing the shortcut again hides pp without leaving it above the other application.
5. The test passes with Chrome DevTools closed and with at least one other full-screen application.

## macOS unsigned distribution

The macOS builds use explicit deep ad-hoc signing, but are not signed with an Apple Developer ID certificate and are not notarized. This should avoid the “app is damaged” failure mode, but Gatekeeper will still block or warn on the first launch until the user allows the app. A DMG drag-and-drop layout improves installation, but it cannot remove this security restriction.

## Why pp cannot always show the help dialog

If macOS blocks `pp.app` before launch, pp code is not running and cannot display an in-app dialog. Installation steps therefore live in the DMG layout, Release notes, and the macOS distribution guide. Once pp launches, the installation-help dialog can guide users who are running it from Downloads instead of Applications.

## Current macOS installation paths

- DMG: open the image and drag `pp.app` to the `Applications` shortcut.
- ZIP: extract the app and move it to `Applications` manually.
- First launch: right-click `pp.app` and choose `Open`.
- If there is no approval button in Privacy & Security, users may need to run `xattr -cr /Applications/pp.app` and then open the app again.

## DMG presentation

The DMG uses `create-dmg` to provide the familiar app-to-Applications layout. The visual layout is only an installer aid; it does not change Gatekeeper trust or replace notarization.

## DMG versus ZIP

DMG provides the familiar drag-and-drop experience, but it is still subject to Gatekeeper and can be damaged by an incomplete download. ZIP is simpler and remains the fallback distribution format.

## Future resolution

The complete solution is Apple Developer ID signing, notarization with `notarytool`, and stapling the notarization ticket. That is the only approach expected to remove manual first-launch approval for general users.
