import { SYNC_SHADOW_STORAGE_KEY } from "../constants";
import { storageArea } from "../storage/storageArea";
import {
  createEmptySnapshot,
  isSyncSnapshot,
  type SyncSnapshot,
} from "./syncRecords";

// The shadow is the last snapshot this profile reconciled with sync storage.
// It lives in the *local* area: every diff, echo check and merge decision is
// made against it, so it must never travel.
export const loadSyncShadow = (): Promise<SyncSnapshot> =>
  storageArea
    .get(SYNC_SHADOW_STORAGE_KEY)
    .then((stored) =>
      isSyncSnapshot(stored) ? stored : createEmptySnapshot(),
    );

export const saveSyncShadow = (snapshot: SyncSnapshot): Promise<void> =>
  storageArea.set(SYNC_SHADOW_STORAGE_KEY, snapshot);
