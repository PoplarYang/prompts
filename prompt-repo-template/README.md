# pp prompt repository template

Use this template to create a GitHub prompt repository compatible with `pp`.

## Structure

```txt
manifest.yaml
prompts/
  coding/
    code-review.md
```

## Prompt Files

Each prompt is a Markdown file with optional YAML frontmatter.

```md
---
title: Code Review Assistant
description: Review code for bugs, regressions, missing tests, and maintainability issues
tags: [coding, review]
category: coding
aliases: [cr, review code]
---

You are a strict but friendly senior engineer.

Review the following code.
```

