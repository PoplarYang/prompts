const defaultConfig = {
  repoUrl: "https://github.com/PoplarYang/prompts",
  branch: "main",
  promptsDir: "prompts",
  syncOnLaunch: false,
  wakeShortcut: "CommandOrControl+Shift+P",
};

let prompts = [];
let promptIndex = null;
let query = "";
let selectedIndex = 0;
let visiblePrompts = [];

const stateKey = "pp-v0.2-state";
const configKey = "pp-v0.2-config";
const cacheKey = "pp-v0.2-cache";
const state = loadState();
let config = loadConfig();

const searchInput = document.querySelector("#searchInput");
const resultsEl = document.querySelector("#results");
const resultCountEl = document.querySelector("#resultCount");
const sortHintEl = document.querySelector("#sortHint");
const previewTitleEl = document.querySelector("#previewTitle");
const previewDescriptionEl = document.querySelector("#previewDescription");
const previewTagsEl = document.querySelector("#previewTags");
const previewPathEl = document.querySelector("#previewPath");
const previewBodyEl = document.querySelector("#previewBody");
const favoriteButton = document.querySelector("#favoriteButton");
const copyButton = document.querySelector("#copyButton");
const statusText = document.querySelector("#statusText");
const syncButton = document.querySelector("#syncButton");
const settingsButton = document.querySelector("#settingsButton");
const manualCopy = document.querySelector("#manualCopy");
const manualCopyText = document.querySelector("#manualCopyText");
const closeManualCopy = document.querySelector("#closeManualCopy");
const settingsPanel = document.querySelector("#settingsPanel");
const settingsForm = document.querySelector("#settingsForm");
const closeSettings = document.querySelector("#closeSettings");
const repoUrlInput = document.querySelector("#repoUrlInput");
const branchInput = document.querySelector("#branchInput");
const promptsDirInput = document.querySelector("#promptsDirInput");
const syncOnLaunchInput = document.querySelector("#syncOnLaunchInput");
const wakeShortcutInput = document.querySelector("#wakeShortcutInput");
const settingsLastSync = document.querySelector("#settingsLastSync");
const settingsSource = document.querySelector("#settingsSource");
const resetSettings = document.querySelector("#resetSettings");
const syncSettings = document.querySelector("#syncSettings");

function loadState() {
  try {
    const raw = localStorage.getItem(stateKey);
    return raw ? JSON.parse(raw) : { prompts: {} };
  } catch {
    return { prompts: {} };
  }
}

function saveState() {
  localStorage.setItem(stateKey, JSON.stringify(state));
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(configKey);
    return { ...defaultConfig, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...defaultConfig };
  }
}

function saveConfig() {
  localStorage.setItem(configKey, JSON.stringify(config));
}

function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(index) {
  localStorage.setItem(cacheKey, JSON.stringify(index));
}

async function boot() {
  const cached = loadCache();

  if (cached?.prompts?.length) {
    setPromptIndex(cached, "cache");
    setStatus(`Loaded ${cached.prompts.length} cached prompts`, "success");
  } else {
    await loadBundledIndex();
  }

  renderSettings();
  render();

  if (config.syncOnLaunch) {
    syncFromGitHub({ quiet: true });
  }
}

