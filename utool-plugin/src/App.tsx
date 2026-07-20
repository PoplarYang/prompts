import { useEffect, useMemo, useRef, useState } from "react";
import bundledIndex from "../../prototype/prompts.json";
import { buildGitHubFileUrl, normalizeGitHubSettings, sameGitHubSettings, syncGitHubPrompts } from "./github";
import { filterPromptsBySource, getHighlightCandidates, parsePromptFiles, searchPrompts, type Prompt, type PromptSourceFilter } from "./prompt";
import type { PpPluginState } from "./types";

const initialState: PpPluginState = {
  githubRepoUrl: "https://github.com/PoplarYang/prompts",
  githubBranch: "main",
  githubPromptsDirectory: "prompts",
  githubCache: [],
  githubLastSyncedAt: "",
  localRoot: "",
  localPromptsDirectory: "prompts",
  favorites: [],
  recentIds: [],
};

const previewHost: Window["utools"] = {
  copyText: (text) => {
    void navigator.clipboard?.writeText(text);
    return true;
  },
  hideMainWindow: () => true,
  setSubInput: () => true,
  removeSubInput: () => true,
  setSubInputValue: () => true,
  subInputFocus: () => true,
  onPluginEnter: () => {},
  onPluginOut: () => {},
  redirectHotKeySetting: () => {},
  showOpenDialog: () => undefined,
  shellOpenExternal: (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  },
};

function host() {
  return window.utools || previewHost;
}

function normalizeBundledPrompts(): Prompt[] {
  return bundledIndex.prompts.map((prompt) => ({
    ...prompt,
    id: `bundled:${prompt.id}`,
    source: "bundled" as const,
    short: false,
    collectionTitle: prompt.title,
  }));
}

function sourceLabel(source: Prompt["source"]) {
  return source === "local" ? "本地" : source === "github" ? "GitHub" : "内置";
}

function sourceFilterLabel(source: PromptSourceFilter) {
  return source === "all" ? "全部" : sourceLabel(source);
}

function githubSettingsFromState(state: PpPluginState) {
  return {
    repoUrl: state.githubRepoUrl,
    branch: state.githubBranch,
    promptsDirectory: state.githubPromptsDirectory,
  };
}

