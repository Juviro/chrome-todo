import type { AppState } from "../types";
import {
  SYNC_HISTORY_KEY,
  SYNC_META_KEY,
  SYNC_TOMBSTONE_TTL_MS,
} from "../constants";
import { chunkKey, groupKey } from "./syncKeys";
import { chunkKeysFor, encodeDoc, encodeTombstone } from "./chunking";
import {
  canonicalGroupString,
  canonicalHistoryString,
  toGroupPayload,
  toHistoryPayload,
  type SyncMetaRecord,
  type SyncSnapshot,
} from "./syncRecords";

export type SyncWritePlan = {
  set: Record<string, unknown>;
  remove: string[];
  // The shadow as it will be once the plan has been applied.
  shadow: SyncSnapshot;
  isEmpty: boolean;
};

const sameOrder = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

// Computes what has to be written to sync storage so that it reflects `state`,
// given `shadow` (what we last agreed with sync storage). Pure.
export const diffForSync = (
  state: AppState,
  shadow: SyncSnapshot,
  now: number,
): SyncWritePlan => {
  const set: Record<string, unknown> = {};
  const remove: string[] = [];
  const nextShadow: SyncSnapshot = {
    meta: shadow.meta,
    history: shadow.history,
    groups: { ...shadow.groups },
  };

  const localIds = new Set<string>();
  for (const group of state.groups) {
    localIds.add(group.id);
    const key = groupKey(group.id);
    const canonical = canonicalGroupString(group);
    const shadowDoc = shadow.groups[group.id];
    const unchanged =
      shadowDoc?.payload !== null &&
      shadowDoc !== undefined &&
      canonicalGroupString(shadowDoc.payload) === canonical;
    if (unchanged) continue;

    const encoded = encodeDoc(key, canonical, now);
    Object.assign(set, encoded.items);
    if (shadowDoc && shadowDoc.header.chunkCount > encoded.header.chunkCount) {
      for (let i = encoded.header.chunkCount; i < shadowDoc.header.chunkCount; i += 1) {
        remove.push(chunkKey(key, i));
      }
    }
    nextShadow.groups[group.id] = {
      header: encoded.header,
      payload: toGroupPayload(group),
    };
  }

  for (const [id, shadowDoc] of Object.entries(shadow.groups)) {
    if (localIds.has(id)) continue;
    const key = groupKey(id);
    if (shadowDoc.payload !== null) {
      // Live remotely, gone locally: tombstone it and drop its chunks.
      const encoded = encodeTombstone(key, now);
      Object.assign(set, encoded.items);
      remove.push(...chunkKeysFor(key, shadowDoc.header));
      nextShadow.groups[id] = { header: encoded.header, payload: null };
    } else if (now - shadowDoc.header.updatedAt > SYNC_TOMBSTONE_TTL_MS) {
      remove.push(key);
      delete nextShadow.groups[id];
    }
  }

  const historyCanonical = canonicalHistoryString(state.completedHistory);
  const shadowHistory = shadow.history?.payload
    ? canonicalHistoryString(shadow.history.payload)
    : null;
  if (shadowHistory !== historyCanonical) {
    const encoded = encodeDoc(SYNC_HISTORY_KEY, historyCanonical, now);
    Object.assign(set, encoded.items);
    const previousChunks = shadow.history?.header.chunkCount ?? 0;
    for (let i = encoded.header.chunkCount; i < previousChunks; i += 1) {
      remove.push(chunkKey(SYNC_HISTORY_KEY, i));
    }
    nextShadow.history = {
      header: encoded.header,
      payload: toHistoryPayload(state.completedHistory),
    };
  }

  const groupOrder = state.groups.map((group) => group.id);
  const metaUnchanged =
    shadow.meta !== null &&
    sameOrder(shadow.meta.groupOrder, groupOrder) &&
    shadow.meta.lastBackupAt === state.lastBackupAt;
  if (!metaUnchanged) {
    const meta: SyncMetaRecord = {
      version: 1,
      groupOrder,
      lastBackupAt: state.lastBackupAt,
      updatedAt: now,
    };
    set[SYNC_META_KEY] = meta;
    nextShadow.meta = meta;
  }

  return {
    set,
    remove,
    shadow: nextShadow,
    isEmpty: Object.keys(set).length === 0 && remove.length === 0,
  };
};
