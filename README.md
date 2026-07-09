# pp

`pp` is a lightweight, GitHub-native prompt launcher.

The current `v1.0` release is a dependency-free static app that proves the core workflow: sync prompts from a public GitHub repository, cache them locally, search them quickly, preview Markdown, and copy the selected prompt.

Default prompt repository:

```txt
https://github.com/PoplarYang/prompts
```

## Features

- Search by title, description, tags, aliases, category, path, and body.
- Preview Markdown prompt content with code blocks.
- Copy prompt body to the clipboard.
- Manual copy fallback when browser clipboard access is blocked.
- Favorites, usage count, and recent usage stored locally.
- Public GitHub repository sync.
- jsDelivr fallback when GitHub tree API is unavailable or rate-limited.
- Offline cache using browser storage.
- Settings for repository URL, branch, prompt directory, and sync-on-launch.
- Custom wake shortcut setting, ready for the native Tauri desktop track.
- Desktop theme setting for system, dark, and light modes.
- Desktop copy success feedback with a short visual affordance.
- Human-readable Markdown + YAML prompt repository format.

## Run Locally

Static prototype:

Build the bundled fallback prompt index:

```sh
python3 scripts/build_prompt_index.py
```

Start a local server:

```sh
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

Windows packages are built in GitHub Actions with `npm run tauri build -- --bundles nsis` on `windows-latest`.

## Prompt Repository

Use [prompt-repo-template](prompt-repo-template) to create a compatible prompt repository.

Expected structure:

```txt
manifest.yaml
prompts/
  coding/
    code-review.md
```

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

Copy the contents of [demo-repo-content](demo-repo-content) into the root of [PoplarYang/prompts](https://github.com/PoplarYang/prompts).

Expected structure:

```txt
README.md
manifest.yaml
prompts/
  coding/
  writing/
  personal/
```

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

`pp` v1.0 is a static open-source release. The Tauri 2 desktop track has started under [desktop](desktop): the React UI has been ported, OS clipboard/global shortcut plugins are wired, macOS `.app`, `.zip`, and `.dmg` packaging have been verified locally, and Windows packaging is configured through GitHub Actions.

## License

MIT
