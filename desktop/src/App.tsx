import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  languageMode: "system" | "zh-CN" | "en-US";
  alwaysOnTop: boolean;
  listMode: "smart" | "relevance" | "recent" | "favorites" | "used";
  pinFavorites: boolean;
};

type PromptState = {
  favorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
};

type LocalState = {
  prompts: Record<string, PromptState>;
};

type SearchQuery = {
  raw: string;
  terms: string[];
  tags: string[];
  favoriteOnly: boolean;
  recentOnly: boolean;
};

type ScoredPrompt = {
  prompt: Prompt;
  local: PromptState;
  score: number;
};

type PromptSection = {
  id: string;
  label: string;
  prompts: Prompt[];
};

const defaultConfig: AppConfig = {
  repoUrl: "https://github.com/PoplarYang/prompts",
  branch: "main",
  promptsDir: "prompts",
  syncOnLaunch: false,
  wakeShortcut: "CommandOrControl+Shift+P",
  themeMode: "system",
  languageMode: "system",
  alwaysOnTop: true,
  listMode: "smart",
  pinFavorites: true,
};

const messages = {
  "en-US": {
    alwaysOnTop: "Always on top",
    allPrompts: "All prompts",
    branch: "Branch",
    clear: "Clear",
    clipboardBlocked: "Clipboard blocked; prompt text selected",
    copy: "Copy",
    copyPrompt: "Copy prompt",
    copied: "Copied",
    dark: "Dark",
    favorite: "Favorite",
    followSystem: "Follow system",
    language: "Language",
    light: "Light",
    listMode: "Default list",
    manualCopyHint: "Clipboard access was blocked. The prompt text is selected below.",
    matched: "matched",
    mostUsed: "Most used",
    navigate: "Navigate",
    noPromptSelected: "No prompt selected",
    pinFavorites: "Pin favorites",
    prompts: "prompts",
    promptsDirectory: "Prompts directory",
    ready: "Ready",
    recent: "Recent",
    repositoryUrl: "Repository URL",
    reset: "Reset",
    save: "Save",
    settings: "Settings",
    settingsSaved: "Settings saved",
    settingsSubtitle: "Sync prompts from a public GitHub repository.",
    showFavorites: "Favorites",
    showRecent: "Recent",
    showRelevance: "Relevance",
    showSmart: "Smart",
    showUsed: "Used",
    source: "Source",
    sync: "Sync",
    syncNow: "Sync now",
    syncOnLaunch: "Sync on launch",
    syncing: "Syncing GitHub repository...",
    theme: "Theme",
    wakeShortcut: "Wake shortcut",
  },
  "zh-CN": {
    alwaysOnTop: "总在最前",
    allPrompts: "全部",
    branch: "分支",
    clear: "清空",
    clipboardBlocked: "剪贴板不可用；请手动复制选中的提示词",
    copy: "复制",
    copyPrompt: "复制提示词",
    copied: "已复制",
    dark: "深色",
    favorite: "收藏",
    followSystem: "跟随系统",
    language: "语言",
    light: "浅色",
    listMode: "默认列表",
    manualCopyHint: "剪贴板访问被阻止。下面的提示词文本已选中。",
    matched: "匹配",
    mostUsed: "常用",
    navigate: "导航",
    noPromptSelected: "未选择提示词",
    pinFavorites: "收藏置顶",
    prompts: "条提示词",
    promptsDirectory: "提示词目录",
    ready: "就绪",
    recent: "最近",
    repositoryUrl: "仓库地址",
    reset: "重置",
    save: "保存",
    settings: "设置",
    settingsSaved: "设置已保存",
    settingsSubtitle: "从公开 GitHub 仓库同步提示词。",
    showFavorites: "收藏",
    showRecent: "最近",
    showRelevance: "相关",
    showSmart: "智能",
    showUsed: "常用",
    source: "来源",
    sync: "同步",
    syncNow: "立即同步",
    syncOnLaunch: "启动时同步",
    syncing: "正在同步 GitHub 仓库...",
    theme: "主题",
    wakeShortcut: "唤醒快捷键",
  },
} as const;

