import type { AppState, BackupFile } from "../types";

export const exportBackup = (appState: AppState): void => {
  const backup: BackupFile = {
    exportedAt: Date.now(),
    appState,
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `todo-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
