export type SyncStatus =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "synced"; at: number }
  | { kind: "retrying"; nextAttemptAt: number }
  | { kind: "paused-too-large"; bytes: number }
  | { kind: "error"; message: string };

const SYNC_HINT =
  "Saved to Chrome sync storage. Reaches other devices only if Chrome sync is enabled for extensions.";

export const syncStatusLabel = (
  status: SyncStatus,
): { text: string; title: string } => {
  switch (status.kind) {
    case "idle":
      return { text: "Sync", title: SYNC_HINT };
    case "syncing":
      return { text: "Syncing…", title: SYNC_HINT };
    case "synced":
      return {
        text: "Synced",
        title: `${SYNC_HINT} Last sync ${new Date(status.at).toLocaleTimeString()}.`,
      };
    case "retrying":
      return {
        text: "Sync retrying",
        title: `Sync storage refused the last write. Retrying at ${new Date(status.nextAttemptAt).toLocaleTimeString()}. Your todos are saved locally.`,
      };
    case "paused-too-large":
      return {
        text: "Sync paused: too large",
        title: `Your todos and notes (${Math.round(status.bytes / 1024)} KB) exceed the 100 KB Chrome sync quota. Everything is saved locally; shorten notes or delete groups to resume syncing.`,
      };
    case "error":
      return {
        text: "Sync error",
        title: `${status.message} Your todos are saved locally.`,
      };
  }
};