function resolveLanguage(languageMode: AppConfig["languageMode"]) {
  if (languageMode !== "system") return languageMode;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

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

function parseSearchQuery(raw: string): SearchQuery {
  const terms: string[] = [];
  const tags: string[] = [];
  let favoriteOnly = false;
  let recentOnly = false;

  raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      const lower = normalize(token);
      if (lower.startsWith("#") && lower.length > 1) {
        tags.push(lower.slice(1));
        return;
      }
      if (["fav:", "favorite:", "favorites:", "f:"].includes(lower)) {
        favoriteOnly = true;
        return;
      }
      if (["recent:", "r:"].includes(lower)) {
        recentOnly = true;
        return;
      }
      terms.push(lower);
    });

  return { raw, terms, tags, favoriteOnly, recentOnly };
}

function levenshteinDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function fuzzyIncludes(value: string, term: string): boolean {
  const normalized = normalize(value);
  if (!term) return true;
  if (normalized.includes(term)) return true;
  if (term.length < 3) return false;

  return normalized
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter(Boolean)
    .some((word) => {
      if (word.includes(term) || term.includes(word)) return true;
      const limit = term.length >= 5 ? 2 : 1;
      return levenshteinDistance(word, term) <= limit;
    });
}

function scoreField(value: string, term: string, exact: number, partial: number, fuzzy: number): number {
  const normalized = normalize(value);
  if (normalized === term) return exact;
  if (normalized.includes(term)) return partial;
  return fuzzyIncludes(normalized, term) ? fuzzy : 0;
}

function scorePrompt(prompt: Prompt, search: SearchQuery, local: PromptState): number {
  if (search.favoriteOnly && !local.favorite) return 0;
  if (search.recentOnly && !local.lastUsedAt) return 0;
  if (search.tags.some((tag) => !prompt.tags.some((promptTag) => normalize(promptTag) === tag || normalize(promptTag).includes(tag)))) return 0;

  if (!search.terms.length) return 1;

  let score = 0;
  for (const term of search.terms) {
    const termScore =
      scoreField(prompt.title, term, 320, 210, 140) ||
      Math.max(...prompt.aliases.map((alias) => scoreField(alias, term, 280, 190, 120)), 0) ||
      scoreField(prompt.tags.join(" "), term, 180, 150, 80) ||
      scoreField(prompt.description, term, 120, 95, 55) ||
      scoreField(prompt.path, term, 90, 70, 35) ||
      scoreField(prompt.body, term, 55, 35, 15);
    if (!termScore) return 0;
    score += termScore;
  }

  if (local.favorite) score += 16;
  if (local.lastUsedAt) score += 10;
  score += Math.min(local.useCount, 8);
  return score;
}

function lastUsedTime(local: PromptState): number {
  return local.lastUsedAt ? new Date(local.lastUsedAt).getTime() || 0 : 0;
}

function compareByUsage(a: ScoredPrompt, b: ScoredPrompt): number {
  return b.local.useCount - a.local.useCount || lastUsedTime(b.local) - lastUsedTime(a.local) || a.prompt.title.localeCompare(b.prompt.title);
}

function comparePrompts(mode: AppConfig["listMode"], pinFavorites: boolean) {
  return (a: ScoredPrompt, b: ScoredPrompt) => {
    if (pinFavorites && a.local.favorite !== b.local.favorite) return a.local.favorite ? -1 : 1;
    if (mode === "recent") return lastUsedTime(b.local) - lastUsedTime(a.local) || b.score - a.score || a.prompt.title.localeCompare(b.prompt.title);
    if (mode === "favorites") return Number(b.local.favorite) - Number(a.local.favorite) || b.score - a.score || a.prompt.title.localeCompare(b.prompt.title);
    if (mode === "used") return compareByUsage(a, b);
    return b.score - a.score || lastUsedTime(b.local) - lastUsedTime(a.local) || a.prompt.title.localeCompare(b.prompt.title);
  };
}

