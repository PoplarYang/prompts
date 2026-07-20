import type { Prompt } from "./prompt";

export type PpPluginState = {
  githubRepoUrl: string;
  githubBranch: string;
  githubPromptsDirectory: string;
  githubCache: Prompt[];
  githubCacheSettings?: {
    repoUrl: string;
    branch: string;
    promptsDirectory: string;
  };
  githubLastSyncedAt: string;
  localRoot: string;
  localPromptsDirectory: string;
  favorites: string[];
  recentIds: string[];
};

export type LocalPromptFile = { path: string; raw: string };

export type PpNative = {
  readState(): Promise<PpPluginState | null>;
  writeState(state: PpPluginState): Promise<void>;
  loadLocalFiles(root: string, promptDirectory: string): Promise<LocalPromptFile[]>;
  openPath(path: string): void;
};
