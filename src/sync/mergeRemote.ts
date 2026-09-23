import type { AppState, Group } from "../types";
import { SYNC_HISTORY_KEY } from "../constants";
import { isPristineDefaultState } from "../storage/defaults";
import { pruneHistory } from "../history/pruneHistory";
import {
  canonicalGroupString,
  canonicalHistoryString,
  type SyncDoc,
  type SyncSnapshot,
} from "./syncRecords";

export type MergeResult = {
  state: AppState;
  shadow: SyncSnapshot;
  changed: boolean;
};

const isEmptySnapshot = (snapshot: SyncSnapshot): boolean =>
  snapshot.meta === null &&
  snapshot.history === null &&
  Object.keys(snapshot.groups).length === 0;

const isNewer = (
  remote: { header: { updatedAt: number } } | null | undefined,
  shadow: { header: { updatedAt: number } } | null | undefined,
): boolean =>
  remote !== null &&
  remote !== undefined &&
  (!shadow || remote.header.updatedAt > shadow.header.updatedAt);

const stateSignature = (state: AppState): string =>
  JSON.stringify([
    state.groups.map(canonicalGroupString),
    canonicalHistoryString(state.completedHistory),
    state.lastBackupAt,
  ]);

const maxNullable = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

// Folds a remote snapshot into the local state, per group, using the shadow
// (what we last agreed with sync storage) to tell «remote changed» from «local
// changed». Deletion wins in both directions; otherwise the side that changed
// since the shadow wins, and a local change becomes the last write on the
// next push. `unresolved` holds ids whose remote document could not be read
// yet; those are left exactly as they are, locally and in the shadow. Pure.
export const mergeRemoteIntoLocal = (
  local: AppState,
  remote: SyncSnapshot,
  shadow: SyncSnapshot,
  unresolved: ReadonlySet<string> = new Set(),
): MergeResult => {
  const remoteHasLiveGroups = Object.values(remote.groups).some(
    (doc) => doc.payload !== null,
  );
  // Fresh install meeting existing data: drop the untouched default group so
  // the second device does not push a duplicate «Inbox».
  const adoptRemoteWholesale =
    isEmptySnapshot(shadow) &&
    remoteHasLiveGroups &&
    isPristineDefaultState(local);
  const localGroups: Group[] = adoptRemoteWholesale ? [] : local.groups;
  const localById = new Map(localGroups.map((group) => [group.id, group]));

  const nextShadow: SyncSnapshot = { meta: null, history: null, groups: {} };
  const mergedById = new Map<string, Group>();

  const ids = new Set<string>([
    ...localById.keys(),
    ...Object.keys(remote.groups),
    ...Object.keys(shadow.groups),
  ]);

  for (const id of ids) {
    const localGroup = localById.get(id);
    const remoteDoc: SyncDoc<Group> | undefined = remote.groups[id];
    const shadowDoc: SyncDoc<Group> | undefined = shadow.groups[id];

    if (unresolved.has(id)) {
      if (localGroup) mergedById.set(id, localGroup);
      if (shadowDoc) nextShadow.groups[id] = shadowDoc;
      continue;
    }

    if (!remoteDoc) {
      // Not in sync storage (never pushed, or pruned there): keep local, and
      // forget the shadow entry so a live group is re-pushed as new.
      if (localGroup) mergedById.set(id, localGroup);
      continue;
    }

    if (!isNewer(remoteDoc, shadowDoc)) {
      if (localGroup) mergedById.set(id, localGroup);
      if (shadowDoc) nextShadow.groups[id] = shadowDoc;
      continue;
    }

    nextShadow.groups[id] = remoteDoc;
    if (remoteDoc.payload === null) continue; // remote deletion wins

    const shadowLive = shadowDoc !== undefined && shadowDoc.payload !== null;
    if (shadowLive && !localGroup) continue; // pending local deletion wins

    const localDiverged =
      localGroup !== undefined &&
      (!shadowLive ||
        canonicalGroupString(shadowDoc.payload as Group) !==
          canonicalGroupString(localGroup));
    mergedById.set(id, localDiverged ? localGroup : remoteDoc.payload);
  }

  // History: one document, same rule.
  let history = local.completedHistory;
  if (!unresolved.has(SYNC_HISTORY_KEY)) {
    if (remote.history && isNewer(remote.history, shadow.history)) {
      nextShadow.history = remote.history;
      const localCanonical = canonicalHistoryString(local.completedHistory);
      const localDiverged = shadow.history?.payload
        ? canonicalHistoryString(shadow.history.payload) !== localCanonical
        : local.completedHistory.length > 0 && !adoptRemoteWholesale;
      if (!localDiverged && remote.history.payload) {
        history = pruneHistory(remote.history.payload);
      }
    } else if (remote.history) {
      nextShadow.history = shadow.history;
    }
  } else {
    nextShadow.history = shadow.history;
  }

  // Meta: group order and last-backup time.
  const localOrder = localGroups.map((group) => group.id);
  const metaNewer =
    remote.meta !== null &&
    (shadow.meta === null || remote.meta.updatedAt > shadow.meta.updatedAt);
  const metaLocallyDiverged = shadow.meta
    ? !localOrder.every((id, i) => shadow.meta?.groupOrder[i] === id) ||
      localOrder.length !== shadow.meta.groupOrder.length
    : localOrder.length > 0;
  let baseOrder = localOrder;
  if (remote.meta && metaNewer) {
    nextShadow.meta = remote.meta;
    if (!metaLocallyDiverged) baseOrder = remote.meta.groupOrder;
  } else if (remote.meta) {
    nextShadow.meta = shadow.meta;
  }

  const ordered: Group[] = [];
  const placed = new Set<string>();
  for (const id of baseOrder) {
    const group = mergedById.get(id);
    if (group && !placed.has(id)) {
      ordered.push(group);
      placed.add(id);
    }
  }
  for (const id of [...localOrder, ...mergedById.keys()]) {
    const group = mergedById.get(id);
    if (group && !placed.has(id)) {
      ordered.push(group);
      placed.add(id);
    }
  }

  const lastBackupAt = remote.meta
    ? maxNullable(local.lastBackupAt, remote.meta.lastBackupAt)
    : local.lastBackupAt;

  const state: AppState = {
    ...local,
    groups: ordered,
    completedHistory: history,
    lastBackupAt,
  };

  return {
    state,
    shadow: nextShadow,
    changed: stateSignature(state) !== stateSignature(local),
  };
};
