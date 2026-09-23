import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "../types";
import {
  SYNC_PULL_DEBOUNCE_MS,
  SYNC_PUSH_DEBOUNCE_MS,
  SYNC_RETRY_BASE_MS,
  SYNC_RETRY_MAX_MS,
} from "../constants";
import { syncArea, SyncStorageError } from "../storage/storageArea";
import {
  decodeSnapshot,
  encodeSnapshot,
  measureItems,
  readRemoteMetaVersion,
} from "./chunking";
import { diffForSync } from "./diffForSync";
import { mergeRemoteIntoLocal } from "./mergeRemote";
import { isSyncKey } from "./syncKeys";
import type { SyncSnapshot } from "./syncRecords";
import { loadSyncShadow, saveSyncShadow } from "./syncShadowStorage";
import type { SyncStatus } from "./syncStatus";

type Options = {
  state: AppState | null;
  // Applies a merged state to React and saves it locally; must resolve after
  // the local save so the shadow is never ahead of the local copy.
  applyRemote: (next: AppState) => Promise<void>;
};

type Timer = ReturnType<typeof setTimeout> | null;

const clearTimer = (ref: { current: Timer }) => {
  if (ref.current) clearTimeout(ref.current);
  ref.current = null;
};

const NEWER_FORMAT_MESSAGE =
  "Sync data was written by a newer version of this extension. Update the extension to keep syncing.";

// Mirrors the local state into chrome.storage.sync and folds remote changes
// back in. All work runs through one promise queue so the shadow is only ever
// touched by one task at a time.
export const useSyncEngine = ({ state, applyRemote }: Options) => {
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });

  const stateRef = useRef<AppState | null>(state);
  const applyRemoteRef = useRef(applyRemote);
  const shadowRef = useRef<SyncSnapshot | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pushTimerRef = useRef<Timer>(null);
  const pullTimerRef = useRef<Timer>(null);
  const retryTimerRef = useRef<Timer>(null);
  const backoffAttemptsRef = useRef(0);
  const incompatibleRef = useRef(false);
  // Latest push, for the retry timer (which cannot close over `push` directly).
  const pushRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    stateRef.current = state;
    applyRemoteRef.current = applyRemote;
  }, [state, applyRemote]);

  const enqueue = useCallback((task: () => Promise<void>) => {
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(task)
      .catch((error: unknown) => {
        console.error("sync task failed", error);
      });
    return queueRef.current;
  }, []);

  const pull = useCallback(async () => {
    const shadow = shadowRef.current;
    const local = stateRef.current;
    if (!shadow || !local) return;

    const raw = await syncArea.getAll();
    const remoteVersion = readRemoteMetaVersion(raw);
    if (remoteVersion !== null && remoteVersion > 1) {
      incompatibleRef.current = true;
      setStatus({ kind: "error", message: NEWER_FORMAT_MESSAGE });
      return;
    }
    incompatibleRef.current = false;

    const { snapshot, unresolved } = decodeSnapshot(raw);
    const result = mergeRemoteIntoLocal(local, snapshot, shadow, unresolved);
    if (result.changed) {
      stateRef.current = result.state;
      await applyRemoteRef.current(result.state);
    }
    shadowRef.current = result.shadow;
    await saveSyncShadow(result.shadow);
  }, []);

  const scheduleRetry = useCallback(() => {
    const attempt = backoffAttemptsRef.current;
    backoffAttemptsRef.current = attempt + 1;
    const delay = Math.min(SYNC_RETRY_BASE_MS * 2 ** attempt, SYNC_RETRY_MAX_MS);
    clearTimer(retryTimerRef);
    retryTimerRef.current = setTimeout(() => {
      enqueue(() => pushRef.current());
    }, delay);
    setStatus({ kind: "retrying", nextAttemptAt: Date.now() + delay });
  }, [enqueue]);

  const push = useCallback(async (): Promise<void> => {
    const shadow = shadowRef.current;
    const local = stateRef.current;
    if (!shadow || !local || incompatibleRef.current) return;

    const plan = diffForSync(local, shadow, Date.now());
    if (plan.isEmpty) {
      setStatus({ kind: "synced", at: Date.now() });
      return;
    }

    // Pre-flight: never attempt a write that cannot fit. Failed writes may
    // still count against the write budget.
    const { bytes, count } = measureItems(encodeSnapshot(plan.shadow));
    if (bytes > syncArea.quota.bytes || count > syncArea.quota.maxItems) {
      setStatus({ kind: "paused-too-large", bytes });
      return;
    }

    setStatus({ kind: "syncing" });
    // Advance the shadow before writing so the echo of our own write, which
    // fires onChanged in this very page, compares equal and is ignored.
    shadowRef.current = plan.shadow;
    try {
      await syncArea.setMany(plan.set);
      if (plan.remove.length > 0) await syncArea.remove(plan.remove);
      await saveSyncShadow(plan.shadow);
      backoffAttemptsRef.current = 0;
      setStatus({ kind: "synced", at: Date.now() });
    } catch (error) {
      shadowRef.current = shadow;
      const kind = error instanceof SyncStorageError ? error.kind : "unknown";
      if (kind === "quota-total" || kind === "max-items") {
        setStatus({ kind: "paused-too-large", bytes });
        return;
      }
      if (kind === "quota-item") {
        // Chunking should make this impossible; surface it rather than loop.
        setStatus({
          kind: "error",
          message: "A group is too large for Chrome sync storage.",
        });
        return;
      }
      scheduleRetry();
    }
  }, [scheduleRetry]);

  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  // Start once the local state exists: subscribe first so nothing is missed,
  // then reconcile (shadow + remote), then push whatever is local-only.
  const hasState = state !== null;
  useEffect(() => {
    if (!hasState) return;

    const unsubscribe = syncArea.subscribe((changes) => {
      if (!Object.keys(changes).some(isSyncKey)) return;
      clearTimer(pullTimerRef);
      pullTimerRef.current = setTimeout(() => {
        enqueue(pull);
      }, SYNC_PULL_DEBOUNCE_MS);
    });

    enqueue(async () => {
      shadowRef.current = await loadSyncShadow();
      await pull();
    });
    enqueue(push);

    return () => {
      unsubscribe();
      clearTimer(pullTimerRef);
      clearTimer(pushTimerRef);
      clearTimer(retryTimerRef);
    };
  }, [hasState, enqueue, pull, push]);

  // Debounced push on every state change. Typing and drag-over spam collapse
  // into one write once the user pauses.
  useEffect(() => {
    if (!state) return;
    clearTimer(pushTimerRef);
    pushTimerRef.current = setTimeout(() => {
      enqueue(push);
    }, SYNC_PUSH_DEBOUNCE_MS);
    return () => clearTimer(pushTimerRef);
  }, [state, enqueue, push]);

  // Immediate push of an explicit state (backup restore): bypasses the debounce.
  const pushNow = useCallback(
    (next: AppState) => {
      stateRef.current = next;
      clearTimer(pushTimerRef);
      enqueue(push);
    },
    [enqueue, push],
  );

  return { status, pushNow };
};
