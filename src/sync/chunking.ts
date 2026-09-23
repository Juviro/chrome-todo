import type { CompletedHistoryItem, Group } from "../types";
import { SYNC_CHUNK_BYTES, SYNC_HISTORY_KEY, SYNC_META_KEY } from "../constants";
import { chunkKey, groupKey, parseSyncKey } from "./syncKeys";
import {
  isGroupPayload,
  isHistoryPayload,
  isSyncHeader,
  isSyncMetaRecord,
  readMetaVersion,
  type SyncDoc,
  type SyncHeader,
  type SyncSnapshot,
} from "./syncRecords";

const encoder = new TextEncoder();

// Chrome charges key length + JSON length per item; UTF-8 bytes are the
// conservative estimate whichever unit it actually uses.
export const measureBytes = (value: unknown): number =>
  encoder.encode(JSON.stringify(value)).length;

export const measureItems = (
  items: Record<string, unknown>,
): { bytes: number; count: number } => {
  let bytes = 0;
  let count = 0;
  for (const [key, value] of Object.entries(items)) {
    bytes += encoder.encode(key).length + measureBytes(value);
    count += 1;
  }
  return { bytes, count };
};

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;

// Slices `json` into string chunks whose *stored* size (JSON-encoded, so with
// quotes and escapes) stays within `maxBytes`. Never splits a surrogate pair.
export const splitIntoChunks = (json: string, maxBytes: number): string[] => {
  if (json.length === 0) return [""];
  const chunks: string[] = [];
  let start = 0;
  while (start < json.length) {
    // Each code unit encodes to at least one byte, so `maxBytes` code units is
    // an upper bound; shrink until the encoded slice fits.
    let end = Math.min(json.length, start + maxBytes);
    let slice = json.slice(start, end);
    while (end > start + 1 && measureBytes(slice) > maxBytes) {
      const over = measureBytes(slice) - maxBytes;
      end = Math.max(start + 1, end - Math.max(1, Math.ceil(over / 4)));
      slice = json.slice(start, end);
    }
    if (end < json.length && isHighSurrogate(json.charCodeAt(end - 1))) {
      end -= 1;
      slice = json.slice(start, end);
    }
    chunks.push(slice);
    start = end;
  }
  return chunks;
};

export const encodeDoc = (
  baseKey: string,
  canonicalJson: string,
  updatedAt: number,
): { items: Record<string, unknown>; header: SyncHeader } => {
  const chunks = splitIntoChunks(canonicalJson, SYNC_CHUNK_BYTES);
  const header: SyncHeader = { updatedAt, chunkCount: chunks.length };
  const items: Record<string, unknown> = { [baseKey]: header };
  chunks.forEach((chunk, index) => {
    items[chunkKey(baseKey, index)] = chunk;
  });
  return { items, header };
};

export const encodeTombstone = (
  baseKey: string,
  updatedAt: number,
): { items: Record<string, unknown>; header: SyncHeader } => {
  const header: SyncHeader = { updatedAt, chunkCount: 0, deleted: true };
  return { items: { [baseKey]: header }, header };
};

export const chunkKeysFor = (baseKey: string, header: SyncHeader): string[] =>
  Array.from({ length: header.chunkCount }, (_, i) => chunkKey(baseKey, i));

export type DecodeResult<T> =
  | { status: "ok"; doc: SyncDoc<T> }
  // Header is valid but chunks are missing or unreadable — typically a
  // multi-key write that has only partially arrived. Keep the local copy.
  | { status: "unresolved" }
  | { status: "absent" };

export const decodeDoc = <T>(
  raw: Record<string, unknown>,
  baseKey: string,
  guard: (value: unknown) => value is T,
): DecodeResult<T> => {
  const header = raw[baseKey];
  if (!isSyncHeader(header)) return { status: "absent" };
  if (header.deleted) {
    return {
      status: "ok",
      doc: { header: { ...header, chunkCount: 0 }, payload: null },
    };
  }
  let json = "";
  for (let i = 0; i < header.chunkCount; i += 1) {
    const chunk = raw[chunkKey(baseKey, i)];
    if (typeof chunk !== "string") return { status: "unresolved" };
    json += chunk;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { status: "unresolved" };
  }
  if (!guard(parsed)) return { status: "unresolved" };
  return { status: "ok", doc: { header, payload: parsed } };
};

export const readRemoteMetaVersion = (
  raw: Record<string, unknown>,
): number | null => readMetaVersion(raw[SYNC_META_KEY]);

// `unresolved` lists group ids (and SYNC_HISTORY_KEY) whose document exists
// remotely but could not be read yet; the merge leaves those alone.
export type DecodedRemote = {
  snapshot: SyncSnapshot;
  unresolved: Set<string>;
};

export const decodeSnapshot = (raw: Record<string, unknown>): DecodedRemote => {
  const meta = raw[SYNC_META_KEY];
  const unresolved = new Set<string>();
  const snapshot: SyncSnapshot = {
    meta: isSyncMetaRecord(meta) ? meta : null,
    history: null,
    groups: {},
  };
  const history = decodeDoc(raw, SYNC_HISTORY_KEY, isHistoryPayload);
  if (history.status === "ok") snapshot.history = history.doc;
  if (history.status === "unresolved") unresolved.add(SYNC_HISTORY_KEY);

  for (const key of Object.keys(raw)) {
    const parsed = parseSyncKey(key);
    if (!parsed || parsed.kind !== "group" || parsed.chunkIndex !== null) {
      continue;
    }
    const result = decodeDoc(raw, key, isGroupPayload);
    if (result.status === "absent") continue;
    // A payload whose id disagrees with its key is corrupt: treat as unreadable.
    if (
      result.status === "unresolved" ||
      (result.doc.payload && result.doc.payload.id !== parsed.groupId)
    ) {
      unresolved.add(parsed.groupId);
      continue;
    }
    snapshot.groups[parsed.groupId] = result.doc;
  }
  return { snapshot, unresolved };
};

// Re-encodes a snapshot into the items it would occupy in sync storage. Used
// for the pre-flight quota check before a push.
export const encodeSnapshot = (
  snapshot: SyncSnapshot,
): Record<string, unknown> => {
  const items: Record<string, unknown> = {};
  if (snapshot.meta) items[SYNC_META_KEY] = snapshot.meta;
  const addDoc = (
    baseKey: string,
    doc: SyncDoc<Group> | SyncDoc<CompletedHistoryItem[]>,
  ) => {
    const encoded =
      doc.payload === null
        ? encodeTombstone(baseKey, doc.header.updatedAt)
        : encodeDoc(baseKey, JSON.stringify(doc.payload), doc.header.updatedAt);
    Object.assign(items, encoded.items);
  };
  if (snapshot.history) addDoc(SYNC_HISTORY_KEY, snapshot.history);
  for (const [id, doc] of Object.entries(snapshot.groups)) {
    addDoc(groupKey(id), doc);
  }
  return items;
};
