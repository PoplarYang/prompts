const fs = require("node:fs/promises");
const path = require("node:path");

const utoolsApi = globalThis.utools || window.utools;
const userDataDirectory = typeof utoolsApi?.getPath === "function" ? utoolsApi.getPath("userData") : "";
const stateDirectory = userDataDirectory ? path.join(userDataDirectory, "pp-utool-plugin") : "";
const statePath = stateDirectory ? path.join(stateDirectory, "state.json") : "";
let pendingStateWrite = Promise.resolve();

async function readState() {
  if (!statePath) return null;
  try {
    return JSON.parse(await fs.readFile(statePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeState(state) {
  if (!statePath) throw new Error("uTools userData path is unavailable");
  const write = pendingStateWrite.catch(() => undefined).then(async () => {
    await fs.mkdir(stateDirectory, { recursive: true });
    const temporaryPath = `${statePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, statePath);
  });
  pendingStateWrite = write;
  return write;
}

async function collectMarkdownFiles(directory, root, files) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdownFiles(absolutePath, root, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push({
        path: path.relative(root, absolutePath).split(path.sep).join("/"),
        raw: await fs.readFile(absolutePath, "utf8"),
      });
    }
  }
}

async function loadLocalFiles(root, promptDirectory) {
  const promptRoot = path.resolve(root, promptDirectory || "prompts");
  const files = [];
  await collectMarkdownFiles(promptRoot, root, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

window.ppNative = {
  readState,
  writeState,
  loadLocalFiles,
  openPath: (target) => window.utools.shellOpenPath(target),
};
