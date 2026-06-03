import type { AppState, Group, Todo } from "../types";
import { DEFAULT_GROUP_TITLE } from "../constants";

export const createId = (): string => crypto.randomUUID();

export const createDefaultGroup = (): Group => ({
  id: createId(),
  title: DEFAULT_GROUP_TITLE,
  notes: "",
  todos: [],
});

export const createTodo = (text: string): Todo => ({
  id: createId(),
  text,
  completedAt: null,
  createdAt: Date.now(),
});

export const createDefaultState = (): AppState => ({
  version: 1,
  groups: [createDefaultGroup()],
  completedHistory: [],
  lastBackupAt: null,
});
