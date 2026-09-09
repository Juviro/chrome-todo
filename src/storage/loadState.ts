import type { AppState } from "../types";
import { STORAGE_KEY } from "../constants";
import { createDefaultState } from "./defaults";
import { storageArea } from "./storageArea";

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
  storageArea
    .get(STORAGE_KEY)
    .then((stored) => (isAppState(stored) ? stored : createDefaultState()));
