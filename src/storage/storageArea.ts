export type StorageArea = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
};

export type SyncChange = { newValue?: unknown; oldValue?: unknown };

export type SyncQuota = {
  bytes: number;
  bytesPerItem: number;
  maxItems: number;
};

export type SyncStorageArea = {
  getAll: () => Promise<Record<string, unknown>>;
  setMany: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
  getBytesInUse: () => Promise<number>;
  quota: SyncQuota;
  subscribe: (
    listener: (changes: Record<string, SyncChange>) => void,
  ) => () => void;
};

export type SyncErrorKind =
  | "quota-item"
  | "quota-total"
  | "max-items"
  | "rate-limit"
  | "unknown";

export class SyncStorageError extends Error {
  kind: SyncErrorKind;

  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.name = "SyncStorageError";
    this.kind = kind;
  }
}

// Chrome's documented defaults; used when the runtime constants are missing
// (dev server) so quota handling can be exercised outside the extension.
const CHROME_SYNC_QUOTA: SyncQuota = {
  bytes: 102_400,
  bytesPerItem: 8_192,
  maxItems: 512,
};

const classifySyncError = (message: string): SyncErrorKind => {
  if (message.includes("QUOTA_BYTES_PER_ITEM")) return "quota-item";
  if (message.includes("QUOTA_BYTES")) return "quota-total";
  if (message.includes("MAX_ITEMS")) return "max-items";
  if (message.includes("MAX_WRITE_OPERATIONS")) return "rate-limit";
  return "unknown";
};

const rejectOnLastError = (reject: (error: SyncStorageError) => void) => {
  const message = chrome.runtime.lastError?.message;
  if (message === undefined) return false;
  reject(new SyncStorageError(classifySyncError(message), message));
  return true;
};

const extensionArea: StorageArea = {
  get: (key) =>
    new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => resolve(result[key]));
    }),
  set: (key, value) =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    }),
};

// Factory rather than a literal: `chrome` is not even declared on the dev
// server, so touching its quota constants must wait until we know it exists.
const createExtensionSyncArea = (): SyncStorageArea => ({
  getAll: () =>
    new Promise((resolve, reject) => {
      chrome.storage.sync.get(null, (result) => {
        if (rejectOnLastError(reject)) return;
        resolve(result ?? {});
      });
    }),
  setMany: (items) =>
    new Promise((resolve, reject) => {
      chrome.storage.sync.set(items, () => {
        if (rejectOnLastError(reject)) return;
        resolve();
      });
    }),
  remove: (keys) =>
    new Promise((resolve, reject) => {
      if (keys.length === 0) {
        resolve();
        return;
      }
      chrome.storage.sync.remove(keys, () => {
        if (rejectOnLastError(reject)) return;
        resolve();
      });
    }),
  getBytesInUse: () =>
    new Promise((resolve, reject) => {
      chrome.storage.sync.getBytesInUse(null, (bytes) => {
        if (rejectOnLastError(reject)) return;
        resolve(bytes);
      });
    }),
  quota: {
    bytes: chrome.storage.sync.QUOTA_BYTES ?? CHROME_SYNC_QUOTA.bytes,
    bytesPerItem:
      chrome.storage.sync.QUOTA_BYTES_PER_ITEM ?? CHROME_SYNC_QUOTA.bytesPerItem,
    maxItems: chrome.storage.sync.MAX_ITEMS ?? CHROME_SYNC_QUOTA.maxItems,
  },
  subscribe: (listener) => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "sync") return;
      listener(changes);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  },
});

// Outside the packaged extension (Vite dev server, `npm run preview`) there is no
// chrome.storage, so persistence falls back to localStorage. Same async contract,
// different backend — callers cannot tell the difference.
const localStorageArea: StorageArea = {
  get: (key) =>
    Promise.resolve().then(() => {
      const raw = localStorage.getItem(key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return undefined;
      }
    }),
  set: (key, value) =>
    Promise.resolve().then(() => {
      localStorage.setItem(key, JSON.stringify(value));
    }),
};

