# pp

`pp` is a lightweight, GitHub-native prompt launcher.

The current release includes a Tauri 2 desktop app for macOS and Windows, plus the original dependency-free static prototype. It can sync prompts from a public GitHub repository, cache them locally for offline use, search quickly, preview Markdown, and copy the selected prompt.

Default prompt repository:

```txt
https://github.com/PoplarYang/prompts
```

## Features

- Search by title, description, tags, aliases, path, and body.
- Fuzzy search plus `#tag`, `fav:`, and `recent:` filters.
- Highlight search matches in result metadata and Markdown body content.
- Preview Markdown prompt content with code blocks.
- Copy prompt body to the clipboard.
- Manual copy fallback when browser clipboard access is blocked.
- Favorites, favorite pinning, usage count, and recent usage stored locally.
- Smart, relevance, recent, favorites, and most-used desktop list modes.
- Public GitHub repository sync.
- jsDelivr fallback when GitHub tree API is unavailable or rate-limited.
- Offline cache using browser storage.
- Settings for repository URL, branch, prompt directory, and sync-on-launch.
- Custom wake shortcut in the desktop app.
- Always-on-top setting with click-outside-to-hide behavior when disabled.
- Desktop theme setting for system, dark, and light modes.
- Desktop language setting for system, Chinese, and English.
- Desktop copy success feedback with a short visual affordance.
- Human-readable Markdown + YAML prompt repository format.

## Run Locally

Static prototype:

```sh
python3 scripts/build_prompt_index.py
python3 -m http.server 8765
```

Open:

```txt
http://localhost:8765/prototype/
```

Desktop app:

```sh
cd desktop
npm install
npm run build
npm run tauri build -- --bundles app
cd ..
python3 scripts/package_desktop.py
```

Current verified macOS desktop outputs:

```txt
desktop/src-tauri/target/release/bundle/macos/pp.app
dist/pp-desktop-macos-<arch>.zip
dist/pp-desktop-macos-<arch>.dmg
```

## Verify

Run all checks:

```sh
python3 scripts/verify_all.py
```

This runs:

- prompt index generation
- parser and ranking tests
- v0.1 baseline checks
- v0.2 GitHub sync artifact checks
- v1.0 release readiness checks
- desktop Tauri source checks

## Package

Create the static release zip:

```sh
python3 scripts/package_release.py
```

Output:

```txt
dist/pp-v1.0.0-static.zip
```

Create the macOS desktop distribution artifacts after building the Tauri app:

```sh
python3 scripts/package_desktop.py
python3 scripts/verify_desktop_package.py
```

Outputs:

```txt
dist/pp-desktop-macos-<arch>.zip
dist/pp-desktop-macos-<arch>.dmg
```

The current desktop artifacts are unsigned and not notarized, so macOS may show a security prompt when opening them outside this development machine.

Windows packages are built in GitHub Actions with:

```sh
npm run tauri build -- --bundles nsis
```

## Prompt Repository

The default prompt repository content lives at the root of this repository:

```txt
manifest.yaml
prompts/
  coding/
    code-review.md
    explain-error.md
  writing/
    rewrite-clearly.md
    summarize-article.md
  personal/
    weekly-review.md
```

Use [prompt-repo-template](prompt-repo-template) to create another compatible prompt repository.

Prompt example:

````md
---
title: Code Review Assistant
description: Review code for bugs, regressions, missing tests, and maintainability issues
tags: [coding, review]
category: coding
aliases: [cr, review code]
---

You are a strict but friendly senior engineer.

Review the following code:

```txt
{{code}}
```
````

Full spec: [docs/prompt-repository-spec.md](docs/prompt-repository-spec.md)

## Demo Repository Content

The same sample content is also available under [demo-repo-content](demo-repo-content) for testing sync behavior.

## Screenshots

![pp launcher](docs/assets/pp-launcher.png)

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Prompt Repository Spec](docs/prompt-repository-spec.md)
- [Interaction Spec](docs/interaction-spec.md)
- [MVP Build Plan](docs/mvp-build-plan.md)
- [v0.1 Acceptance Checklist](docs/v0.1-acceptance.md)
- [v0.2 Acceptance Checklist](docs/v0.2-acceptance.md)
- [v1.0 Acceptance Checklist](docs/v1.0-acceptance.md)
- [Desktop Architecture Decision](docs/desktop-architecture-decision.md)
- [Desktop Development Prerequisites](docs/desktop-prerequisites.md)
- [Tauri Migration Plan](docs/tauri-migration-plan.md)
- [Custom Wake Shortcut Spec](docs/custom-shortcut-spec.md)
- [Release Guide](docs/release.md)

## Status

`pp` includes the original static open-source app and the Tauri 2 desktop app. Desktop `0.1.1` has been verified locally on macOS, with Windows packaging configured through GitHub Actions. Current desktop artifacts are unsigned and not notarized.

## License

MIT
