import { parsePromptFiles, type Prompt } from "./prompt";

export type GitHubSettings = {
  repoUrl: string;
  branch: string;
  promptsDirectory: string;
};

type Repo = { owner: string; name: string };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function stripSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function normalizeGitHubSettings(settings: GitHubSettings): GitHubSettings {
  const promptsDirectory = stripSlashes(settings.promptsDirectory.trim());
  return {
    repoUrl: settings.repoUrl.trim().replace(/\/+$/, ""),
    branch: settings.branch.trim() || "main",
    promptsDirectory: promptsDirectory || "prompts",
  };
}

export function sameGitHubSettings(left: GitHubSettings, right: GitHubSettings): boolean {
  const normalizedLeft = normalizeGitHubSettings(left);
  const normalizedRight = normalizeGitHubSettings(right);
  return normalizedLeft.repoUrl === normalizedRight.repoUrl
    && normalizedLeft.branch === normalizedRight.branch
    && normalizedLeft.promptsDirectory === normalizedRight.promptsDirectory;
}

export function parseGitHubRepo(url: string): Repo {
  const match = url.trim().match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)\/?$/);
  if (!match) throw new Error("仓库地址应为 https://github.com/owner/repository");
  return { owner: match[1], name: match[2].replace(/\.git$/, "") };
}

export function buildGitHubFileUrl(repoUrl: string, branch: string, path: string): string {
  const repo = parseGitHubRepo(repoUrl);
  const encodedBranch = encodeURIComponent(branch.trim() || "main");
  const encodedPath = path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${repo.owner}/${repo.name}/blob/${encodedBranch}/${encodedPath}`;
}

export function filterPromptPaths(paths: string[], promptRoot: string): string[] {
  const root = `${stripSlashes(promptRoot)}/`;
  return paths
    .map((path) => path.replace(/^\/+/, ""))
    .filter((path) => path.startsWith(root) && path.toLowerCase().endsWith(".md"))
    .sort();
}

async function listPromptFilesFromGitHub(repo: Repo, branch: string, promptRoot: string, request: FetchLike): Promise<string[]> {
  const response = await request(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`GitHub tree request returned ${response.status}`);
  const tree = await response.json() as { tree?: Array<{ type?: string; path?: string }> };
  return filterPromptPaths(
    (tree.tree || []).filter((item) => item.type === "blob").map((item) => item.path || ""),
    promptRoot,
  );
}

async function listPromptFilesFromJsDelivr(repo: Repo, branch: string, promptRoot: string, request: FetchLike): Promise<string[]> {
  const response = await request(
    `https://data.jsdelivr.com/v1/package/gh/${repo.owner}/${repo.name}@${encodeURIComponent(branch)}/flat`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`jsDelivr file list returned ${response.status}`);
  const data = await response.json() as { files?: Array<{ name?: string }> };
  return filterPromptPaths((data.files || []).map((file) => file.name || ""), promptRoot);
}

async function fetchRawFile(repo: Repo, branch: string, path: string, request: FetchLike): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const githubUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${encodeURIComponent(branch)}/${encodedPath}`;
  const githubResponse = await request(githubUrl, { cache: "no-store" });
  if (githubResponse.ok) return githubResponse.text();

  const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.name}@${encodeURIComponent(branch)}/${encodedPath}`;
  const jsdelivrResponse = await request(jsdelivrUrl, { cache: "no-store" });
  if (!jsdelivrResponse.ok) throw new Error(`提示词文件读取失败：${path}`);
  return jsdelivrResponse.text();
}

export async function syncGitHubPrompts(settings: GitHubSettings, request: FetchLike = fetch): Promise<Prompt[]> {
  const normalizedSettings = normalizeGitHubSettings(settings);
  const repo = parseGitHubRepo(normalizedSettings.repoUrl);
  const { branch, promptsDirectory: promptRoot } = normalizedSettings;

  let paths: string[];
  try {
    paths = await listPromptFilesFromGitHub(repo, branch, promptRoot, request);
  } catch {
    paths = await listPromptFilesFromJsDelivr(repo, branch, promptRoot, request);
  }
  if (!paths.length) throw new Error(`未在 ${promptRoot}/ 下找到 Markdown 提示词`);

  const files = await Promise.all(paths.map(async (path) => ({ path, raw: await fetchRawFile(repo, branch, path, request) })));
  return parsePromptFiles(files, "github").prompts;
}
