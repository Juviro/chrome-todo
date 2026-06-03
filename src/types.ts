export type Todo = {
  id: string;
  text: string;
  completedAt: number | null;
  createdAt: number;
};

export type Group = {
  id: string;
  title: string;
  notes: string;
  todos: Todo[];
};

export type CompletedHistoryItem = {
  id: string;
  groupId: string;
  groupTitle: string;
  text: string;
  completedAt: number;
};

export type AppState = {
  version: 1;
  groups: Group[];
  completedHistory: CompletedHistoryItem[];
  lastBackupAt: number | null;
};

export type BackupFile = {
  exportedAt: number;
  appState: AppState;
};
