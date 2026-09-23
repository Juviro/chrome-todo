import type { CompletedHistoryItem, Group, Todo } from "../types";

// One synced document = a header under its base key plus `chunkCount` string
// slices of its canonical JSON under `<base>#<i>`. A tombstone is a header with
// `deleted: true` and no chunks.
export type SyncHeader = {
  updatedAt: number;
  chunkCount: number;
  deleted?: true;
};

export type SyncMetaRecord = {
  version: 1;
  groupOrder: string[];
  lastBackupAt: number | null;
  updatedAt: number;
};

export type SyncDoc<T> = {
  header: SyncHeader;
  // null for tombstones
  payload: T | null;
};

// What sync storage holds (remote snapshot) or what we last agreed with it
// (the locally persisted shadow). Tombstones are included in `groups`.
export type SyncSnapshot = {
  meta: SyncMetaRecord | null;
  history: SyncDoc<CompletedHistoryItem[]> | null;
  groups: Record<string, SyncDoc<Group>>;
};

export const createEmptySnapshot = (): SyncSnapshot => ({
  meta: null,
  history: null,
  groups: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSyncHeader = (value: unknown): value is SyncHeader => {
  if (!isRecord(value)) return false;
  return (
    typeof value.updatedAt === "number" &&
    typeof value.chunkCount === "number" &&
    Number.isInteger(value.chunkCount) &&
    value.chunkCount >= 0 &&
    (value.deleted === undefined || value.deleted === true)
  );
};

export const readMetaVersion = (value: unknown): number | null =>
  isRecord(value) && typeof value.version === "number" ? value.version : null;

export const isSyncMetaRecord = (value: unknown): value is SyncMetaRecord => {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    Array.isArray(value.groupOrder) &&
    value.groupOrder.every((id) => typeof id === "string") &&
    (value.lastBackupAt === null || typeof value.lastBackupAt === "number") &&
    typeof value.updatedAt === "number"
  );
};

const isTodo = (value: unknown): value is Todo => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    (value.completedAt === null || typeof value.completedAt === "number") &&
    typeof value.createdAt === "number"
  );
};

export const isGroupPayload = (value: unknown): value is Group => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.notes === "string" &&
    Array.isArray(value.todos) &&
    value.todos.every(isTodo)
  );
};

const isCompletedHistoryItem = (
  value: unknown,
): value is CompletedHistoryItem => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.groupId === "string" &&
    typeof value.groupTitle === "string" &&
    typeof value.text === "string" &&
    typeof value.completedAt === "number"
  );
};

export const isHistoryPayload = (
  value: unknown,
): value is CompletedHistoryItem[] =>
  Array.isArray(value) && value.every(isCompletedHistoryItem);

export const isSyncSnapshot = (value: unknown): value is SyncSnapshot => {
  if (!isRecord(value)) return false;
  if (!(value.meta === null || isSyncMetaRecord(value.meta))) return false;
  if (!isRecord(value.groups)) return false;
  const isDoc = (doc: unknown, guard: (payload: unknown) => boolean) =>
    isRecord(doc) &&
    isSyncHeader(doc.header) &&
    (doc.payload === null || guard(doc.payload));
  if (!(value.history === null || isDoc(value.history, isHistoryPayload))) {
    return false;
  }
  return Object.values(value.groups).every((doc) =>
    isDoc(doc, isGroupPayload),
  );
};

// Canonical shapes: fixed key order and nothing but the known fields, so
// JSON.stringify yields the same string on every device. Diffing and echo
// detection compare these strings, so this is load-bearing.
export const toGroupPayload = (group: Group): Group => ({
  id: group.id,
  title: group.title,
  notes: group.notes,
  todos: group.todos.map((todo) => ({
    id: todo.id,
    text: todo.text,
    completedAt: todo.completedAt,
    createdAt: todo.createdAt,
  })),
});

export const toHistoryPayload = (
  items: CompletedHistoryItem[],
): CompletedHistoryItem[] =>
  items.map((item) => ({
    id: item.id,
    groupId: item.groupId,
    groupTitle: item.groupTitle,
    text: item.text,
    completedAt: item.completedAt,
  }));

export const canonicalGroupString = (group: Group): string =>
  JSON.stringify(toGroupPayload(group));

export const canonicalHistoryString = (items: CompletedHistoryItem[]): string =>
  JSON.stringify(toHistoryPayload(items));
