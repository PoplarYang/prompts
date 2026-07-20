type PluginEnterAction = {
  code: string;
  type: "text" | "img" | "file" | "regex" | "over" | "window";
  payload: string | Array<{ isFile: boolean; isDirectory: boolean; name: string; path: string }> | { id: number; title: string };
  from: "main" | "panel" | "hotkey" | "reirect";
  option?: { mainPush: boolean };
};

import type { PpNative } from "./types";

declare global {
  interface Window {
    utools: {
      copyText(text: string): boolean;
      hideMainWindow(isRestorePreWindow?: boolean): boolean;
      setSubInput(callback: (details: { text: string }) => void, placeholder?: string, isFocus?: boolean): boolean;
      removeSubInput(): boolean;
      setSubInputValue(text: string): boolean;
      subInputFocus(): boolean;
      onPluginEnter(callback: (action: PluginEnterAction) => void): void;
      onPluginOut(callback: (isKill: boolean) => void): void;
      redirectHotKeySetting(command: string, autocopy?: boolean): void;
      showOpenDialog(options: { title?: string; properties?: string[] }): string[] | undefined;
      shellOpenExternal(url: string): boolean;
    };
    ppNative?: PpNative;
  }
}

export {};
