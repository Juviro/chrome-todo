import {
  SYNC_GROUP_KEY_PREFIX,
  SYNC_HISTORY_KEY,
  SYNC_META_KEY,
} from "../constants";

export type ParsedSyncKey =
  | { kind: "meta" }
  | { kind: "history"; chunkIndex: number | null }
  | { kind: "group"; groupId: string; chunkIndex: number | null };

export const groupKey = (groupId: string): string =>
  `${SYNC_GROUP_KEY_PREFIX}${groupId}`;

export const chunkKey = (baseKey: string, index: number): string =>
  `${baseKey}#${index}`;

const splitChunkSuffix = (
  key: string,
): { base: string; chunkIndex: number | null } => {
  const hash = key.lastIndexOf("#");
  if (hash === -1) return { base: key, chunkIndex: null };
  const index = Number(key.slice(hash + 1));
  if (!Number.isInteger(index) || index < 0) {
    return { base: key, chunkIndex: null };
  }
  return { base: key.slice(0, hash), chunkIndex: index };
};

export const parseSyncKey = (key: string): ParsedSyncKey | null => {
  if (key === SYNC_META_KEY) return { kind: "meta" };
  const { base, chunkIndex } = splitChunkSuffix(key);
  if (base === SYNC_HISTORY_KEY) return { kind: "history", chunkIndex };
  if (base.startsWith(SYNC_GROUP_KEY_PREFIX)) {
    const groupId = base.slice(SYNC_GROUP_KEY_PREFIX.length);
    if (groupId.length === 0) return null;
    return { kind: "group", groupId, chunkIndex };
  }
  return null;
};

export const isSyncKey = (key: string): boolean => parseSyncKey(key) !== null;
