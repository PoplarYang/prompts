# Sync Behavior

## Goal

Sync public Markdown prompt repositories reliably without requiring Git or GitHub authentication.

## Repository Assumptions

- Public GitHub repository.
- `manifest.yaml` at repository root is optional.
- Prompt files live under configured `promptsDir`.
- Prompt files are Markdown with optional YAML frontmatter.

## Sync Order

1. Try GitHub tree API for file listing.
2. If GitHub tree API fails, try jsDelivr flat file listing.
3. For raw file content, try `raw.githubusercontent.com`.
4. If raw GitHub fetch fails, try `cdn.jsdelivr.net`.
5. Parse all prompt files.
6. Replace local cache only if parsing succeeds with at least one prompt.
7. If sync fails, keep existing cache.
8. If no cache exists, fall back to bundled prompts.

## Failure Handling

Sync failure should never make the app unusable.

Show a concise status:

```txt
Sync failed: <reason>
```

Keep details in logs for the native desktop app.

## Cache Validity

A cache is valid when:

- it contains at least one prompt
- every prompt has `id`, `title`, `path`, and `body`
- prompt body does not include YAML frontmatter

## Offline Behavior

Startup order:

1. Load local synced cache if present.
2. Otherwise load bundled fallback index.
3. If `syncOnLaunch` is true, sync in the background.
4. Failed background sync should not replace current data.

## Security Boundary

- No private repository token support in the first desktop version.
- No prompt editing.
- No git push.
- No arbitrary local file system browsing.

