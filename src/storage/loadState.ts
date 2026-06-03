import type { AppState } from "../types";
import { STORAGE_KEY } from "../constants";
import { createDefaultState } from "./defaults";

const isAppState = (value: unknown): value is AppState => {
  if (!value || typeof value !== "object") return false;
  const state = value as AppState;
  return (
    state.version === 1 &&
    Array.isArray(state.groups) &&
    Array.isArray(state.completedHistory) &&
    (state.lastBackupAt === null || typeof state.lastBackupAt === "number")
  );
};

export const loadState = (): Promise<AppState> =>
  new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      if (isAppState(stored)) {
        resolve(stored);
        return;
      }
      resolve(createDefaultState());
    });
  });
