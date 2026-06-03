import type { AppState } from "../types";

export const markBackedUp = (prev: AppState): AppState => ({
  ...prev,
  lastBackupAt: Date.now(),
});
