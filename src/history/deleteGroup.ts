import type { AppState, CompletedHistoryItem } from "../types";
import { pruneHistory } from "./pruneHistory";

export const deleteGroupInState = (
  prev: AppState,
  groupId: string,
): AppState => {
  const group = prev.groups.find((g) => g.id === groupId);
  if (!group) return prev;

  const completedAt = Date.now();
  const newHistoryItems: CompletedHistoryItem[] = group.todos
    .filter((todo) => todo.completedAt === null)
    .map((todo) => ({
      id: todo.id,
      groupId: group.id,
      groupTitle: group.title,
      text: todo.text,
      completedAt,
    }));

  const remainingHistory = prev.completedHistory.filter(
    (h) => !newHistoryItems.some((item) => item.id === h.id),
  );

  return {
    ...prev,
    groups: prev.groups.filter((g) => g.id !== groupId),
    completedHistory: pruneHistory([...newHistoryItems, ...remainingHistory]),
  };
};