function uniqueById(prompts: ScoredPrompt[]): ScoredPrompt[] {
  const seen = new Set<string>();
  return prompts.filter(({ prompt }) => {
    if (seen.has(prompt.id)) return false;
    seen.add(prompt.id);
    return true;
  });
}

function buildSections(scored: ScoredPrompt[], search: SearchQuery, config: AppConfig, labels: Record<keyof typeof messages["en-US"], string>): PromptSection[] {
  const hasQuery = search.terms.length || search.tags.length || search.favoriteOnly || search.recentOnly;
  const mode = hasQuery ? "relevance" : config.listMode;
  const sorted = [...scored].sort(comparePrompts(mode, config.pinFavorites));

  if (mode === "favorites") return [{ id: "favorites", label: labels.showFavorites, prompts: sorted.filter(({ local }) => local.favorite).map(({ prompt }) => prompt) }];
  if (mode === "recent") return [{ id: "recent", label: labels.showRecent, prompts: sorted.filter(({ local }) => local.lastUsedAt).slice(0, 10).map(({ prompt }) => prompt) }];
  if (mode === "used") return [{ id: "used", label: labels.showUsed, prompts: sorted.filter(({ local }) => local.useCount > 0).slice(0, 10).map(({ prompt }) => prompt) }];
  if (mode === "relevance" || hasQuery) return [{ id: "relevance", label: hasQuery ? labels.matched : labels.showRelevance, prompts: sorted.map(({ prompt }) => prompt) }];

  const favorites = sorted.filter(({ local }) => local.favorite);
  const recent = [...scored].filter(({ local }) => local.lastUsedAt).sort(comparePrompts("recent", false)).slice(0, 10);
  const used = [...scored].filter(({ local }) => local.useCount > 0).sort(comparePrompts("used", false)).slice(0, 10);
  const consumed = new Set([...favorites, ...recent, ...used].map(({ prompt }) => prompt.id));
  const rest = sorted.filter(({ prompt }) => !consumed.has(prompt.id));

  return [
    { id: "favorites", label: labels.showFavorites, prompts: favorites.map(({ prompt }) => prompt) },
    { id: "recent", label: labels.showRecent, prompts: recent.filter(({ prompt }) => !favorites.some((item) => item.prompt.id === prompt.id)).map(({ prompt }) => prompt) },
    { id: "used", label: labels.showUsed, prompts: used.filter(({ prompt }) => !favorites.some((item) => item.prompt.id === prompt.id) && !recent.some((item) => item.prompt.id === prompt.id)).map(({ prompt }) => prompt) },
    { id: "all", label: labels.allPrompts, prompts: rest.map(({ prompt }) => prompt) },
  ].filter((section) => section.prompts.length);
}

function getHighlightCandidates(value: string, search: SearchQuery): string[] {
  const terms = [...search.terms, ...search.tags].filter(Boolean);
  if (!terms.length) return [];

  const candidates = new Set(terms);
  const words = value.match(/[a-z0-9\u4e00-\u9fff]+/gi) ?? [];
  words.forEach((word) => {
    const normalizedWord = normalize(word);
    terms.forEach((term) => {
      if (normalizedWord === term || normalizedWord.includes(term)) {
        return;
      }
      if (term.includes(normalizedWord)) {
        candidates.add(word);
        return;
      }
      if (term.length >= 3 && fuzzyIncludes(normalizedWord, term)) {
        candidates.add(word);
      }
    });
  });

  return [...candidates].sort((a, b) => b.length - a.length);
}