async function loadBundledIndex() {
  try {
    const response = await fetch("./prompts.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Bundled index returned ${response.status}`);
    }
    const index = await response.json();
    setPromptIndex({ ...index, source: "bundled" }, "bundled");
    setStatus(`Loaded ${prompts.length} bundled prompts`, "success");
  } catch (error) {
    prompts = [];
    promptIndex = null;
    setStatus("No prompt index available", "error", 5000);
    previewTitleEl.textContent = "Prompt index not loaded";
    previewDescriptionEl.textContent = "Build prototype/prompts.json or sync a GitHub repository.";
    previewTagsEl.innerHTML = "";
    previewPathEl.textContent = "";
    previewBodyEl.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function setPromptIndex(index, source) {
  promptIndex = {
    ...index,
    source: index.source || source,
  };
  prompts = Array.isArray(index.prompts) ? index.prompts : [];
  selectedIndex = 0;
}

function getPromptState(id) {
  if (!state.prompts[id]) {
    state.prompts[id] = {
      favorite: false,
      useCount: 0,
      lastUsedAt: null,
    };
  }
  return state.prompts[id];
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function scorePrompt(prompt, rawQuery) {
  const local = getPromptState(prompt.id);
  const q = normalize(rawQuery.trim());
  let score = 0;

  if (!q) {
    if (local.favorite) score += 140;
    if (local.lastUsedAt) score += 100;
    score += Math.min(local.useCount, 20) * 3;
    return score;
  }

  const title = normalize(prompt.title);
  const description = normalize(prompt.description);
  const tags = normalize(prompt.tags.join(" "));
  const aliases = normalize(prompt.aliases.join(" "));
  const category = normalize(prompt.category);
  const path = normalize(prompt.path);
  const body = normalize(prompt.body);

  if (title === q) score += 300;
  if (prompt.aliases.some((alias) => normalize(alias) === q)) score += 260;
  if (title.includes(q)) score += 180;
  if (aliases.includes(q)) score += 160;
  if (tags.includes(q)) score += 130;
  if (category.includes(q)) score += 110;
  if (description.includes(q)) score += 90;
  if (path.includes(q)) score += 60;
  if (body.includes(q)) score += 35;
  if (local.favorite) score += 16;
  if (local.lastUsedAt) score += 10;
  score += Math.min(local.useCount, 8);

  return score;
}

function getVisiblePrompts() {
  return prompts
    .map((prompt) => ({ prompt, score: scorePrompt(prompt, query) }))
    .filter(({ score }) => !query.trim() || score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.prompt.title.localeCompare(b.prompt.title);
    })
    .map(({ prompt }) => prompt);
}

function render() {
  visiblePrompts = getVisiblePrompts();
  selectedIndex = Math.min(selectedIndex, Math.max(visiblePrompts.length - 1, 0));
  renderResults();
  renderPreview();
  renderSettingsMeta();
}

function renderResults() {
  resultCountEl.textContent = `${visiblePrompts.length} prompt${visiblePrompts.length === 1 ? "" : "s"}`;
  sortHintEl.textContent = query.trim() ? "matched" : promptIndex?.source || "local";
  resultsEl.innerHTML = "";

  if (!visiblePrompts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No prompts found. Try title, tag, alias, or content.";
    resultsEl.append(empty);
    return;
  }

  visiblePrompts.forEach((prompt, index) => {
    const local = getPromptState(prompt.id);
    const item = document.createElement("button");
    item.type = "button";
    item.className = `result${index === selectedIndex ? " is-selected" : ""}`;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
    item.addEventListener("click", () => {
      selectedIndex = index;
      render();
    });

    const star = document.createElement("span");
    star.className = `favorite-mark${local.favorite ? " is-on" : ""}`;
    star.textContent = local.favorite ? "★" : "☆";

    const body = document.createElement("span");
    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = prompt.title;

    const description = document.createElement("div");
    description.className = "result-description";
    description.textContent = prompt.description;

    const tags = document.createElement("div");
    tags.className = "result-tags";
    prompt.tags.slice(0, 3).forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "tag";
      tagEl.textContent = `#${tag}`;
      tags.append(tagEl);
    });

    body.append(title, description, tags);
    item.append(star, body);
    resultsEl.append(item);
  });
}

function renderPreview() {
  const prompt = visiblePrompts[selectedIndex];

  if (!prompt) {
    previewTitleEl.textContent = promptIndex ? "No prompt selected" : "Prompt index not loaded";
    previewDescriptionEl.textContent = promptIndex
      ? ""
      : "Build prototype/prompts.json or sync a GitHub repository.";
    previewTagsEl.innerHTML = "";
    previewPathEl.textContent = "";
    previewBodyEl.innerHTML = promptIndex
      ? ""
      : "<p>Run <code>python3 scripts/build_prompt_index.py</code>, then <code>python3 -m http.server 8765</code>.</p>";
    favoriteButton.textContent = "☆";
    return;
  }

  const local = getPromptState(prompt.id);
  previewTitleEl.textContent = prompt.title;
  previewDescriptionEl.textContent = prompt.description;
  previewPathEl.textContent = prompt.path;
  favoriteButton.textContent = local.favorite ? "★" : "☆";
  favoriteButton.style.color = local.favorite ? "var(--mark)" : "var(--muted)";
  previewTagsEl.innerHTML = "";

  prompt.tags.forEach((tag) => {
    const tagEl = document.createElement("span");
    tagEl.className = "tag";
    tagEl.textContent = `#${tag}`;
    previewTagsEl.append(tagEl);
  });

  previewBodyEl.innerHTML = renderMarkdown(prompt.body);
}

