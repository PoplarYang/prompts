export type PromptSource = "bundled" | "local" | "github";

export type Prompt = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  aliases: string[];
  path: string;
  body: string;
  source: PromptSource;
  short: boolean;
  collectionTitle: string;
};

export type PromptIndex = { prompts: Prompt[] };
export type PromptFile = { path: string; raw: string };

function parseScalar(value: string): string | string[] | boolean {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  }
  return trimmed.replace(/^['"]|['"]$/g, "");
}

function parseFrontmatter(raw: string): { meta: Record<string, string | string[] | boolean>; body: string } {
  if (!raw.startsWith("---\n")) return { meta: {}, body: raw };
  const closing = raw.indexOf("\n---", 4);
  if (closing === -1) return { meta: {}, body: raw };

  const meta: Record<string, string | string[] | boolean> = {};
  for (const line of raw.slice(4, closing).split("\n")) {
    const separator = line.indexOf(":");
    if (separator > 0) meta[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }
  return { meta, body: raw.slice(closing + 4).replace(/^\n+/, "") };
}

function asList(value: string | string[] | boolean | undefined): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === "string" && value ? [value] : [];
}

function titleFromPath(path: string): string {
  return path.split("/").pop()!.replace(/\.md$/i, "").split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function splitSections(body: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;
  let inFence = false;
  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    const heading = !inFence ? line.match(/^##\s+(.+?)\s*$/) : null;
    if (heading) {
      current = { title: heading[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.length > 1
    ? sections.map((section) => ({ title: section.title, body: `${section.lines.join("\n").trim()}\n` }))
    : [{ title: "", body }];
}

export function parsePromptFiles(files: PromptFile[], source: PromptSource): PromptIndex {
  const prompts: Prompt[] = [];
  for (const file of files) {
    const { meta, body } = parseFrontmatter(file.raw);
    const short = meta.short === true;
    const sections = short ? splitSections(body) : [{ title: "", body }];
    const collectionTitle = typeof meta.title === "string" ? meta.title : titleFromPath(file.path);
    for (const [index, section] of sections.entries()) {
      prompts.push({
        id: `${source}:${file.path}${sections.length > 1 ? `#${index + 1}` : ""}`,
        title: section.title || collectionTitle,
        description: typeof meta.description === "string" ? meta.description : "",
        tags: asList(meta.tags),
        category: typeof meta.category === "string" ? meta.category : file.path.split("/").slice(-2, -1)[0] || "other",
        aliases: asList(meta.aliases),
        path: file.path,
        body: `${section.body.trimEnd()}\n`,
        source,
        short,
        collectionTitle,
      });
    }
  }
  return { prompts };
}

function duplicateKey(prompt: Prompt): string {
  const body = prompt.body.replace(/\r\n?/g, "\n").trim();
  return `${prompt.title.trim()}\u0000${body}`;
}

export function mergeDuplicatePromptSources(prompts: Prompt[]): Prompt[] {
  const firstSourceByKey = new Map<string, PromptSource>();
  return prompts.filter((prompt) => {
    const key = duplicateKey(prompt);
    const firstSource = firstSourceByKey.get(key);
    if (!firstSource) {
      firstSourceByKey.set(key, prompt.source);
      return true;
    }
    return firstSource === prompt.source;
  });
}

export type PromptSourceFilter = PromptSource | "all";

export function filterPromptsBySource(prompts: Prompt[], source: PromptSourceFilter): Prompt[] {
  if (source === "all") return mergeDuplicatePromptSources(prompts);
  return prompts.filter((prompt) => prompt.source === source);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function levenshteinDistance(left: string, right: string): number {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function fuzzyIncludes(value: string, term: string): boolean {
  const normalized = normalize(value);
  if (!term || normalized.includes(term)) return true;
  if (term.length < 3) return false;

  return normalized
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter(Boolean)
    .some((word) => {
      if (word.includes(term) || term.includes(word)) return true;
      return levenshteinDistance(word, term) <= (term.length >= 5 ? 2 : 1);
    });
}

function scoreField(value: string, term: string, exact: number, partial: number, fuzzy: number): number {
  const normalized = normalize(value);
  if (normalized === term) return exact;
  if (normalized.includes(term)) return partial;
  return fuzzyIncludes(normalized, term) ? fuzzy : 0;
}

export function getHighlightCandidates(value: string, query: string): string[] {
  const terms = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  if (!terms.length) return [];

  const candidates = new Set(terms);
  const words = value.match(/[a-z0-9\u4e00-\u9fff]+/gi) ?? [];
  words.forEach((word) => {
    const normalizedWord = normalize(word);
    terms.forEach((term) => {
      if (normalizedWord === term || normalizedWord.includes(term)) return;
      if (term.includes(normalizedWord) || (term.length >= 3 && fuzzyIncludes(normalizedWord, term))) candidates.add(word);
    });
  });
  return [...candidates].sort((left, right) => right.length - left.length);
}

export function searchPrompts(prompts: Prompt[], query: string, favorites: Set<string>, recentIds: string[]): Prompt[] {
  const terms = query.trim().split(/\s+/).map(normalize).filter(Boolean);
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  return prompts
    .filter((prompt) => {
      const fields = [prompt.title, prompt.description, prompt.path, prompt.category, ...prompt.tags, ...prompt.aliases, prompt.body];
      return terms.every((term) => fields.some((field) => fuzzyIncludes(field, term)));
    })
    .sort((left, right) => {
      const score = (prompt: Prompt) => {
        const match = terms.reduce((value, term) => value + (
          scoreField(prompt.title, term, 320, 210, 140) ||
          Math.max(...prompt.aliases.map((alias) => scoreField(alias, term, 280, 190, 120)), 0) ||
          scoreField(prompt.tags.join(" "), term, 180, 150, 80) ||
          scoreField(prompt.description, term, 120, 95, 55) ||
          scoreField(prompt.path, term, 90, 70, 35) ||
          scoreField(prompt.body, term, 55, 35, 15)
        ), 0);
        return match + (favorites.has(prompt.id) ? 30 : 0) + (recentRank.has(prompt.id) ? 20 - recentRank.get(prompt.id)! : 0);
      };
      return score(right) - score(left) || left.title.localeCompare(right.title);
    });
}
