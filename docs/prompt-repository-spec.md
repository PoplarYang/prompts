# pp Prompt Repository Spec

## Goals

The prompt repository format should be:

- Human-readable
- Git-friendly
- Easy to edit on GitHub
- Easy to parse locally
- Suitable for Markdown preview
- Stable enough for future open-source users

## Repository Structure

Recommended structure:

```txt
prompt-repo/
  manifest.yaml
  prompts/
    coding/
      code-review.md
      explain-error.md
    writing/
      rewrite-clearly.md
      summarize.md
    personal/
      weekly-review.md
```

Only Markdown files under the configured prompts directory are treated as prompts.

## Manifest

`manifest.yaml` is optional in v0.1, but recommended.

```yaml
name: My Prompt Library
version: 1
default_locale: zh-CN
prompts_dir: prompts
```

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `name` | No | Display name for the prompt library. |
| `version` | No | Repository spec version. Defaults to `1`. |
| `default_locale` | No | Preferred language or locale. |
| `prompts_dir` | No | Directory containing prompt Markdown files. Defaults to `prompts`. |

## Prompt File Format

Each prompt is a Markdown file with optional YAML frontmatter.

````md
---
title: Code Review Assistant
description: 审查代码风险、回归问题和测试缺口
tags: [coding, review]
category: coding
aliases: [cr, review code]
---

你是一名严格但友好的 senior engineer。

请审查下面的代码，优先指出：
- bug
- 行为回归风险
- 缺失测试
- 可维护性问题

代码如下：

```ts
{{code}}
```
````

## Frontmatter Fields

| Field | Required | Description |
| --- | --- | --- |
| `title` | No | Display title. If omitted, derive from file name. |
| `description` | No | Short description shown in results. |
| `tags` | No | List of searchable tags. |
| `category` | No | Single category used for grouping. |
| `aliases` | No | Search aliases or abbreviations. |
| `language` | No | Main language of the prompt content. |
| `updated_at` | No | User-maintained update date. |

## Prompt ID

For v0.1, the prompt ID should be derived from the repository-relative file path.

Example:

```txt
prompts/coding/code-review.md
```

ID:

```txt
prompts/coding/code-review.md
```

This keeps IDs stable as long as files are not moved. A future version may support an explicit `id` field.

## Copy Behavior

When copied, `pp` copies only the Markdown body after frontmatter.

The copied text should preserve:

- Markdown syntax
- Code fences
- Lists
- Headings
- Template placeholders such as `{{code}}`

The copied text should not include:

- YAML frontmatter
- App-specific metadata
- Rendered HTML

## Invalid Files

If a Markdown file cannot be parsed:

- It should not crash the app.
- It should appear in sync diagnostics.
- Other prompts should remain usable.

## Future Extensions

Potential future fields:

```yaml
id: code-review-assistant
model_hint: gpt-5
source_url: https://example.com
license: MIT
variables:
  - name: code
    label: Code
    type: textarea
```

Variable support should be deferred until after the first version.

