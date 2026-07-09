# Contributing to pp

Thanks for helping make `pp` better.

## Project Shape

The current `v1.0` release is a dependency-free static web app that proves the prompt launcher workflow:

- GitHub prompt repository sync
- Offline local cache
- Search and ranking
- Markdown preview
- Copy-to-clipboard with a manual fallback

The native Tauri desktop shell is planned after this static release.

## Local Setup

Build the bundled prompt index:

```sh
python3 scripts/build_prompt_index.py
```

Run all verification checks:

```sh
python3 scripts/verify_all.py
```

Start the local app:

```sh
python3 -m http.server 8765
```

Open:

```txt
http://localhost:8765/prototype/
```

## Prompt Repository Format

See [docs/prompt-repository-spec.md](docs/prompt-repository-spec.md).

The shortest compatible repo looks like this:

```txt
manifest.yaml
prompts/
  coding/
    code-review.md
```

## Change Guidelines

- Keep the app dependency-free until the native desktop shell is introduced.
- Preserve offline behavior when adding sync features.
- Keep prompt files human-readable and Git-friendly.
- Add or update verification scripts for parser, ranking, sync, or UI contract changes.
- Avoid adding local prompt editing until sync conflict behavior is designed.

## Pull Request Checklist

- `python3 scripts/build_prompt_index.py`
- `python3 scripts/verify_all.py`
- README or docs updated when behavior changes
- Screenshots updated for visible UI changes