async function syncFromGitHub(options = {}) {
  const quiet = options.quiet === true;
  if (!quiet) setStatus("Syncing GitHub repository...");

  try {
    const repo = parseGitHubRepo(config.repoUrl);
    const promptRoot = stripSlashes(config.promptsDir || "prompts");
    const files = await listPromptFiles(repo, config.branch, promptRoot);
    const manifest = await fetchManifest(repo, config.branch);

    if (!files.length) {
      throw new Error(`No Markdown prompts found under ${promptRoot}/`);
    }

    const rawFiles = await Promise.all(
      files.map(async (file) => ({
        path: file.path,
        raw: await fetchRawFileWithFallback(repo, config.branch, file.path),
      })),
    );

    const index = buildIndexFromRawFiles(rawFiles, {
      manifest,
      repo,
      branch: config.branch,
      promptsDir: promptRoot,
    });

    saveCache(index);
    setPromptIndex(index, "github");
    setStatus(`Synced ${index.prompts.length} prompts`, "success");
    render();
  } catch (error) {
    const cached = loadCache();
    if (cached?.prompts?.length && !promptIndex?.prompts?.length) {
      setPromptIndex(cached, "cache");
      render();
    }
    setStatus(`Sync failed: ${error.message}`, "error", quiet ? 3500 : 6000);
  }
}

async function listPromptFiles(repo, branch, promptRoot) {
  try {
    return await listPromptFilesFromGitHub(repo, branch, promptRoot);
  } catch (githubError) {
    try {
      const files = await listPromptFilesFromJsDelivr(repo, branch, promptRoot);
      files.syncProvider = "jsdelivr";
      return files;
    } catch (fallbackError) {
      throw new Error(`${githubError.message}; jsDelivr fallback failed: ${fallbackError.message}`);
    }
  }
}

async function listPromptFilesFromGitHub(repo, branch, promptRoot) {
  const treeUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const response = await fetch(treeUrl, { headers: { Accept: "application/vnd.github+json" } });

  if (!response.ok) {
    throw new Error(`GitHub tree request returned ${response.status}`);
  }

  const tree = await response.json();
  return (tree.tree || [])
    .filter((item) => item.type === "blob")
    .filter((item) => item.path.startsWith(`${promptRoot}/`) && item.path.endsWith(".md"))
    .map((item) => ({ path: item.path, provider: "github" }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function listPromptFilesFromJsDelivr(repo, branch, promptRoot) {
  const url = `https://data.jsdelivr.com/v1/package/gh/${repo.owner}/${repo.name}@${encodeURIComponent(branch)}/flat`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`jsDelivr file list returned ${response.status}`);
  }

  const data = await response.json();
  return (data.files || [])
    .map((file) => String(file.name || "").replace(/^\/+/, ""))
    .filter((path) => path.startsWith(`${promptRoot}/`) && path.endsWith(".md"))
    .map((path) => ({ path, provider: "jsdelivr" }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function parseGitHubRepo(url) {
  const trimmed = String(url || "").trim();
  const match = trimmed.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/?$/);
  if (!match) {
    throw new Error("Use a GitHub repo URL like https://github.com/PoplarYang/prompts");
  }
  return { owner: match[1], name: match[2].replace(/\.git$/, "") };
}

async function fetchManifest(repo, branch) {
  try {
    const raw = await fetchRawFileWithFallback(repo, branch, "manifest.yaml");
    return parseYaml(raw);
  } catch {
    return {};
  }
}

async function fetchRawFileWithFallback(repo, branch, path) {
  try {
    return await fetchRawFileFromGitHub(repo, branch, path);
  } catch (githubError) {
    try {
      return await fetchRawFileFromJsDelivr(repo, branch, path);
    } catch (fallbackError) {
      throw new Error(`${githubError.message}; jsDelivr raw fallback failed for ${path}: ${fallbackError.message}`);
    }
  }
}

async function fetchRawFileFromGitHub(repo, branch, path) {
  const rawUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${encodeURIComponent(branch)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const response = await fetch(rawUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Raw file request failed for ${path}: ${response.status}`);
  }
  return response.text();
}

async function fetchRawFileFromJsDelivr(repo, branch, path) {
  const rawUrl = `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.name}@${encodeURIComponent(branch)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const response = await fetch(rawUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`jsDelivr raw request returned ${response.status}`);
  }
  return response.text();
}

function buildIndexFromRawFiles(files, context) {
  const prompts = files.map((file) => {
    const { meta, body } = parseFrontmatter(file.raw);
    return {
      id: file.path,
      title: String(meta.title || titleFromPath(file.path)),
      description: String(meta.description || ""),
      tags: normalizeList(meta.tags),
      category: String(meta.category || categoryFromPath(file.path, context.promptsDir)),
      aliases: normalizeList(meta.aliases),
      path: file.path,
      body: body.trimEnd() + "\n",
    };
  });

  return {
    library: {
      name: String(context.manifest.name || `${context.repo.owner}/${context.repo.name}`),
      version: context.manifest.version || 1,
      default_locale: String(context.manifest.default_locale || ""),
      prompts_dir: context.promptsDir,
      repo: `${context.repo.owner}/${context.repo.name}`,
      branch: context.branch,
    },
    generated_at: new Date().toISOString(),
    source: "github",
    prompts,
    errors: [],
  };
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { meta: {}, body: raw };
  }
  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { meta: {}, body: raw };
  }
  return {
    meta: parseYaml(raw.slice(4, end).trim()),
    body: raw.slice(end + 4).replace(/^\n/, ""),
  };
}

function parseYaml(raw) {
  const data = {};
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !line.includes(":")) return;
    const [key, ...rest] = line.split(":");
    data[key.trim()] = parseYamlValue(rest.join(":").trim());
  });
  return data;
}

