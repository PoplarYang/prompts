# Changelog

## Desktop 0.1.6

- Changed macOS distribution guidance to ZIP-first installation with manual Gatekeeper approval.
- Added separate Apple Silicon and Intel macOS release artifacts.
- Added local and GitHub Actions package integrity checks.

## Desktop 0.1.5

- Added optional variable filling before copying prompts.
- Added source filtering for all, GitHub, and local prompts.
- Added a local folder chooser for local prompt libraries.
- Added one-click open for original GitHub Markdown pages or local Markdown files.
- Added a local prompt template demo for generating and validating prompt Markdown.

## Desktop 0.1.4

- Added local folder prompt source for offline and private prompt libraries.
- Kept GitHub and local prompt caches separate so the two sources do not overwrite each other.
- Added GitHub/local source icons on prompt rows and detail metadata.
- Added automatic update checks on app launch and a manual update check in settings.

## Desktop 0.1.3

- Updated the desktop app icon with the selected bright rounded `pp` mark.
- Added an editable SVG icon source and regenerated macOS, Windows, and PNG icon assets.

## Desktop 0.1.2

- Fixed Windows release build by compiling macOS Dock reopen handling only on macOS.

## Desktop 0.1.1

- Added enhanced search across title, description, tags, aliases, path, and body.
- Added fuzzy matching, `#tag`, `fav:`, and `recent:` search filters.
- Added search highlighting in result titles, descriptions, tags, Markdown body, lists, and code blocks.
- Added smart, relevance, recent, favorites, and most-used list modes.
- Added favorite pinning, recent usage, and usage-count display.
- Added theme setting for system, dark, and light modes.
- Added language setting for system, Chinese, and English UI.
- Added always-on-top setting and click-outside-to-hide behavior when disabled.
- Improved global shortcut behavior so it can wake and hide the launcher.
- Improved copy feedback and hides the launcher after copying.
- Improved settings layout for smaller windows.
- Fixed selection stability when toggling favorites.
- Fixed macOS Dock/app icon reopen behavior.
- Bumped desktop package version to `0.1.1`.

## 1.0.2

- Added configurable wake shortcut setting to the static settings model.
- Documented the Tauri 2 desktop architecture decision and custom global shortcut behavior.

## 1.0.1

- Added jsDelivr fallback for public GitHub sync when GitHub tree API returns 403 or is otherwise unavailable.
- Added static asset cache busting so browser refreshes pick up sync fixes.

## 1.0.0

- Added dependency-free static `pp` app.
- Added default GitHub prompt repository support for `https://github.com/PoplarYang/prompts`.
- Added settings for repository URL, branch, prompt directory, and sync-on-launch.
- Added public GitHub sync, Markdown/frontmatter parsing, and offline local cache.
- Added search, ranking, Markdown preview, favorites, usage count, recent usage, copy, and manual copy fallback.
- Added demo prompt repository content.
- Added prompt repository template.
- Added verification scripts and open-source project documentation.

## 0.2.0

- Added GitHub sync settings and local cache.
- Added demo repo content for `PoplarYang/prompts`.

## 0.1.0

- Added local prompt index generation.
- Added launcher UI, search, preview, favorites, keyboard navigation, and copy behavior.
