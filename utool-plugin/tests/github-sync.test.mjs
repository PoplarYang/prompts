import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

async function loadTypeScriptModule(file, dependencies = {}) {
  const source = await readFile(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    fetch: () => Promise.reject(new Error("unexpected network request")),
    require: (request) => dependencies[request],
  }, { filename: file });
  return module.exports;
}

const prompt = await loadTypeScriptModule("src/prompt.ts");
const github = await loadTypeScriptModule("src/github.ts", { "./prompt": prompt });

async function loadPreloadModule(fsMock) {
  const source = await readFile(path.join(root, "public/preload.js"), "utf8");
  const window = { utools: { getPath: () => "/user-data" } };
  vm.runInNewContext(source, {
    window,
    require: (request) => {
      if (request === "node:fs/promises") return fsMock;
      if (request === "node:path") {
        return {
          join: (...parts) => parts.join("/"),
          relative: (from, to) => to.slice(from.length + 1),
          resolve: (...parts) => parts.join("/"),
          sep: "/",
        };
      }
      throw new Error(`Unexpected module request: ${request}`);
    },
    Promise,
    JSON,
    Error,
  }, { filename: "public/preload.js" });
  return window.ppNative;
}

function response({ ok = true, status = 200, json, text = "" }) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text,
  };
}

test("sync falls back to jsDelivr when the GitHub tree request is denied", async () => {
  const requested = [];
  const request = async (url) => {
    requested.push(url);
    if (url.startsWith("https://api.github.com/")) return response({ ok: false, status: 403 });
    if (url.startsWith("https://data.jsdelivr.com/")) {
      return response({ json: { files: [{ name: "/prompts/coding/review.md" }, { name: "/README.md" }] } });
    }
    if (url.startsWith("https://raw.githubusercontent.com/")) return response({ ok: false, status: 404 });
    if (url.startsWith("https://cdn.jsdelivr.net/")) {
      return response({ text: "---\ntitle: Review\ntags: [coding]\n---\n\nReview this code.\n" });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const prompts = await github.syncGitHubPrompts({
    repoUrl: "https://github.com/PoplarYang/prompts",
    branch: "main",
    promptsDirectory: "prompts",
  }, request);

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].id, "github:prompts/coding/review.md");
  assert.equal(prompts[0].source, "github");
  assert.equal(prompts[0].title, "Review");
  assert.ok(requested.some((url) => url.startsWith("https://data.jsdelivr.com/")));
  assert.ok(requested.some((url) => url.startsWith("https://cdn.jsdelivr.net/")));
});

test("repository parsing rejects unsupported repository URLs", () => {
  assert.throws(() => github.parseGitHubRepo("git@github.com:PoplarYang/prompts.git"), /仓库地址/);
  assert.deepEqual(github.filterPromptPaths(["/prompts/a.md", "README.md", "prompts/a.txt"], "prompts"), ["prompts/a.md"]);
  assert.equal(
    github.buildGitHubFileUrl("https://github.com/PoplarYang/prompts", "feature/docs", "prompts/中文 name.md"),
    "https://github.com/PoplarYang/prompts/blob/feature%2Fdocs/prompts/%E4%B8%AD%E6%96%87%20name.md",
  );
});

test("GitHub cache settings normalize harmless input differences and detect real changes", () => {
  assert.deepEqual(
    { ...github.normalizeGitHubSettings({
      repoUrl: " https://github.com/PoplarYang/prompts/ ",
      branch: "",
      promptsDirectory: "/prompts/",
    }) },
    { repoUrl: "https://github.com/PoplarYang/prompts", branch: "main", promptsDirectory: "prompts" },
  );
  assert.equal(
    github.sameGitHubSettings(
      { repoUrl: "https://github.com/PoplarYang/prompts/", branch: "main", promptsDirectory: "/prompts/" },
      { repoUrl: "https://github.com/PoplarYang/prompts", branch: "main", promptsDirectory: "prompts" },
    ),
    true,
  );
  assert.equal(
    github.sameGitHubSettings(
      { repoUrl: "https://github.com/PoplarYang/prompts", branch: "main", promptsDirectory: "prompts" },
      { repoUrl: "https://github.com/PoplarYang/prompts", branch: "release", promptsDirectory: "prompts" },
    ),
    false,
  );
});

test("state writes are serialized and retain the latest update", async () => {
  let concurrentWrites = 0;
  let maxConcurrentWrites = 0;
  let temporaryContents = "";
  let savedContents = "";
  const native = await loadPreloadModule({
    readFile: async () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
    mkdir: async () => {},
    writeFile: async (_path, contents) => {
      concurrentWrites += 1;
      maxConcurrentWrites = Math.max(maxConcurrentWrites, concurrentWrites);
      await Promise.resolve();
      temporaryContents = contents;
      concurrentWrites -= 1;
    },
    rename: async () => { savedContents = temporaryContents; },
    readdir: async () => [],
  });

  await Promise.all([
    native.writeState({ version: "first" }),
    native.writeState({ version: "second" }),
  ]);

  assert.equal(maxConcurrentWrites, 1);
  assert.match(savedContents, /"version": "second"/);
});

