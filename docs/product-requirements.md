# pp Product Requirements

## Summary

`pp` is a cross-platform desktop prompt launcher for macOS and Windows. It syncs prompts from a GitHub repository into an offline local cache, then lets the user quickly search, preview, and copy prompts with a global shortcut.

## Target User

The first target user is an individual power user who uses prompts across ChatGPT, Claude, Cursor, Codex, browsers, email, messaging tools, and other writing or coding surfaces.

The product should also be suitable for future open-source use by other individuals who want a file-based, GitHub-native prompt workflow.

## Positioning

`pp` should feel closer to Raycast or Alfred than to Notion or Obsidian.

It should be:

- Fast
- Small
- Keyboard-first
- Local-first
- GitHub-native
- Read-only in the first version

## Core User Flow

1. User presses the global shortcut.
2. `pp` opens a compact launcher window.
3. User types a keyword.
4. Matching prompts appear immediately.
5. User previews the selected prompt.
6. User presses Enter.
7. `pp` copies the prompt body to the clipboard.
8. User pastes it into the target app.

## Primary Jobs To Be Done

- When I am working in any app, I want to quickly retrieve a known prompt, so I do not need to search through files, notes, or browser bookmarks.
- When I am choosing a prompt, I want to preview it with readable formatting and code highlighting, so I can confirm it is the right one before copying.
- When I am offline or GitHub is unavailable, I want my previous prompt library to keep working.
- When I add or edit prompts in GitHub, I want the desktop app to sync those changes without manual file management.

## MVP Features

### Launcher

- Global shortcut opens or hides the launcher.
- Default shortcut: `Cmd+Shift+P` on macOS and `Ctrl+Shift+P` on Windows.
- Launcher should focus the search input immediately.
- Escape closes the launcher.

### Search

Search should match:

- Title
- Description
- Tags
- Category
- Body
- File path

Search results should prioritize:

1. Exact title or alias match
2. Favorite prompts
3. Recently used prompts
4. High usage count
5. Body matches

### Preview

- Render Markdown.
- Highlight fenced code blocks.
- Show title, description, tags, and source path.
- Keep the preview readable but compact.

### Copy

- Enter copies the selected prompt body.
- Copied content excludes YAML frontmatter.
- Copied content preserves Markdown source text.
- Copy action updates `lastUsedAt` and `useCount`.

### GitHub Sync

- App includes a default prompt repository URL.
- User can configure a custom repository URL.
- User can configure branch and prompt directory.
- App syncs on launch when enabled.
- App supports manual sync.
- Failed sync should not break local usage.
- App should clearly show last sync time and offline cache status.

### Local Cache

- Prompts should be usable offline.
- Parsed prompt metadata should be indexed locally.
- User state such as favorites and usage count should be stored separately from synced prompt files.

### Settings

Settings should include:

- Repository URL
- Branch
- Prompt directory
- Global shortcut
- Custom wake shortcut
- Sync on launch
- Theme
- Local cache path
- Clear cache
- Rebuild index

## Non-Goals

These should not be included in the first version:

- Prompt editing inside the app
- Git commit or push
- Merge conflict handling
- User accounts
- Hosted backend
- Team permissions
- AI prompt optimization
- Prompt variable forms
- Automatic paste into active app

## Product Principles

### Speed Before Completeness

The main flow should feel instant. Anything that slows down search or copy should be deferred.

### Files Before Databases

The source format should stay human-readable and Git-friendly.

### Read-Only First

The first version reads from GitHub and copies to clipboard. Editing can be considered later only after the sync model proves stable.

### Quiet UI

The app should not feel like a landing page or dashboard. It should feel like a focused utility.

## Open Questions

- Should the default prompt repository be bundled into the app or hosted on GitHub only?
- Should private GitHub repositories be supported in v0.1, or deferred?
- Should prompts support aliases for faster search?
- Should the app support multiple prompt repositories later?
- Should copying include optional frontmatter-derived context, such as title comments?