function parseYamlValue(value) {
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => stripQuotes(item.trim()));
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return stripQuotes(value);
}

function stripQuotes(value) {
  if (value.length >= 2 && value[0] === value[value.length - 1] && ["'", '"'].includes(value[0])) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return [String(value)];
}

function stripSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function titleFromPath(path) {
  const stem = path.split("/").pop().replace(/\.md$/, "");
  return stem
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryFromPath(path, promptsDir) {
  const parts = path.split("/");
  const rootIndex = parts.indexOf(promptsDir);
  return parts[rootIndex + 1] || "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarkdown(markdown) {
  const segments = [];
  const codeBlocks = [];
  let html = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = "", code) => {
    const token = `@@CODE_${codeBlocks.length}@@`;
    codeBlocks.push({ lang, code });
    return token;
  });

  html = escapeHtml(html);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  const lines = html.split("\n");
  let list = [];
  let orderedList = [];

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

  lines.forEach((line) => {
    if (/^@@CODE_\d+@@$/.test(line.trim())) {
      flushLists();
      const index = Number(line.trim().match(/\d+/)[0]);
      const block = codeBlocks[index];
      segments.push(
        `<pre><code data-lang="${escapeHtml(block.lang)}">${escapeHtml(block.code.trim())}</code></pre>`,
      );
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

    if (!line.trim()) return;
    if (/^<h[1-3]>/.test(line)) {
      segments.push(line);
    } else {
      segments.push(`<p>${line}</p>`);
    }
  });

  flushLists();
  return segments.join("");
}

async function copySelectedPrompt() {
  const prompt = visiblePrompts[selectedIndex];
  if (!prompt) return;

  try {
    await writeClipboardText(prompt.body);
    const local = getPromptState(prompt.id);
    local.useCount += 1;
    local.lastUsedAt = new Date().toISOString();
    saveState();
    setStatus("Copied", "success");
    render();
  } catch {
    showManualCopy(prompt.body);
    setStatus("Clipboard blocked; prompt text selected", "error", 4000);
  }
}

async function writeClipboardText(text) {
  if (copyViaTextarea(text)) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Copy command failed");
}