type LoadPhase = "empty" | "loading" | "cache" | "ready" | "stale" | "error";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(value: string, query: string) {
  const candidates = getHighlightCandidates(value, query);
  if (!candidates.length) return value;
  const matcher = new RegExp(`(${candidates.map(escapeRegExp).join("|")})`, "ig");
  return value.split(matcher).map((part, index) => (
    candidates.some((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase())
      ? <mark className="search-match" key={`${part}-${index}`}>{part}</mark>
      : part
  ));
}

type PromptGroup = {
  id: string;
  title: string;
  description: string;
  path: string;
  source: Prompt["source"];
  prompts: Prompt[];
  isShortCollection: boolean;
};

function groupPrompts(prompts: Prompt[]): PromptGroup[] {
  const groups = new Map<string, PromptGroup>();
  for (const prompt of prompts) {
    const isShortCollection = prompt.short;
    const id = isShortCollection ? `${prompt.source}:${prompt.path}` : prompt.id;
    const existing = groups.get(id);
    if (existing) {
      existing.prompts.push(prompt);
      continue;
    }
    groups.set(id, {
      id,
      title: isShortCollection ? prompt.collectionTitle : prompt.title,
      description: prompt.description,
      path: prompt.path,
      source: prompt.source,
      prompts: [prompt],
      isShortCollection,
    });
  }
  return [...groups.values()];
}

function App() {
  const [pluginState, setPluginState] = useState<PpPluginState>(initialState);
  const [githubPrompts, setGithubPrompts] = useState<Prompt[]>([]);
  const [localPrompts, setLocalPrompts] = useState<Prompt[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [activePromptId, setActivePromptId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<PromptSourceFilter>("all");
  const [status, setStatus] = useState("正在加载提示词...");
  const [githubPhase, setGithubPhase] = useState<LoadPhase>("empty");
  const [githubError, setGithubError] = useState("");
  const [localPhase, setLocalPhase] = useState<LoadPhase>("empty");
  const [localError, setLocalError] = useState("");
  const queryRef = useRef(query);
  const pluginStateRef = useRef<PpPluginState>(initialState);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const promptRefs = useRef(new Map<string, HTMLElement>());
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    window.ppNative?.readState()
      .then((saved) => {
        const loadedState = { ...initialState, ...saved };
        // Caches from before provenance tracking belong to the configuration that created them.
        const nextState = loadedState.githubCache.length && !loadedState.githubCacheSettings
          ? { ...loadedState, githubCacheSettings: normalizeGitHubSettings(githubSettingsFromState(loadedState)) }
          : loadedState;
        const cacheIsCurrent = !nextState.githubCache.length || sameGitHubSettings(githubSettingsFromState(nextState), nextState.githubCacheSettings!);
        pluginStateRef.current = nextState;
        setPluginState(nextState);
        setGithubPrompts(nextState.githubCache || []);
        setGithubPhase(nextState.githubCache?.length ? (cacheIsCurrent ? "cache" : "stale") : "empty");
        setStatus(nextState.githubCache?.length
          ? (cacheIsCurrent ? `已加载 ${nextState.githubCache.length} 条 GitHub 缓存` : "GitHub 配置已更改，请同步后使用新配置")
          : "已加载内置提示词");
        if (nextState !== loadedState) persist(nextState);
        if (nextState.localRoot) void loadLocalPrompts(nextState);
      })
      .catch((error: unknown) => setStatus(`读取本地状态失败：${error instanceof Error ? error.message : String(error)}`));
  }, []);

  useEffect(() => {
    host().onPluginEnter(() => {
      setSettingsOpen(false);
      host().setSubInput(({ text }) => setQuery(text), "搜索提示词", true);
      host().setSubInputValue(queryRef.current);
    });
    host().onPluginOut(() => host().removeSubInput());
  }, []);

  useEffect(() => () => {
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      writeState(pluginStateRef.current);
    }
  }, []);

  const bundledPrompts = useMemo(() => normalizeBundledPrompts(), []);
  const githubSettings = useMemo(() => normalizeGitHubSettings(githubSettingsFromState(pluginState)), [
    pluginState.githubRepoUrl,
    pluginState.githubBranch,
    pluginState.githubPromptsDirectory,
  ]);
  const githubCacheIsCurrent = !githubPrompts.length
    || !pluginState.githubCacheSettings
    || sameGitHubSettings(githubSettings, pluginState.githubCacheSettings);
  const effectiveGithubPhase = githubPhase === "loading" || githubCacheIsCurrent ? githubPhase : "stale";
  const visibleGithubPrompts = githubCacheIsCurrent ? githubPrompts : [];
  const prompts = useMemo(() => filterPromptsBySource(
    [...visibleGithubPrompts, ...localPrompts, ...bundledPrompts],
    sourceFilter,
  ), [bundledPrompts, localPrompts, sourceFilter, visibleGithubPrompts]);
  const favorites = useMemo<Set<string>>(() => new Set(pluginState.favorites), [pluginState.favorites]);
  const results = useMemo(() => searchPrompts(prompts, query, favorites, pluginState.recentIds), [favorites, pluginState.recentIds, prompts, query]);
  const resultGroups = useMemo(() => groupPrompts(results), [results]);
  const selectedGroup = resultGroups.find((group) => group.id === selectedId) || resultGroups[0] || null;
  const activePrompt = selectedGroup?.prompts.find((prompt) => prompt.id === activePromptId) || selectedGroup?.prompts[0] || null;

  useEffect(() => {
    if (selectedGroup && selectedGroup.id !== selectedId) setSelectedId(selectedGroup.id);
  }, [selectedId, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      setActivePromptId("");
      return;
    }
    if (!selectedGroup.prompts.some((prompt) => prompt.id === activePromptId)) {
      setActivePromptId(selectedGroup.prompts[0].id);
    }
  }, [activePromptId, selectedGroup]);

  useEffect(() => {
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  useEffect(() => {
    if (!activePromptId) return;
    requestAnimationFrame(() => {
      const promptElement = promptRefs.current.get(activePromptId);
      if (!promptElement) return;
      const target = query.trim()
        ? promptElement.querySelector("mark.search-match") || detailRef.current?.querySelector("mark.search-match")
        : null;
      (target || promptElement).scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [activePromptId, query, selectedGroup]);

  function writeState(next: PpPluginState) {
    window.ppNative?.writeState(next).catch((error: unknown) => setStatus(`保存设置失败：${error instanceof Error ? error.message : String(error)}`));
  }

  function persist(next: PpPluginState, deferWrite = false) {
    pluginStateRef.current = next;
    setPluginState(next);
    if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
    if (deferWrite) {
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = undefined;
        writeState(pluginStateRef.current);
      }, 350);
      return;
    }
    writeState(next);
  }

  function updateGitHubSettings(change: Partial<Pick<PpPluginState, "githubRepoUrl" | "githubBranch" | "githubPromptsDirectory">>) {
    const next = { ...pluginStateRef.current, ...change };
    persist(next, true);
    if (next.githubCache.length && next.githubCacheSettings && !sameGitHubSettings(githubSettingsFromState(next), next.githubCacheSettings)) {
      setGithubPhase("stale");
      setStatus("GitHub 配置已更改，请同步后使用新配置");
    }
  }

  async function loadLocalPrompts(state = pluginStateRef.current) {
    if (!state.localRoot) return;
    if (!window.ppNative) {
      setLocalPhase("error");
      setLocalError("本地读取服务未初始化，请重新安装开发模式插件");
      setStatus("本地读取服务未初始化，请重新安装开发模式插件");
      return;
    }
    setLocalPhase("loading");
    setLocalError("");
    try {
      const files = await window.ppNative.loadLocalFiles(state.localRoot, state.localPromptsDirectory);
      const nextPrompts = parsePromptFiles(files, "local").prompts;
      setLocalPrompts(nextPrompts);
      setLocalPhase("ready");
      setStatus(`已加载 ${nextPrompts.length} 条本地提示词`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLocalPrompts([]);
      setLocalPhase("error");
      setLocalError(message);
      setStatus(`加载本地提示词失败：${message}`);
    }
  }

  async function chooseLocalFolder() {
    try {
      const localRoot = host().showOpenDialog({
        title: "选择本地提示词文件夹",
        properties: ["openDirectory"],
      })?.[0];
      if (!localRoot) return;
      const next = { ...pluginStateRef.current, localRoot };
      persist(next);
      await loadLocalPrompts(next);
    } catch (error) {
      setStatus(`打开文件夹选择失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function syncGitHub() {
    const settingsAtSync = normalizeGitHubSettings(githubSettingsFromState(pluginStateRef.current));
    setGithubPhase("loading");
    setGithubError("");
    setStatus("正在同步 GitHub 提示词...");
    try {
      const prompts = await syncGitHubPrompts(settingsAtSync);
      const currentState = pluginStateRef.current;
      const cacheMatchesCurrentSettings = sameGitHubSettings(githubSettingsFromState(currentState), settingsAtSync);
      const next = {
        ...currentState,
        githubCache: prompts,
        githubCacheSettings: settingsAtSync,
        githubLastSyncedAt: new Date().toISOString(),
      };
      setGithubPrompts(prompts);
      setGithubPhase(cacheMatchesCurrentSettings ? "ready" : "stale");
      persist(next);
      setStatus(cacheMatchesCurrentSettings
        ? `已同步 ${prompts.length} 条 GitHub 提示词`
        : "同步完成，但 GitHub 配置已更改，请再次同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = githubCacheIsCurrent && githubPrompts.length ? `，继续使用 ${githubPrompts.length} 条缓存` : "";
      setGithubPhase("error");
      setGithubError(message);
      setStatus(`GitHub 同步失败${fallback}：${message}`);
    }
  }

  function toggleFavorite(prompt: Prompt) {
    const currentState = pluginStateRef.current;
    const nextFavorites = favorites.has(prompt.id)
      ? currentState.favorites.filter((id) => id !== prompt.id)
      : [prompt.id, ...currentState.favorites];
    persist({ ...currentState, favorites: nextFavorites });
  }

  function copyPrompt(prompt: Prompt) {
    if (!host().copyText(prompt.body)) {
      setStatus("复制失败，请重试");
      return;
    }
    const currentState = pluginStateRef.current;
    persist({
      ...currentState,
      recentIds: [prompt.id, ...currentState.recentIds.filter((id) => id !== prompt.id)].slice(0, 30),
    });
    setStatus(`已复制：${prompt.title}`);
    host().hideMainWindow(true);
  }

  function openOriginal(group: PromptGroup) {
    try {
      const currentState = pluginStateRef.current;
      if (group.source === "local") {
        window.ppNative?.openPath(`${currentState.localRoot}/${group.path}`);
        return;
      }
      if (group.source === "github") {
        host().shellOpenExternal(buildGitHubFileUrl(
          currentState.githubRepoUrl,
          currentState.githubBranch,
          group.path,
        ));
      }
    } catch (error) {
      setStatus(`打开原始提示词失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function moveActivePrompt(direction: -1 | 1) {
    if (!selectedGroup || selectedGroup.prompts.length < 2) return;
    const currentIndex = Math.max(0, selectedGroup.prompts.findIndex((prompt) => prompt.id === activePrompt?.id));
    const nextIndex = Math.max(0, Math.min(selectedGroup.prompts.length - 1, currentIndex + direction));
    setActivePromptId(selectedGroup.prompts[nextIndex].id);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        settingsOpen ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setQuery("");
        host().setSubInputValue("");
        host().subInputFocus();
        return;
      }
      if (!resultGroups.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = Math.max(0, resultGroups.findIndex((group) => group.id === selectedId));
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.max(0, Math.min(resultGroups.length - 1, currentIndex + direction));
        setSelectedId(resultGroups[nextIndex].id);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveActivePrompt(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveActivePrompt(-1);
        return;
      }
      if (event.key === "Enter" && activePrompt) {
        event.preventDefault();
        copyPrompt(activePrompt);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePrompt, resultGroups, selectedGroup, selectedId, settingsOpen]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand"><img src="./logo.svg" alt="pp" /><span>pp 提示词</span></div>
        <div className="header-actions">
          <button className={`sync-button is-${effectiveGithubPhase}`} type="button" onClick={() => void syncGitHub()} title={githubPhase === "loading" ? "正在同步 GitHub 提示词" : "同步 GitHub 提示词"} aria-label={githubPhase === "loading" ? "正在同步 GitHub 提示词" : "同步 GitHub 提示词"} aria-busy={githubPhase === "loading"} disabled={githubPhase === "loading"}><span aria-hidden="true">↻</span></button>
          <button type="button" onClick={() => setSettingsOpen((open) => !open)} title="设置">⚙</button>
        </div>
      </header>

      {settingsOpen ? (
        <section className="settings" aria-label="pp 设置">
          <div className="section-heading"><div><h1>设置</h1><p>GitHub 与本地提示词可同时使用</p></div><button type="button" onClick={() => setSettingsOpen(false)}>完成</button></div>
          <div className="settings-section">GitHub 提示词</div>
          <label>仓库地址<input value={pluginState.githubRepoUrl} onChange={(event) => updateGitHubSettings({ githubRepoUrl: event.currentTarget.value })} /></label>
          <div className="setting-grid">
            <label>分支<input value={pluginState.githubBranch} onChange={(event) => updateGitHubSettings({ githubBranch: event.currentTarget.value })} /></label>
            <label>提示词目录<input value={pluginState.githubPromptsDirectory} onChange={(event) => updateGitHubSettings({ githubPromptsDirectory: event.currentTarget.value })} /></label>
          </div>
          <div className="source-status" aria-label="提示词来源状态">
            <div><span className={`status-dot is-${effectiveGithubPhase}`} /><strong>GitHub</strong><small>{githubCacheIsCurrent ? githubPrompts.length : 0} 条</small><em>{effectiveGithubPhase === "loading" ? "同步中" : effectiveGithubPhase === "stale" ? "配置已更改，待同步" : effectiveGithubPhase === "cache" ? "使用缓存" : effectiveGithubPhase === "error" ? (githubCacheIsCurrent && githubPrompts.length ? "同步失败，使用缓存" : "同步失败") : effectiveGithubPhase === "ready" ? "已同步" : "未同步"}</em></div>
            <div><span className={`status-dot is-${localPhase}`} /><strong>本地</strong><small>{localPrompts.length} 条</small><em>{localPhase === "loading" ? "读取中" : localPhase === "error" ? "读取失败" : localPhase === "ready" ? "已加载" : "未配置"}</em></div>
            <div><span className="status-dot is-ready" /><strong>内置</strong><small>{bundledPrompts.length} 条</small><em>可离线使用</em></div>
          </div>
          <div className="setting-row sync-summary"><span>{pluginState.githubLastSyncedAt ? `上次成功同步：${new Date(pluginState.githubLastSyncedAt).toLocaleString()}` : "尚未成功同步 GitHub 提示词"}</span><button type="button" onClick={() => void syncGitHub()} disabled={githubPhase === "loading"}>{githubPhase === "loading" ? "同步中..." : "立即同步"}</button></div>
          {githubError && <p className="status-error">GitHub：{githubError}{githubCacheIsCurrent && githubPrompts.length ? `；当前继续使用 ${githubPrompts.length} 条缓存。` : ""}</p>}
          <div className="settings-section">本地提示词</div>
          <label>本地提示词目录<input value={pluginState.localPromptsDirectory} onChange={(event) => persist({ ...pluginState, localPromptsDirectory: event.currentTarget.value || "prompts" })} /></label>
          <div className="setting-row"><span>{pluginState.localRoot || "尚未选择本地提示词文件夹"}</span><button type="button" onClick={() => void chooseLocalFolder()}>选择文件夹</button></div>
          {pluginState.localRoot && <div className="setting-row"><span>{localPhase === "ready" ? `已加载 ${localPrompts.length} 条本地提示词` : "重新读取当前本地目录"}</span><button type="button" onClick={() => void loadLocalPrompts()} disabled={localPhase === "loading"}>{localPhase === "loading" ? "读取中..." : "重新读取"}</button></div>}
          {localError && <p className="status-error">本地：{localError}</p>}
          <div className="setting-row"><span>将全局快捷键交给 uTools 管理</span><button type="button" onClick={() => host().redirectHotKeySetting("pp 提示词")}>配置快捷键</button></div>
          <p className="hint">GitHub 缓存保存在当前设备，可离线使用。本地文件夹不会与 GitHub 互相同步或写入。</p>
        </section>
      ) : (
        <section className="workspace">
          <aside className="result-list">
            <div className="list-meta"><span>{resultGroups.length} 条提示词</span><label className="source-filter"><span className="visually-hidden">来源筛选</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.currentTarget.value as PromptSourceFilter)} aria-label="筛选提示词来源"><option value="all">全部</option><option value="bundled">内置</option><option value="github">GitHub</option><option value="local">本地</option></select></label></div>
            <div className="result-scroll">
              {resultGroups.map((group) => (
                <button className={`prompt-row ${selectedGroup?.id === group.id ? "selected" : ""}`} type="button" key={group.id} ref={(element) => { if (element) rowRefs.current.set(group.id, element); else rowRefs.current.delete(group.id); }} onClick={() => { setSelectedId(group.id); setActivePromptId(group.prompts[0].id); }}>
                  <span className="favorite-mark">{group.prompts.some((prompt) => favorites.has(prompt.id)) ? "★" : "☆"}</span>
                  <span className="row-copy"><strong>{highlightText(group.title, query)}</strong><small>{highlightText(group.description || (group.isShortCollection ? `${group.prompts.length} 条简短提示词` : group.prompts[0].category), query)}</small><em>{sourceLabel(group.source)}</em></span>
                </button>
              ))}
              {!resultGroups.length && <div className="empty">没有匹配的提示词</div>}
            </div>
          </aside>
          <article className="detail" ref={detailRef}>
            {selectedGroup && activePrompt ? <>
              <div className="detail-head">
                <div>
                  <div className="eyebrow">{sourceLabel(selectedGroup.source)} · {highlightText(selectedGroup.path, query)}</div>
                  <h1>{highlightText(selectedGroup.title, query)}</h1>
                  <p>{highlightText(selectedGroup.description || (selectedGroup.isShortCollection ? `${selectedGroup.prompts.length} 条简短提示词` : ""), query)}</p>
                </div>
                {!selectedGroup.isShortCollection && <div className="detail-actions"><button type="button" onClick={() => toggleFavorite(activePrompt)}>{favorites.has(activePrompt.id) ? "已收藏" : "收藏"}</button><button className="primary" type="button" onClick={() => copyPrompt(activePrompt)}>复制</button></div>}
              </div>
              {selectedGroup.isShortCollection && <div className="collection-meta">
                <div className="tags">{activePrompt.tags.map((tag) => <span key={tag}>#{highlightText(tag, query)}</span>)}</div>
                {activePrompt.aliases.length > 0 && <div className="aliases">别名：{activePrompt.aliases.map((alias, index) => <span key={alias}>{index > 0 && " · "}{highlightText(alias, query)}</span>)}</div>}
              </div>}
              {!selectedGroup.isShortCollection && <section className="prompt-content" ref={(element) => { if (element) promptRefs.current.set(activePrompt.id, element); else promptRefs.current.delete(activePrompt.id); }}>
                <div className="tags">{activePrompt.tags.map((tag) => <span key={tag}>#{highlightText(tag, query)}</span>)}</div>
                {activePrompt.aliases.length > 0 && <div className="aliases">别名：{activePrompt.aliases.map((alias, index) => <span key={alias}>{index > 0 && " · "}{highlightText(alias, query)}</span>)}</div>}
                <pre>{highlightText(activePrompt.body, query)}</pre>
              </section>}
              {selectedGroup.isShortCollection && <div className="short-prompts">{selectedGroup.prompts.map((prompt) => <section className={`short-prompt ${prompt.id === activePrompt.id ? "is-active-match" : ""}`} key={prompt.id} ref={(element) => { if (element) promptRefs.current.set(prompt.id, element); else promptRefs.current.delete(prompt.id); }}><div className="short-prompt-head"><h2>{highlightText(prompt.title, query)}</h2><div className="detail-actions"><button type="button" onClick={() => toggleFavorite(prompt)}>{favorites.has(prompt.id) ? "已收藏" : "收藏"}</button><button className="primary" type="button" onClick={() => copyPrompt(prompt)}>复制</button></div></div><pre>{highlightText(prompt.body, query)}</pre></section>)}</div>}
              {selectedGroup.source !== "bundled" && <button className="open-file" type="button" onClick={() => openOriginal(selectedGroup)}>{selectedGroup.source === "github" ? "在 GitHub 中打开" : "打开原始 Markdown"}</button>}
            </> : <div className="empty detail-empty">选择一条提示词查看内容</div>}
          </article>
        </section>
      )}
      <footer><span>{status}</span><span>{query ? `${sourceFilterLabel(sourceFilter)} · 匹配` : sourceFilterLabel(sourceFilter)} · Enter 复制 · ↑↓ 文件 · ←→ 条目 · Esc 清空</span></footer>
    </main>
  );
}

export default App;
