# Window Behavior

## Launcher Window

The desktop app should behave like a compact command palette.

Default size:

```txt
width: 920
height: 620
```

## Open Behavior

When the wake shortcut fires:

1. If launcher is hidden, show it.
2. Center it on the currently active display when possible.
3. Focus the search input.
4. Select the first result.

If launcher is already visible:

1. Focus the search input.
2. Do not reset the query unless the user explicitly clears it.

## Close Behavior

- `Esc` with a non-empty search query clears the query.
- `Esc` with an empty search query hides the launcher.
- Losing focus should not close the window in the first desktop version.
- Copying a prompt should keep the launcher open by default.

Rationale: repeated copying is common, and auto-close can feel surprising while testing prompts.

## Copy Feedback

After copy:

- Show `Copied` for roughly 1.5 seconds.
- Update `useCount` and `lastUsedAt`.
- Keep current selection.

## Settings Window

Settings can remain a panel inside the launcher for the first desktop version.

Settings must include:

- Repository URL
- Branch
- Prompts directory
- Sync on launch
- Wake shortcut
- Theme
- Last sync status
- Sync now
- Reset defaults

## Tray/Menu

Defer tray/menu behavior until after the first Tauri desktop build.

