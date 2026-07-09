# Custom Wake Shortcut Spec

## Goal

Users can customize the global shortcut that wakes the `pp` launcher.

## Default

| Platform | Default |
| --- | --- |
| macOS | `CommandOrControl+Shift+P` |
| Windows | `CommandOrControl+Shift+P` |

`CommandOrControl` maps to Command on macOS and Control on Windows.

## Settings

Add a setting:

```ts
type AppConfig = {
  wakeShortcut: string;
};
```

Default:

```txt
CommandOrControl+Shift+P
```

## User Flow

1. User opens Settings.
2. User focuses the wake shortcut field.
3. User presses the desired key combination.
4. App validates the shortcut.
5. App unregisters the previous shortcut.
6. App registers the new shortcut.
7. App persists the shortcut only after successful registration.

## Validation Rules

- Must include at least one modifier: `CommandOrControl`, `Command`, `Control`, `Alt`, `Option`, or `Shift`.
- Must include one non-modifier key.
- Must not be only a text key such as `P`.
- Must reject known reserved shortcuts when registration fails.
- Must keep the previous working shortcut if the new shortcut cannot be registered.

## Tauri Implementation Notes

Use the Tauri global shortcut plugin:

- Register the shortcut at app startup.
- Re-register when settings change.
- On trigger, show and focus the launcher window.

The Tauri docs show registration through JavaScript:

```ts
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

await unregister(previousShortcut);
await register(nextShortcut, () => {
  // show and focus launcher
});
```

Source: [Tauri Global Shortcut](https://v2.tauri.app/plugin/global-shortcut/)

## Static Prototype Behavior

The current static browser app can store the setting but cannot register an OS-level global shortcut. The field exists so the setting model and UI are ready for the Tauri desktop migration.

