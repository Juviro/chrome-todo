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

// True for a state nobody has touched yet: the single default group, empty,
// no history, no backup. Sync uses this to avoid pushing a duplicate «Inbox»
// from a freshly installed device.
export const isPristineDefaultState = (state: AppState): boolean =>
  state.groups.length === 1 &&
  state.groups[0].title === DEFAULT_GROUP_TITLE &&
  state.groups[0].notes === "" &&
  state.groups[0].todos.length === 0 &&
  state.completedHistory.length === 0 &&
  state.lastBackupAt === null;
