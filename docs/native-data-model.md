# Native Data Model

## Storage Roots

Desktop `pp` should store runtime data in the platform app data directory exposed by Tauri.

Suggested layout:

```txt
pp/
  config.json
  cache/
    prompts.json
    raw/
      manifest.yaml
      prompts/
  state.json
  logs/
    sync.log
```

## Config

`config.json`

```ts
type AppConfig = {
  repoUrl: string;
  branch: string;
  promptsDir: string;
  syncOnLaunch: boolean;
  wakeShortcut: string;
  theme: "system" | "light" | "dark";
};
```

Default:

```json
{
  "repoUrl": "https://github.com/PoplarYang/prompts",
  "branch": "main",
  "promptsDir": "prompts",
  "syncOnLaunch": false,
  "wakeShortcut": "CommandOrControl+Shift+P",
  "theme": "system"
}
```

## Prompt Index Cache

`cache/prompts.json`

```ts
type PromptIndex = {
  library: {
    name: string;
    version: number;
    default_locale?: string;
    prompts_dir: string;
    repo?: string;
    branch?: string;
  };
  generated_at: string;
  source: "github" | "jsdelivr" | "bundled" | "cache";
  prompts: Prompt[];
  errors: SyncError[];
};
```

## Prompt

```ts
type Prompt = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  aliases: string[];
  path: string;
  body: string;
};
```

## Local State

`state.json`

```ts
type LocalState = {
  prompts: Record<
    string,
    {
      favorite: boolean;
      useCount: number;
      lastUsedAt: string | null;
    }
  >;
};
```

## Write Rules

- Config changes should be atomic: write temp file, then rename.
- Prompt cache should only replace the previous cache after a successful sync and parse.
- Local state can update immediately after copy/favorite changes.
- If config is invalid, keep defaults and surface a settings warning.

## Migration From Static Prototype

The static prototype stores data in browser `localStorage`. Desktop migration does not need to import that data automatically. Treat desktop as a new app data root.