test("short prompt sections remain independently copyable while sharing a collection title", () => {
  const index = prompt.parsePromptFiles([{
    path: "prompts/coding/misc.md",
    raw: "---\ntitle: 常用提示词\nshort: true\n---\n\n## 调研产品\n调研内容。\n\n## 调研技术\n技术内容。\n",
  }], "local");

  assert.deepEqual(Array.from(index.prompts, (item) => item.id), ["local:prompts/coding/misc.md#1", "local:prompts/coding/misc.md#2"]);
  assert.ok(Array.from(index.prompts).every((item) => item.short && item.collectionTitle === "常用提示词"));
});

test("enhanced search ranks aliases and finds terms in the full prompt body", () => {
  const index = prompt.parsePromptFiles([
    {
      path: "prompts/coding/review.md",
      raw: "---\ntitle: Code Review\ndescription: Check code quality\ntags: [coding]\naliases: [cr]\n---\n\nInspect implementation risks.\n",
    },
    {
      path: "prompts/writing/rewrite.md",
      raw: "---\ntitle: Rewrite\naliases: [polish]\n---\n\nTurn rough prose into clear writing.\n",
    },
  ], "local");

  assert.deepEqual(Array.from(prompt.searchPrompts(index.prompts, "implementation", new Set(), []).map((item) => item.title)), ["Code Review"]);
  assert.deepEqual(Array.from(prompt.searchPrompts(index.prompts, "cr", new Set(), []).map((item) => item.title)), ["Code Review"]);
  assert.deepEqual(Array.from(prompt.getHighlightCandidates("Inspect implementation risks.", "implementation")), ["implementation"]);
});

test("search retains each matching section from one short prompt file for in-file navigation", () => {
  const index = prompt.parsePromptFiles([{
    path: "prompts/coding/misc.md",
    raw: "---\ntitle: 常用提示词\nshort: true\n---\n\n## 调研产品\n请调研这个产品。\n\n## 调研技术\n请调研这个技术。\n",
  }], "local");

  const matches = prompt.searchPrompts(index.prompts, "调研", new Set(), []);
  assert.deepEqual(Array.from(matches, (item) => item.id), ["local:prompts/coding/misc.md#1", "local:prompts/coding/misc.md#2"]);
});

test("identical prompts merge across sources while preserving duplicates within one source", () => {
  const raw = "---\ntitle: Summarize Article\n---\n\nSummarize this article.\n";
  const githubPrompt = prompt.parsePromptFiles([{ path: "prompts/github.md", raw }], "github").prompts[0];
  const bundledPrompt = { ...githubPrompt, id: "bundled:summarize", source: "bundled", body: githubPrompt.body.replace(/\n/g, "\r\n") };
  const localPrompt = prompt.parsePromptFiles([{ path: "prompts/local.md", raw }], "local").prompts[0];

  const secondGitHubPrompt = { ...githubPrompt, id: "github:duplicate" };
  const merged = prompt.mergeDuplicatePromptSources([githubPrompt, secondGitHubPrompt, localPrompt, bundledPrompt]);
  assert.deepEqual(Array.from(merged, (item) => item.id), [githubPrompt.id, secondGitHubPrompt.id]);
});

test("source filtering keeps the merged all view while exposing each original source", () => {
  const raw = "---\ntitle: Shared Prompt\n---\n\nSame body.\n";
  const githubPrompt = prompt.parsePromptFiles([{ path: "prompts/github.md", raw }], "github").prompts[0];
  const localPrompt = prompt.parsePromptFiles([{ path: "prompts/local.md", raw }], "local").prompts[0];
  const bundledPrompt = { ...githubPrompt, id: "bundled:shared", source: "bundled" };
  const prompts = [githubPrompt, localPrompt, bundledPrompt];

  assert.deepEqual(Array.from(prompt.filterPromptsBySource(prompts, "all"), (item) => item.id), [githubPrompt.id]);
  assert.deepEqual(Array.from(prompt.filterPromptsBySource(prompts, "github"), (item) => item.id), [githubPrompt.id]);
  assert.deepEqual(Array.from(prompt.filterPromptsBySource(prompts, "local"), (item) => item.id), [localPrompt.id]);
  assert.deepEqual(Array.from(prompt.filterPromptsBySource(prompts, "bundled"), (item) => item.id), [bundledPrompt.id]);
});