// The sync emulation namespaces its keys under `sync:` in the same localStorage
// and enforces Chrome's quotas, so the paused/error paths can be tested in dev.
// The `storage` window event only fires in *other* tabs, which mirrors how
// another device sees a write — two dev tabs behave like two devices.
const LOCAL_SYNC_PREFIX = "sync:";

const localSyncKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(LOCAL_SYNC_PREFIX)) keys.push(key);
  }
  return keys;
};

const utf8Length = (value: string): number =>
  new TextEncoder().encode(value).length;

const localStorageSyncArea: SyncStorageArea = {
  getAll: () =>
    Promise.resolve().then(() => {
      const result: Record<string, unknown> = {};
      for (const storageKey of localSyncKeys()) {
        const raw = localStorage.getItem(storageKey);
        if (raw === null) continue;
        try {
          result[storageKey.slice(LOCAL_SYNC_PREFIX.length)] = JSON.parse(raw);
        } catch {
          // Corrupt entry: skip it, same as an unreadable remote record.
        }
      }
      return result;
    }),
  setMany: (items) =>
    Promise.resolve().then(() => {
      const quota = CHROME_SYNC_QUOTA;
      const encoded = Object.entries(items).map(
        ([key, value]) => [key, JSON.stringify(value)] as const,
      );
      for (const [key, json] of encoded) {
        if (utf8Length(key) + utf8Length(json) > quota.bytesPerItem) {
          throw new SyncStorageError(
            "quota-item",
            `QUOTA_BYTES_PER_ITEM quota exceeded for key ${key}`,
          );
        }
      }
      const existing = new Map<string, string>();
      for (const storageKey of localSyncKeys()) {
        existing.set(
          storageKey.slice(LOCAL_SYNC_PREFIX.length),
          localStorage.getItem(storageKey) ?? "",
        );
      }
      for (const [key, json] of encoded) existing.set(key, json);
      if (existing.size > quota.maxItems) {
        throw new SyncStorageError("max-items", "MAX_ITEMS quota exceeded");
      }
      let total = 0;
      for (const [key, json] of existing) {
        total += utf8Length(key) + utf8Length(json);
      }
      if (total > quota.bytes) {
        throw new SyncStorageError("quota-total", "QUOTA_BYTES quota exceeded");
      }
      for (const [key, json] of encoded) {
        localStorage.setItem(LOCAL_SYNC_PREFIX + key, json);
      }
    }),
  remove: (keys) =>
    Promise.resolve().then(() => {
      for (const key of keys) localStorage.removeItem(LOCAL_SYNC_PREFIX + key);
    }),
  getBytesInUse: () =>
    Promise.resolve().then(() => {
      let total = 0;
      for (const storageKey of localSyncKeys()) {
        total +=
          utf8Length(storageKey.slice(LOCAL_SYNC_PREFIX.length)) +
          utf8Length(localStorage.getItem(storageKey) ?? "");
      }
      return total;
    }),
  quota: CHROME_SYNC_QUOTA,
  subscribe: (listener) => {
    const handler = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (!event.key?.startsWith(LOCAL_SYNC_PREFIX)) return;
      const key = event.key.slice(LOCAL_SYNC_PREFIX.length);
      const parse = (raw: string | null): unknown => {
        if (raw === null) return undefined;
        try {
          return JSON.parse(raw);
        } catch {
          return undefined;
        }
      };
      listener({
        [key]: { newValue: parse(event.newValue), oldValue: parse(event.oldValue) },
      });
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};

const hasExtensionStorage = (): boolean =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

const resolveArea = (): StorageArea => {
  if (hasExtensionStorage()) return extensionArea;
  // Loud on purpose: in the packaged extension this means the `storage`
  // permission is gone, and todos would silently land in the wrong place.
  console.warn(
    "chrome.storage unavailable — persisting to localStorage instead.",
  );
  return localStorageArea;
};

const resolveSyncArea = (): SyncStorageArea =>
  hasExtensionStorage() ? createExtensionSyncArea() : localStorageSyncArea;

export const storageArea: StorageArea = resolveArea();
export const syncArea: SyncStorageArea = resolveSyncArea();
