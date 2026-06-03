import type { AppState, CompletedHistoryItem } from "../types";
import { pruneHistory } from "./pruneHistory";

export const completeTodoInState = (
  prev: AppState,
  groupId: string,
  todoId: string,
): AppState => {
  const group = prev.groups.find((g) => g.id === groupId);
  const todo = group?.todos.find((t) => t.id === todoId);
  if (!group || !todo) return prev;

  const completedAt = Date.now();
  const historyItem: CompletedHistoryItem = {
    id: todo.id,
    groupId: group.id,
    groupTitle: group.title,
    text: todo.text,
    completedAt,
  };

  return {
    ...prev,
    groups: prev.groups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            todos: g.todos.filter((t) => t.id !== todoId),
          }
        : g,
    ),
    completedHistory: pruneHistory([
      historyItem,
      ...prev.completedHistory.filter((h) => h.id !== todo.id),
    ]),
  };
};