function copyViaTextarea(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function toggleFavorite() {
  const prompt = visiblePrompts[selectedIndex];
  if (!prompt) return;
  const local = getPromptState(prompt.id);
  local.favorite = !local.favorite;
  saveState();
  setStatus(local.favorite ? "Added to favorites" : "Removed from favorites", "success");
  render();
}

function showManualCopy(text) {
  manualCopy.hidden = false;
  manualCopyText.value = text;
  manualCopyText.focus();
  manualCopyText.select();
}

function hideManualCopy() {
  manualCopy.hidden = true;
  searchInput.focus();
}

function renderSettings() {
  repoUrlInput.value = config.repoUrl;
  branchInput.value = config.branch;
  promptsDirInput.value = config.promptsDir;
  syncOnLaunchInput.checked = config.syncOnLaunch;
  wakeShortcutInput.value = config.wakeShortcut;
  renderSettingsMeta();
}

function renderSettingsMeta() {
  const cached = loadCache();
  const lastSync = cached?.generated_at ? new Date(cached.generated_at).toLocaleString() : "never";
  settingsLastSync.textContent = `Last sync: ${lastSync}`;
  settingsSource.textContent = `Source: ${promptIndex?.source || "none"}`;
}

function showSettings() {
  renderSettings();
  settingsPanel.hidden = false;
  repoUrlInput.focus();
}

function hideSettings() {
  settingsPanel.hidden = true;
  searchInput.focus();
}

function applySettingsFromForm() {
  config = {
    repoUrl: repoUrlInput.value.trim() || defaultConfig.repoUrl,
    branch: branchInput.value.trim() || defaultConfig.branch,
    promptsDir: stripSlashes(promptsDirInput.value.trim() || defaultConfig.promptsDir),
    syncOnLaunch: syncOnLaunchInput.checked,
    wakeShortcut: wakeShortcutInput.value.trim() || defaultConfig.wakeShortcut,
  };
  saveConfig();
  renderSettings();
  setStatus("Settings saved", "success");
}

let statusTimer = null;
function setStatus(text, mode, duration = 1500) {
  statusText.textContent = text;
  statusText.className = `status-text${mode ? ` is-${mode}` : ""}`;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    const name = promptIndex?.library?.name || "local prompt index";
    statusText.textContent = `Using ${name}`;
    statusText.className = "status-text";
  }, duration);
}

searchInput.addEventListener("input", (event) => {
  query = event.target.value;
  selectedIndex = 0;
  render();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    copySelectedPrompt();
    event.preventDefault();
  }
});

favoriteButton.addEventListener("click", toggleFavorite);
copyButton.addEventListener("click", copySelectedPrompt);
syncButton.addEventListener("click", () => syncFromGitHub());
settingsButton.addEventListener("click", showSettings);
closeManualCopy.addEventListener("click", hideManualCopy);
closeSettings.addEventListener("click", hideSettings);
syncSettings.addEventListener("click", () => {
  applySettingsFromForm();
  syncFromGitHub();
});
resetSettings.addEventListener("click", () => {
  config = { ...defaultConfig };
  saveConfig();
  renderSettings();
  setStatus("Settings reset", "success");
});
settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  applySettingsFromForm();
  hideSettings();
});

manualCopy.addEventListener("click", (event) => {
  if (event.target === manualCopy) hideManualCopy();
});

settingsPanel.addEventListener("click", (event) => {
  if (event.target === settingsPanel) hideSettings();
});

document.addEventListener("keydown", (event) => {
  const isModifier = event.metaKey || event.ctrlKey;

  if (event.key === "ArrowDown") {
    selectedIndex = Math.min(selectedIndex + 1, visiblePrompts.length - 1);
    render();
    event.preventDefault();
  }

  if (event.key === "ArrowUp") {
    selectedIndex = Math.max(selectedIndex - 1, 0);
    render();
    event.preventDefault();
  }

  if (event.key === "Enter" && document.activeElement !== searchInput) {
    copySelectedPrompt();
    event.preventDefault();
  }

  if (event.key === "Escape") {
    if (!manualCopy.hidden) {
      hideManualCopy();
      event.preventDefault();
      return;
    }
    if (!settingsPanel.hidden) {
      hideSettings();
      event.preventDefault();
      return;
    }
    searchInput.value = "";
    query = "";
    selectedIndex = 0;
    render();
    event.preventDefault();
  }

  if (isModifier && event.key.toLowerCase() === "f") {
    toggleFavorite();
    event.preventDefault();
  }

  if (isModifier && event.key.toLowerCase() === "r") {
    syncFromGitHub();
    event.preventDefault();
  }

  if (isModifier && event.key === ",") {
    showSettings();
    event.preventDefault();
  }
});

searchInput.focus();
boot();
