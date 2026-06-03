import type { AppState } from "../types";
import { BACKUP_REMINDER_MS } from "../constants";

export const needsBackupReminder = (state: AppState): boolean => {
  if (state.lastBackupAt === null) return true;
  return Date.now() - state.lastBackupAt > BACKUP_REMINDER_MS;
};
