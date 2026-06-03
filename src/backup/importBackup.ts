import type { AppState, BackupFile } from "../types";

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

const isBackupFile = (value: unknown): value is BackupFile => {
  if (!value || typeof value !== "object") return false;
  const file = value as BackupFile;
  return typeof file.exportedAt === "number" && isAppState(file.appState);
};

export const parseBackupFile = (text: string): AppState | null => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isBackupFile(parsed)) return parsed.appState;
    if (isAppState(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
};
