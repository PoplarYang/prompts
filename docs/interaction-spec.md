# pp Interaction Spec

## Launcher Window

The launcher is the primary surface. It should be compact, keyboard-first, and fast.

Recommended desktop size:

```txt
width: 860px
height: 560px
```

The window should open centered and focus the search input immediately.

## Layout

```txt
┌──────────────────────────────────────────────────────────┐
│ Search prompts...                                  Sync Settings │
├──────────────────────────┬───────────────────────────────┤
│ Results                  │ Preview                       │
│                          │                               │
│ ★ Code Review Assistant  │ Code Review Assistant          │
│   审查代码风险和测试缺口   │ #coding #review                │
│                          │                               │
│ Explain Error            │ Rendered Markdown              │
│ Rewrite Clearly          │                               │
│ Summarize Article        │                               │
├──────────────────────────┴───────────────────────────────┤
│ Enter Copy   Up/Down Navigate   Cmd/Ctrl+F Favorite   Esc Close │
└──────────────────────────────────────────────────────────┘
```

## Result Item

Each result should show:

- Favorite indicator
- Title
- One-line description
- Tags
- Optional recent or usage signal

Selected result should be visually obvious without being loud.

## Preview

The preview should show:

- Title
- Description
- Tags
- Source path
- Rendered Markdown body
- Syntax-highlighted code blocks

The preview should avoid editing affordances in v0.1.

## Keyboard Shortcuts

| Shortcut | macOS | Windows | Action |
| --- | --- | --- | --- |
| Open launcher | `Cmd+Shift+P` | `Ctrl+Shift+P` | Toggle launcher |
| Copy selected prompt | `Enter` | `Enter` | Copy body to clipboard |
| Close | `Esc` | `Esc` | Close launcher |
| Next result | `Down` | `Down` | Move selection down |
| Previous result | `Up` | `Up` | Move selection up |
| Favorite | `Cmd+F` | `Ctrl+F` | Toggle favorite |
| Sync | `Cmd+R` | `Ctrl+R` | Sync repository |
| Settings | `Cmd+,` | `Ctrl+,` | Open settings |

## Empty States

### No Search Query

Show a useful default ordering:

1. Favorites
2. Recent prompts
3. Most used prompts
4. All prompts

### No Results

Show:

```txt
No prompts found
Try searching by title, tag, or content.
```

Do not show marketing copy or onboarding text in the launcher.

### No Cache

Show:

```txt
No prompts synced yet
Open settings to configure a GitHub repository, or sync the default library.
```

## Copy Feedback

After copying:

- Show a small `Copied` status for roughly 1.5 seconds.
- Keep the launcher open for v0.1.
- Update recent and usage state immediately.

Keeping the launcher open makes repeated copying easier and avoids making assumptions about the user's next action.

## Sync Feedback

Sync status should be visible but quiet:

- `Synced just now`
- `Last synced 2h ago`
- `Using offline cache`
- `Sync failed`

Detailed errors can appear in settings or diagnostics, not in the main launcher.

## Settings

Settings can be a separate view inside the same window for v0.1.

Sections:

- Repository
- Sync
- Shortcut
- Appearance
- Data

## Visual Direction

The app should look like a focused utility:

- Compact spacing
- Clear type hierarchy
- Minimal chrome
- No hero sections
- No decorative gradients
- No card-heavy dashboard
- No marketing text in the product surface

