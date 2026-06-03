import type { AppState } from "../types";

export const moveGroupInState = (
  prev: AppState,
  draggedGroupId: string,
  targetGroupId: string,
): AppState => {
  if (draggedGroupId === targetGroupId) return prev;

  const fromIndex = prev.groups.findIndex((g) => g.id === draggedGroupId);
  const toIndex = prev.groups.findIndex((g) => g.id === targetGroupId);
  if (fromIndex === -1 || toIndex === -1) return prev;

  const groups = [...prev.groups];
  const [dragged] = groups.splice(fromIndex, 1);
  groups.splice(toIndex, 0, dragged);

  return { ...prev, groups };
};
