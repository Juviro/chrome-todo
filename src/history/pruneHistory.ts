import type { CompletedHistoryItem } from "../types";
import { HISTORY_MAX_AGE_MS, HISTORY_MAX_ITEMS } from "../constants";

export const pruneHistory = (
  items: CompletedHistoryItem[],
): CompletedHistoryItem[] => {
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS;
  const recent = items
    .filter((item) => item.completedAt >= cutoff)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, HISTORY_MAX_ITEMS);
  return recent;
};
