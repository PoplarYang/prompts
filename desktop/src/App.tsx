import { useEffect, useMemo, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isRegistered, register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

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

type PromptIndex = {
  library?: {
    name?: string;
    version?: number;
    default_locale?: string;
    prompts_dir?: string;
    repo?: string;
    branch?: string;
  };
  generated_at?: string;
  source?: string;
  prompts: Prompt[];
  errors?: Array<{ path: string; error: string }>;
};

type AppConfig = {
  repoUrl: string;
  branch: string;
  promptsDir: string;
  syncOnLaunch: boolean;
  wakeShortcut: string;
  themeMode: "system" | "dark" | "light";
};

type PromptState = {
  favorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
};

type LocalState = {
  prompts: Record<string, PromptState>;
};

const defaultConfig: AppConfig = {
  repoUrl: "https://github.com/PoplarYang/prompts",
  branch: "main",
  promptsDir: "prompts",
  syncOnLaunch: false,
  wakeShortcut: "CommandOrControl+Shift+P",
  themeMode: "system",
};

const fallbackIndex: PromptIndex = {
  library: {
    name: "pp Bundled Prompt Library",
    version: 1,
    default_locale: "zh-CN",
    prompts_dir: "prompts",
  },
  generated_at: "",
  source: "bundled",
  prompts: [
    {
      id: "prompts/coding/code-review.md",
      title: "Code Review Assistant",
      description: "审查代码风险、回归问题和测试缺口",
      tags: ["coding", "review"],
      category: "coding",
      aliases: ["cr", "review code"],
      path: "prompts/coding/code-review.md",
      body:
        "你是一名严格但友好的 senior engineer。\n\n请审查下面的代码，优先指出：\n\n- bug\n- 行为回归风险\n- 缺失测试\n- 可维护性问题\n\n请按严重程度排序，并给出具体文件、行号和修改建议。\n\n代码如下：\n\n```ts\n{{code}}\n```\n",
    },
    {
      id: "prompts/coding/explain-error.md",
      title: "Explain Error",
      description: "解释报错原因并给出排查路径",
      tags: ["coding", "debug"],
      category: "coding",
      aliases: ["debug", "error"],
      path: "prompts/coding/explain-error.md",
      body:
        "请帮我解释下面的报错。\n\n请包含：\n\n- 这个错误通常意味着什么\n- 最可能的 3 个原因\n- 如何一步步排查\n- 如果需要修改代码，给出最小修改建议\n\n报错信息：\n\n```txt\n{{error}}\n```\n\n相关代码：\n\n```txt\n{{code}}\n```\n",
    },
    {
      id: "prompts/writing/rewrite-clearly.md",
      title: "Rewrite Clearly",
      description: "把一段文字改得更清楚、更自然",
      tags: ["writing", "rewrite"],
      category: "writing",
      aliases: ["polish", "clarify"],
      path: "prompts/writing/rewrite-clearly.md",
      body:
        "请把下面这段文字改写得更清楚、更自然。\n\n要求：\n\n- 保留原意\n- 减少废话\n- 语气友好但不夸张\n- 如果逻辑不清楚，请顺手调整结构\n\n原文：\n\n{{text}}\n",
    },
    {
      id: "prompts/writing/summarize-article.md",
      title: "Summarize Article",
      description: "总结文章重点并提炼行动项",
      tags: ["writing", "summary"],
      category: "writing",
      aliases: ["summary", "summarize"],
      path: "prompts/writing/summarize-article.md",
      body:
        "请总结下面这篇文章。\n\n输出结构：\n\n1. 一句话概括\n2. 5 个关键观点\n3. 重要细节\n4. 可执行建议\n5. 值得继续追问的问题\n\n文章：\n\n{{article}}\n",
    },
    {
      id: "prompts/personal/weekly-review.md",
      title: "Weekly Review",
      description: "做一次个人周复盘",
      tags: ["personal", "review"],
      category: "personal",
      aliases: ["weekly", "retro"],
      path: "prompts/personal/weekly-review.md",
      body:
        "请帮我做一次本周复盘。\n\n请基于下面的记录，整理：\n\n- 本周完成了什么\n- 哪些事情推进得不顺\n- 哪些决定是重要的\n- 下周最值得优先做的 3 件事\n- 有哪些可以简化或停止的事情\n\n本周记录：\n\n{{notes}}\n",
    },
  ],
};

const configKey = "pp-desktop-config";
const stateKey = "pp-desktop-state";
const cacheKey = "pp-desktop-cache";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function getPromptState(state: LocalState, id: string): PromptState {
  return state.prompts[id] ?? { favorite: false, useCount: 0, lastUsedAt: null };
}

function scorePrompt(prompt: Prompt, query: string, local: PromptState): number {
  const q = normalize(query.trim());
  let score = 0;

  if (!q) {
    if (local.favorite) score += 140;
    if (local.lastUsedAt) score += 100;
    score += Math.min(local.useCount, 20) * 3;
    return score;
  }

  const title = normalize(prompt.title);
  const aliases = normalize(prompt.aliases.join(" "));

  if (title === q) score += 300;
  if (prompt.aliases.some((alias) => normalize(alias) === q)) score += 260;
  if (title.includes(q)) score += 180;
  if (aliases.includes(q)) score += 160;
  if (normalize(prompt.tags.join(" ")).includes(q)) score += 130;
  if (normalize(prompt.category).includes(q)) score += 110;
  if (normalize(prompt.description).includes(q)) score += 90;
  if (normalize(prompt.path).includes(q)) score += 60;
  if (normalize(prompt.body).includes(q)) score += 35;
  if (local.favorite) score += 16;
  if (local.lastUsedAt) score += 10;
  score += Math.min(local.useCount, 8);
  return score;
}

function parseGitHubRepo(url: string) {
  const match = url.trim().match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/?$/);
  if (!match) throw new Error("Use a GitHub repo URL like https://github.com/PoplarYang/prompts");
  return { owner: match[1], name: match[2].replace(/\.git$/, "") };
}

function stripSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function parseYamlValue(value: string): unknown {
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")) : [];
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value.replace(/^['"]|['"]$/g, "");
}

function parseYaml(raw: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  raw.split("\n").forEach((line) => {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes(":")) return;
    const [key, ...rest] = line.split(":");
    data[key.trim()] = parseYamlValue(rest.join(":").trim());
  });
  return data;
}

function parseFrontmatter(raw: string) {
  if (!raw.startsWith("---\n")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 4);
  if (end === -1) return { meta: {}, body: raw };
  return {
    meta: parseYaml(raw.slice(4, end).trim()),
    body: raw.slice(end + 4).replace(/^\n/, ""),
  };
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)];
}

function titleFromPath(path: string): string {
  return path
    .split("/")
    .pop()!
    .replace(/\.md$/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryFromPath(path: string, promptsDir: string): string {
  const parts = path.split("/");
  const rootIndex = parts.indexOf(promptsDir);
  return parts[rootIndex + 1] || "";
}

async function listPromptFilesFromGitHub(repo: { owner: string; name: string }, branch: string, promptRoot: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!response.ok) throw new Error(`GitHub tree request returned ${response.status}`);
  const tree = await response.json();
  return (tree.tree || [])
    .filter((item: { type: string; path: string }) => item.type === "blob")
    .filter((item: { path: string }) => item.path.startsWith(`${promptRoot}/`) && item.path.endsWith(".md"))
    .map((item: { path: string }) => item.path)
    .sort();
}

async function listPromptFilesFromJsDelivr(repo: { owner: string; name: string }, branch: string, promptRoot: string) {
  const response = await fetch(
    `https://data.jsdelivr.com/v1/package/gh/${repo.owner}/${repo.name}@${encodeURIComponent(branch)}/flat`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`jsDelivr file list returned ${response.status}`);
  const data = await response.json();
  return (data.files || [])
    .map((file: { name?: string }) => String(file.name || "").replace(/^\/+/, ""))
    .filter((path: string) => path.startsWith(`${promptRoot}/`) && path.endsWith(".md"))
    .sort();
}

async function fetchRawFile(repo: { owner: string; name: string }, branch: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const githubUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${encodeURIComponent(branch)}/${encodedPath}`;
  const githubResponse = await fetch(githubUrl, { cache: "no-store" });
  if (githubResponse.ok) return githubResponse.text();

  const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.name}@${encodeURIComponent(branch)}/${encodedPath}`;
  const jsdelivrResponse = await fetch(jsdelivrUrl, { cache: "no-store" });
  if (!jsdelivrResponse.ok) throw new Error(`Raw file request failed for ${path}`);
  return jsdelivrResponse.text();
}

async function syncPrompts(config: AppConfig): Promise<PromptIndex> {
  const repo = parseGitHubRepo(config.repoUrl);
  const promptRoot = stripSlashes(config.promptsDir || "prompts");

  let paths: string[];
  try {
    paths = await listPromptFilesFromGitHub(repo, config.branch, promptRoot);
  } catch {
    paths = await listPromptFilesFromJsDelivr(repo, config.branch, promptRoot);
  }

  if (!paths.length) throw new Error(`No Markdown prompts found under ${promptRoot}/`);

  let manifest: Record<string, unknown> = {};
  try {
    manifest = parseYaml(await fetchRawFile(repo, config.branch, "manifest.yaml"));
  } catch {
    manifest = {};
  }

  const prompts = await Promise.all(
    paths.map(async (path) => {
      const raw = await fetchRawFile(repo, config.branch, path);
      const { meta, body } = parseFrontmatter(raw);
      const typedMeta = meta as Record<string, unknown>;
      return {
        id: path,
        title: String(typedMeta.title || titleFromPath(path)),
        description: String(typedMeta.description || ""),
        tags: normalizeList(typedMeta.tags),
        category: String(typedMeta.category || categoryFromPath(path, promptRoot)),
        aliases: normalizeList(typedMeta.aliases),
        path,
        body: body.trimEnd() + "\n",
      };
    }),
  );

  return {
    library: {
      name: String(manifest.name || `${repo.owner}/${repo.name}`),
      version: Number(manifest.version || 1),
      default_locale: String(manifest.default_locale || ""),
      prompts_dir: promptRoot,
      repo: `${repo.owner}/${repo.name}`,
      branch: config.branch,
    },
    generated_at: new Date().toISOString(),
    source: "github",
    prompts,
    errors: [],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(markdown: string): string {
  const codeBlocks: Array<{ lang: string; code: string }> = [];
  let html = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = "", code) => {
    const token = `@@CODE_${codeBlocks.length}@@`;
    codeBlocks.push({ lang, code });
    return token;
  });

  html = escapeHtml(html);
  const segments: string[] = [];
  let list: string[] = [];
  let orderedList: string[] = [];

  function flushLists() {
    if (list.length) {
      segments.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      list = [];
    }
    if (orderedList.length) {
      segments.push(`<ol>${orderedList.map((item) => `<li>${item}</li>`).join("")}</ol>`);
      orderedList = [];
    }
  }

  html.split("\n").forEach((line) => {
    if (/^@@CODE_\d+@@$/.test(line.trim())) {
      flushLists();
      const index = Number(line.trim().match(/\d+/)![0]);
      const block = codeBlocks[index];
      segments.push(`<pre><code data-lang="${escapeHtml(block.lang)}">${escapeHtml(block.code.trim())}</code></pre>`);
      return;
    }
    const unordered = line.match(/^- (.*)$/);
    if (unordered) {
      orderedList = [];
      list.push(unordered[1]);
      return;
    }
    const ordered = line.match(/^\d+\. (.*)$/);
    if (ordered) {
      list = [];
      orderedList.push(ordered[1]);
      return;
    }
    flushLists();
    if (line.trim()) segments.push(`<p>${line}</p>`);
  });

  flushLists();
  return segments.join("");
}

function App() {
  const [config, setConfig] = useState<AppConfig>(() => loadJson(configKey, defaultConfig));
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config);
  const [localState, setLocalState] = useState<LocalState>(() => loadJson(stateKey, { prompts: {} }));
  const [promptIndex, setPromptIndex] = useState<PromptIndex>(() => loadJson(cacheKey, fallbackIndex));
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualCopyText, setManualCopyText] = useState("");
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const visiblePrompts = useMemo(() => {
    return promptIndex.prompts
      .map((prompt) => ({
        prompt,
        score: scorePrompt(prompt, query, getPromptState(localState, prompt.id)),
      }))
      .filter(({ score }) => !query.trim() || score > 0)
      .sort((a, b) => b.score - a.score || a.prompt.title.localeCompare(b.prompt.title))
      .map(({ prompt }) => prompt);
  }, [localState, promptIndex, query]);

  const selectedPrompt = visiblePrompts[Math.min(selectedIndex, Math.max(visiblePrompts.length - 1, 0))];

  useEffect(() => {
    localStorage.setItem(configKey, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    document.documentElement.dataset.theme = config.themeMode;
    document.documentElement.style.colorScheme = config.themeMode === "system" ? "light dark" : config.themeMode;
  }, [config.themeMode]);

  useEffect(() => {
    let cancelled = false;

    function focusSearch() {
      window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 30);
    }

    async function registerWakeShortcut() {
      try {
        if (await isRegistered(config.wakeShortcut)) {
          await unregister(config.wakeShortcut);
        }
        await register(config.wakeShortcut, async (event) => {
          if (event.state !== "Pressed") return;
          const appWindow = getCurrentWindow();
          await appWindow.unminimize();
          await appWindow.show();
          await appWindow.setFocus();
          focusSearch();
          setStatus(`Wake shortcut triggered: ${event.shortcut}`);
        });
        const registered = await isRegistered(config.wakeShortcut);
        if (!cancelled) {
          setStatus(registered ? `Wake shortcut registered: ${config.wakeShortcut}` : `Wake shortcut not registered: ${config.wakeShortcut}`);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(`Wake shortcut unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    registerWakeShortcut();

    return () => {
      cancelled = true;
      unregister(config.wakeShortcut).catch(() => {});
    };
  }, [config.wakeShortcut]);

  useEffect(() => {
    localStorage.setItem(stateKey, JSON.stringify(localState));
  }, [localState]);

  useEffect(() => {
    localStorage.setItem(cacheKey, JSON.stringify(promptIndex));
  }, [promptIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, promptIndex]);

  async function syncNow() {
    setStatus("Syncing GitHub repository...");
    try {
      const nextIndex = await syncPrompts(config);
      setPromptIndex(nextIndex);
      setStatus(`Synced ${nextIndex.prompts.length} prompts`);
    } catch (error) {
      setStatus(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function copySelectedPrompt() {
    if (!selectedPrompt) return;
    try {
      await writeText(selectedPrompt.body);
      setLocalState((current) => {
        const previous = getPromptState(current, selectedPrompt.id);
        return {
          prompts: {
            ...current.prompts,
            [selectedPrompt.id]: {
              ...previous,
              useCount: previous.useCount + 1,
              lastUsedAt: new Date().toISOString(),
            },
          },
        };
      });
      setCopiedPromptId(selectedPrompt.id);
      window.setTimeout(() => setCopiedPromptId((id) => (id === selectedPrompt.id ? null : id)), 1200);
      setStatus("Copied");
    } catch {
      setManualCopyText(selectedPrompt.body);
      setStatus("Clipboard blocked; prompt text selected");
    }
  }

  function toggleFavorite() {
    if (!selectedPrompt) return;
    setLocalState((current) => {
      const previous = getPromptState(current, selectedPrompt.id);
      return {
        prompts: {
          ...current.prompts,
          [selectedPrompt.id]: { ...previous, favorite: !previous.favorite },
        },
      };
    });
  }

  function saveSettings() {
    const nextConfig = {
      ...draftConfig,
      promptsDir: stripSlashes(draftConfig.promptsDir || defaultConfig.promptsDir),
      wakeShortcut: draftConfig.wakeShortcut || defaultConfig.wakeShortcut,
      themeMode: draftConfig.themeMode || defaultConfig.themeMode,
    };
    setConfig(nextConfig);
    setDraftConfig(nextConfig);
    setSettingsOpen(false);
    setStatus("Settings saved");
  }

  return (
    <main className="shell">
      <section className="launcher" aria-label="Prompt launcher">
        <header className="topbar">
          <div className="brand">pp</div>
          <label className="search-wrap" htmlFor="searchInput">
            <span className="search-icon">⌕</span>
            <input
              id="searchInput"
              ref={searchInputRef}
              autoComplete="off"
              spellCheck={false}
              placeholder="Search prompts..."
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") copySelectedPrompt();
                if (event.key === "ArrowDown") setSelectedIndex((index) => Math.min(index + 1, visiblePrompts.length - 1));
                if (event.key === "ArrowUp") setSelectedIndex((index) => Math.max(index - 1, 0));
                if (event.key === "Escape") setQuery("");
              }}
            />
          </label>
          <button className="icon-button" type="button" title="Sync" aria-label="Sync" onClick={syncNow}>
            ↻
          </button>
          <button className="icon-button" type="button" title="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            ⚙
          </button>
        </header>

        <div className="content">
          <aside className="results-panel">
            <div className="panel-label">
              <span>{visiblePrompts.length} prompts</span>
              <span>{query.trim() ? "matched" : promptIndex.source || "local"}</span>
            </div>
            <div className="results" role="listbox">
              {visiblePrompts.map((prompt, index) => {
                const promptState = getPromptState(localState, prompt.id);
                return (
                  <button
                    key={prompt.id}
                    type="button"
                    className={`result${index === selectedIndex ? " is-selected" : ""}`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span className={`favorite-mark${promptState.favorite ? " is-on" : ""}`}>
                      {promptState.favorite ? "★" : "☆"}
                    </span>
                    <span>
                      <span className="result-title">{prompt.title}</span>
                      <span className="result-description">{prompt.description}</span>
                      <span className="result-tags">
                        {prompt.tags.slice(0, 3).map((tag) => (
                          <span className="tag" key={tag}>#{tag}</span>
                        ))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="preview-panel">
            <div className="preview-meta">
              <div>
                <h1>{selectedPrompt?.title || "No prompt selected"}</h1>
                <p>{selectedPrompt?.description || ""}</p>
              </div>
              <div className="preview-actions">
                <button
                  className={`text-button copy-button${selectedPrompt && copiedPromptId === selectedPrompt.id ? " is-copied" : ""}`}
                  type="button"
                  onClick={copySelectedPrompt}
                  aria-live="polite"
                >
                  <span className="copy-label">{selectedPrompt && copiedPromptId === selectedPrompt.id ? "Copied" : "Copy"}</span>
                  {selectedPrompt && copiedPromptId === selectedPrompt.id && <span className="copy-spark" aria-hidden="true">✓</span>}
                </button>
                <button className="icon-button" type="button" title="Favorite" onClick={toggleFavorite}>
                  {selectedPrompt && getPromptState(localState, selectedPrompt.id).favorite ? "★" : "☆"}
                </button>
              </div>
            </div>
            <div className="tag-row">
              {selectedPrompt?.tags.map((tag) => (
                <span className="tag" key={tag}>#{tag}</span>
              ))}
            </div>
            <div className="path-line">{selectedPrompt?.path}</div>
            <article className="markdown" dangerouslySetInnerHTML={{ __html: selectedPrompt ? renderMarkdown(selectedPrompt.body) : "" }} />
          </section>
        </div>

        <footer className="statusbar">
          <div className="keymap">
            <span><kbd>Enter</kbd> Copy</span>
            <span><kbd>↑↓</kbd> Navigate</span>
            <span><kbd>Esc</kbd> Clear</span>
          </div>
          <div className="status-text">{status || `Using ${promptIndex.library?.name || "prompt library"}`}</div>
        </footer>
      </section>

      {manualCopyText && (
        <section className="manual-copy" onClick={() => setManualCopyText("")}>
          <div className="manual-copy-panel" onClick={(event) => event.stopPropagation()}>
            <div className="manual-copy-head">
              <div>
                <h2>Copy prompt</h2>
                <p>Clipboard access was blocked. The prompt text is selected below.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setManualCopyText("")}>×</button>
            </div>
            <textarea value={manualCopyText} readOnly spellCheck={false} autoFocus />
          </div>
        </section>
      )}

      {settingsOpen && (
        <section className="settings">
          <form className="settings-panel" onSubmit={(event) => { event.preventDefault(); saveSettings(); }}>
            <div className="settings-head">
              <div>
                <h2>Settings</h2>
                <p>Sync prompts from a public GitHub repository.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <label className="field">
              <span>Repository URL</span>
              <input value={draftConfig.repoUrl} onChange={(event) => setDraftConfig({ ...draftConfig, repoUrl: event.currentTarget.value })} />
            </label>
            <div className="field-grid">
              <label className="field">
                <span>Branch</span>
                <input value={draftConfig.branch} onChange={(event) => setDraftConfig({ ...draftConfig, branch: event.currentTarget.value })} />
              </label>
              <label className="field">
                <span>Prompts directory</span>
                <input value={draftConfig.promptsDir} onChange={(event) => setDraftConfig({ ...draftConfig, promptsDir: event.currentTarget.value })} />
              </label>
            </div>
            <label className="field">
              <span>Wake shortcut</span>
              <input value={draftConfig.wakeShortcut} onChange={(event) => setDraftConfig({ ...draftConfig, wakeShortcut: event.currentTarget.value })} />
            </label>
            <label className="field">
              <span>Theme</span>
              <select
                value={draftConfig.themeMode}
                onChange={(event) => setDraftConfig({ ...draftConfig, themeMode: event.currentTarget.value as AppConfig["themeMode"] })}
              >
                <option value="system">Follow system</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draftConfig.syncOnLaunch}
                onChange={(event) => setDraftConfig({ ...draftConfig, syncOnLaunch: event.currentTarget.checked })}
              />
              <span>Sync on launch</span>
            </label>
            <div className="settings-meta">
              <div>Last sync: {promptIndex.generated_at ? new Date(promptIndex.generated_at).toLocaleString() : "never"}</div>
              <div>Source: {promptIndex.source || "bundled"}</div>
            </div>
            <div className="settings-actions">
              <button className="text-button" type="button" onClick={() => setDraftConfig(defaultConfig)}>Reset</button>
              <button className="text-button" type="button" onClick={syncNow}>Sync now</button>
              <button className="text-button primary" type="submit">Save</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

export default App;