function highlightText(value: string, search: SearchQuery) {
  const candidates = getHighlightCandidates(value, search);
  if (!candidates.length) return value;
  const escaped = candidates.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "ig");
  return value.split(matcher).map((part, index) => {
    const isMatch = candidates.some((candidate) => normalize(part) === normalize(candidate));
    return isMatch ? <mark key={`${part}-${index}`}>{part}</mark> : part;
  });
}

function highlightEscapedHtml(value: string, search: SearchQuery): string {
  const candidates = getHighlightCandidates(value, search);
  if (!candidates.length) return value;

  const escaped = candidates.map((term) => escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "ig");
  return value.replace(matcher, "<mark>$1</mark>");
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

function renderMarkdown(markdown: string, search: SearchQuery): string {
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
      segments.push(`<ul>${list.map((item) => `<li>${highlightEscapedHtml(item, search)}</li>`).join("")}</ul>`);
      list = [];
    }
    if (orderedList.length) {
      segments.push(`<ol>${orderedList.map((item) => `<li>${highlightEscapedHtml(item, search)}</li>`).join("")}</ol>`);
      orderedList = [];
    }
  }

  html.split("\n").forEach((line) => {
    if (/^@@CODE_\d+@@$/.test(line.trim())) {
      flushLists();
      const index = Number(line.trim().match(/\d+/)![0]);
      const block = codeBlocks[index];
      const code = highlightEscapedHtml(escapeHtml(block.code.trim()), search);
      segments.push(`<pre><code data-lang="${escapeHtml(block.lang)}">${code}</code></pre>`);
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
    if (line.trim()) segments.push(`<p>${highlightEscapedHtml(line, search)}</p>`);
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
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualCopyText, setManualCopyText] = useState("");
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef(config);
  const settingsOpenRef = useRef(settingsOpen);
  const manualCopyTextRef = useRef(manualCopyText);
  const language = resolveLanguage(config.languageMode);
  const t = messages[language];
  const search = useMemo(() => parseSearchQuery(query), [query]);

  const scoredPrompts = useMemo(() => {
    return promptIndex.prompts
      .map((prompt) => ({
        prompt,
        local: getPromptState(localState, prompt.id),
        score: scorePrompt(prompt, search, getPromptState(localState, prompt.id)),
      }))
      .filter(({ score }) => score > 0);
  }, [localState, promptIndex, search]);

  const promptSections = useMemo(() => buildSections(scoredPrompts, search, config, t), [config, scoredPrompts, search, t]);
  const visiblePrompts = useMemo(() => uniqueById(promptSections.flatMap((section) => section.prompts.map((prompt) => ({
    prompt,
    local: getPromptState(localState, prompt.id),
    score: 1,
  })))).map(({ prompt }) => prompt), [localState, promptSections]);

  const selectedIndex = Math.max(visiblePrompts.findIndex((prompt) => prompt.id === selectedPromptId), 0);
  const selectedPrompt = visiblePrompts[selectedIndex] ?? visiblePrompts[0];

  useEffect(() => {
    localStorage.setItem(configKey, JSON.stringify(config));
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  useEffect(() => {
    manualCopyTextRef.current = manualCopyText;
  }, [manualCopyText]);

  useEffect(() => {
    document.documentElement.dataset.theme = config.themeMode;
    document.documentElement.style.colorScheme = config.themeMode === "system" ? "light dark" : config.themeMode;
  }, [config.themeMode]);

  const focusSearch = useCallback(() => {
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 30);
  }, []);

  const showLauncher = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.unminimize();
    await appWindow.show();
    await appWindow.setFocus();
    focusSearch();
  }, [focusSearch]);

  const hideLauncher = useCallback(async () => {
    await getCurrentWindow().hide();
  }, []);

  const toggleLauncher = useCallback(async () => {
    const appWindow = getCurrentWindow();
    if (await appWindow.isVisible()) {
      await appWindow.hide();
      return "hidden";
    }
    await showLauncher();
    return "shown";
  }, [showLauncher]);

  useEffect(() => {
    let cancelled = false;

    async function registerWakeShortcut() {
      try {
        if (await isRegistered(config.wakeShortcut)) {
          await unregister(config.wakeShortcut);
        }
        await register(config.wakeShortcut, async (event) => {
          if (event.state !== "Pressed") return;
          const nextState = await toggleLauncher();
          setStatus(`Wake shortcut triggered (${nextState}): ${event.shortcut}`);
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
  }, [config.wakeShortcut, toggleLauncher]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.setAlwaysOnTop(config.alwaysOnTop).catch((error) => {
      setStatus(`Always on top unavailable: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [config.alwaysOnTop]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    function hideAfterBlur() {
      window.setTimeout(() => {
        if (!disposed && !configRef.current.alwaysOnTop && !settingsOpenRef.current && !manualCopyTextRef.current) {
          hideLauncher().catch(() => {});
        }
      }, 80);
    }

    function handleWindowBlur() {
      if (configRef.current.alwaysOnTop || settingsOpenRef.current || manualCopyTextRef.current) return;
      hideAfterBlur();
    }

    window.addEventListener("blur", handleWindowBlur);

    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused || configRef.current.alwaysOnTop || settingsOpenRef.current || manualCopyTextRef.current) return;
        hideAfterBlur();
      })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten;
      })
      .catch((error) => {
        setStatus(`Window blur handler unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });

    return () => {
      disposed = true;
      window.removeEventListener("blur", handleWindowBlur);
      unlisten?.();
    };
  }, [hideLauncher]);

  useEffect(() => {
    localStorage.setItem(stateKey, JSON.stringify(localState));
  }, [localState]);

  useEffect(() => {
    localStorage.setItem(cacheKey, JSON.stringify(promptIndex));
  }, [promptIndex]);

  useEffect(() => {
    if (!visiblePrompts.length) {
      setSelectedPromptId(null);
      return;
    }
    if (!selectedPromptId || !visiblePrompts.some((prompt) => prompt.id === selectedPromptId)) {
      setSelectedPromptId(visiblePrompts[0].id);
    }
  }, [selectedPromptId, visiblePrompts]);

  async function syncNow() {
    setStatus(t.syncing);
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
      setStatus(t.copied);
      window.setTimeout(() => {
        hideLauncher().catch(() => {});
      }, 420);
    } catch {
      setManualCopyText(selectedPrompt.body);
      setStatus(t.clipboardBlocked);
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
      languageMode: draftConfig.languageMode || defaultConfig.languageMode,
      alwaysOnTop: Boolean(draftConfig.alwaysOnTop),
      listMode: draftConfig.listMode || defaultConfig.listMode,
      pinFavorites: Boolean(draftConfig.pinFavorites),
    };
    setConfig(nextConfig);
    setDraftConfig(nextConfig);
    setSettingsOpen(false);
    setStatus(messages[resolveLanguage(nextConfig.languageMode)].settingsSaved);
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
              placeholder={language === "zh-CN" ? "搜索提示词..." : "Search prompts..."}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") copySelectedPrompt();
                if (event.key === "ArrowDown") {
                  const nextIndex = Math.min(selectedIndex + 1, visiblePrompts.length - 1);
                  setSelectedPromptId(visiblePrompts[nextIndex]?.id ?? null);
                }
                if (event.key === "ArrowUp") {
                  const nextIndex = Math.max(selectedIndex - 1, 0);
                  setSelectedPromptId(visiblePrompts[nextIndex]?.id ?? null);
                }
                if (event.key === "Escape") setQuery("");
              }}
            />
          </label>
          <button className="icon-button" type="button" title={t.sync} aria-label={t.sync} onClick={syncNow}>
            ↻
          </button>
          <button
            className="icon-button"
            type="button"
            title={t.settings}
            aria-label={t.settings}
            onClick={() => {
              setDraftConfig(config);
              setSettingsOpen(true);
            }}
          >
            ⚙
          </button>
        </header>

        <div className="content">
          <aside className="results-panel">
            <div className="panel-label">
              <span>{visiblePrompts.length} {t.prompts}</span>
              <span>{query.trim() ? t.matched : promptIndex.source || "local"}</span>
            </div>
            <div className="mode-tabs" aria-label={t.listMode}>
              {([
                ["smart", t.showSmart],
                ["relevance", t.showRelevance],
                ["recent", t.showRecent],
                ["favorites", t.showFavorites],
                ["used", t.showUsed],
              ] as Array<[AppConfig["listMode"], string]>).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`mode-tab${config.listMode === mode ? " is-active" : ""}`}
                  onClick={() => {
                    const nextConfig = { ...config, listMode: mode };
                    setConfig(nextConfig);
                    setDraftConfig(nextConfig);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="results" role="listbox">
              {promptSections.map((section) => (
                <section className="result-section" key={section.id}>
                  <div className="result-section-title">{section.label}</div>
                  {section.prompts.map((prompt) => {
                    const index = visiblePrompts.findIndex((item) => item.id === prompt.id);
                    const promptState = getPromptState(localState, prompt.id);
                    return (
                      <button
                        key={`${section.id}-${prompt.id}`}
                        type="button"
                        className={`result${index === selectedIndex ? " is-selected" : ""}`}
                        onClick={() => setSelectedPromptId(prompt.id)}
                      >
                        <span className={`favorite-mark${promptState.favorite ? " is-on" : ""}`}>
                          {promptState.favorite ? "★" : "☆"}
                        </span>
                        <span>
                          <span className="result-title">{highlightText(prompt.title, search)}</span>
                          <span className="result-description">{highlightText(prompt.description, search)}</span>
                          <span className="result-tags">
                            {prompt.tags.slice(0, 3).map((tag) => (
                              <span className="tag" key={tag}>#{highlightText(tag, search)}</span>
                            ))}
                          </span>
                          {promptState.lastUsedAt && (
                            <span className="result-usage">
                              {t.recent}: {new Date(promptState.lastUsedAt).toLocaleDateString()} · {t.showUsed}: {promptState.useCount}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}
              {!visiblePrompts.length && (
                <div className="empty-results">{t.noPromptSelected}</div>
              )}
            </div>
          </aside>

          <section className="preview-panel">
            <div className="preview-meta">
              <div>
                <h1>{selectedPrompt?.title || t.noPromptSelected}</h1>
                <p>{selectedPrompt?.description || ""}</p>
              </div>
              <div className="preview-actions">
                <button
                  className={`text-button copy-button${selectedPrompt && copiedPromptId === selectedPrompt.id ? " is-copied" : ""}`}
                  type="button"
                  onClick={copySelectedPrompt}
                  aria-live="polite"
                >
                  <span className="copy-label">{selectedPrompt && copiedPromptId === selectedPrompt.id ? t.copied : t.copy}</span>
                  {selectedPrompt && copiedPromptId === selectedPrompt.id && <span className="copy-spark" aria-hidden="true">✓</span>}
                </button>
                <button className="icon-button" type="button" title={t.favorite} onClick={toggleFavorite}>
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
            <article className="markdown" dangerouslySetInnerHTML={{ __html: selectedPrompt ? renderMarkdown(selectedPrompt.body, search) : "" }} />
          </section>
        </div>

        <footer className="statusbar">
          <div className="keymap">
            <span><kbd>Enter</kbd> {t.copy}</span>
            <span><kbd>↑↓</kbd> {t.navigate}</span>
            <span><kbd>Esc</kbd> {t.clear}</span>
          </div>
          <div className="status-text">{status || `${t.source}: ${promptIndex.library?.name || "prompt library"}`}</div>
        </footer>
      </section>

      {manualCopyText && (
        <section className="manual-copy" onClick={() => setManualCopyText("")}>
          <div className="manual-copy-panel" onClick={(event) => event.stopPropagation()}>
            <div className="manual-copy-head">
              <div>
                <h2>{t.copyPrompt}</h2>
                <p>{t.manualCopyHint}</p>
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
                <h2>{t.settings}</h2>
                <p>{t.settingsSubtitle}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <label className="field">
              <span>{t.repositoryUrl}</span>
              <input value={draftConfig.repoUrl} onChange={(event) => setDraftConfig({ ...draftConfig, repoUrl: event.currentTarget.value })} />
            </label>
            <div className="field-grid">
              <label className="field">
                <span>{t.branch}</span>
                <input value={draftConfig.branch} onChange={(event) => setDraftConfig({ ...draftConfig, branch: event.currentTarget.value })} />
              </label>
              <label className="field">
                <span>{t.promptsDirectory}</span>
                <input value={draftConfig.promptsDir} onChange={(event) => setDraftConfig({ ...draftConfig, promptsDir: event.currentTarget.value })} />
              </label>
            </div>
            <label className="field">
              <span>{t.wakeShortcut}</span>
              <input value={draftConfig.wakeShortcut} onChange={(event) => setDraftConfig({ ...draftConfig, wakeShortcut: event.currentTarget.value })} />
            </label>
            <div className="field-grid field-grid-compact">
              <label className="field">
                <span>{t.theme}</span>
                <select
                  value={draftConfig.themeMode}
                  onChange={(event) => setDraftConfig({ ...draftConfig, themeMode: event.currentTarget.value as AppConfig["themeMode"] })}
                >
                  <option value="system">{t.followSystem}</option>
                  <option value="dark">{t.dark}</option>
                  <option value="light">{t.light}</option>
                </select>
              </label>
              <label className="field">
                <span>{t.language}</span>
                <select
                  value={draftConfig.languageMode}
                  onChange={(event) => setDraftConfig({ ...draftConfig, languageMode: event.currentTarget.value as AppConfig["languageMode"] })}
                >
                  <option value="system">{t.followSystem}</option>
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </label>
              <label className="field">
                <span>{t.listMode}</span>
                <select
                  value={draftConfig.listMode}
                  onChange={(event) => setDraftConfig({ ...draftConfig, listMode: event.currentTarget.value as AppConfig["listMode"] })}
                >
                  <option value="smart">{t.showSmart}</option>
                  <option value="relevance">{t.showRelevance}</option>
                  <option value="recent">{t.showRecent}</option>
                  <option value="favorites">{t.showFavorites}</option>
                  <option value="used">{t.showUsed}</option>
                </select>
              </label>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draftConfig.syncOnLaunch}
                onChange={(event) => setDraftConfig({ ...draftConfig, syncOnLaunch: event.currentTarget.checked })}
              />
              <span>{t.syncOnLaunch}</span>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draftConfig.alwaysOnTop}
                onChange={(event) => setDraftConfig({ ...draftConfig, alwaysOnTop: event.currentTarget.checked })}
              />
              <span>{t.alwaysOnTop}</span>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draftConfig.pinFavorites}
                onChange={(event) => setDraftConfig({ ...draftConfig, pinFavorites: event.currentTarget.checked })}
              />
              <span>{t.pinFavorites}</span>
            </label>
            <div className="settings-meta">
              <div>{language === "zh-CN" ? "上次同步" : "Last sync"}: {promptIndex.generated_at ? new Date(promptIndex.generated_at).toLocaleString() : (language === "zh-CN" ? "从未" : "never")}</div>
              <div>{t.source}: {promptIndex.source || "bundled"}</div>
            </div>
            <div className="settings-actions">
              <button className="text-button" type="button" onClick={() => setDraftConfig(defaultConfig)}>{t.reset}</button>
              <button className="text-button" type="button" onClick={syncNow}>{t.syncNow}</button>
              <button className="text-button primary" type="submit">{t.save}</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

export default App;
