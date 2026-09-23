export const STORAGE_KEY = "APP_STATE_V1";
export const LOOT_STREAK_STORAGE_KEY = "LOOT_STREAK_V1";
export const DEFAULT_GROUP_TITLE = "Inbox";
export const SAVE_DEBOUNCE_MS = 300;
export const HISTORY_MAX_ITEMS = 30;
export const HISTORY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Sync (chrome.storage.sync) — see CLAUDE.md «Sync».
export const SYNC_META_KEY = "SYNC_META_V1";
export const SYNC_HISTORY_KEY = "SYNC_HISTORY_V1";
export const SYNC_GROUP_KEY_PREFIX = "SYNC_GROUP_V1:";
export const SYNC_SHADOW_STORAGE_KEY = "SYNC_SHADOW_V1";
export const SYNC_PUSH_DEBOUNCE_MS = 1500;
export const SYNC_PULL_DEBOUNCE_MS = 150;
export const SYNC_CHUNK_BYTES = 7000;
export const SYNC_TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SYNC_RETRY_BASE_MS = 5000;
export const SYNC_RETRY_MAX_MS = 60000;
