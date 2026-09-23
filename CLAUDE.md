# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build   # tsc -b (project refs) + vite build → dist/ ; prebuild regenerates icons
npm run lint    # eslint (flat config, ts + react-hooks + react-refresh)
npm run icons   # regenerate public/icons/*.png
npm run dev     # Vite dev server (works standalone, see Storage backend)
npm run package # dist/ → release/todo-extension-<version>.zip for the Web Store (strips `key`)
```

Node 24 (`.nvmrc`). The toolchain does not run on Node 16.

There is no test runner and no tests. Verification is `npm run lint` + `npm run build`, plus loading `dist/` in Chrome (`chrome://extensions` → Developer mode → Load unpacked → `dist/`, then reload after each build).

`npm run dev` serves the fully working app in a normal tab (see *Storage backend* below), so behaviour changes can be verified there. Only manifest-level behaviour — the new-tab override, permissions — needs the built extension.

## Architecture

MV3 extension with a single surface: `chrome_url_overrides.newtab` → `index.html`. No background service worker, no content scripts, no messaging. Everything runs in the new-tab page, and the only permission is `storage` (which covers both `chrome.storage.local` and `chrome.storage.sync`).

### State

`AppState` (`src/types.ts`) is the one source of truth: `{ version, groups[], completedHistory[], lastBackupAt }`. It lives in `useAppState` (`src/hooks/useAppState.ts`) and is persisted to `chrome.storage.local` under `APP_STATE_V1`, debounced by `SAVE_DEBOUNCE_MS`.

- `updateState(prev => next)` — normal edits, debounced save.
- `replaceState(next)` — wholesale swap with an immediate save; used for backup restore.

`state === null` means "not loaded yet"; `App` renders the loading screen until then.

### Storage backend

Nothing outside `storage/storageArea.ts` may touch `chrome.storage` — it is the single place that knows which backend is in use. It exports a `{ get, set }` adapter resolved once at module load: `chrome.storage.local` when the extension API is present, `localStorage` otherwise (Vite dev server, `npm run preview`), with the same async contract so callers cannot tell them apart. The fallback logs a warning, because inside the packaged extension it would mean the `storage` permission is missing.

All three local keys go through it: `APP_STATE_V1` (`storage/loadState.ts`, `storage/saveState.ts`), `LOOT_STREAK_V1` (`effects/lootStreakStorage.ts`) and `SYNC_SHADOW_V1` (`sync/syncShadowStorage.ts`). New persisted state should follow the same shape — key in `constants.ts`, type guard next to the loader, adapter for the I/O.

The same module also exports `syncArea`, the only handle on `chrome.storage.sync` (`getAll`/`setMany`/`remove`/`subscribe`, errors classified into `SyncStorageError.kind`). Its dev fallback namespaces keys under `sync:` in `localStorage`, enforces Chrome's quotas, and turns the cross-tab `storage` event into change notifications — so two `npm run dev` tabs behave like two devices.

### State transformers

Non-trivial mutations are pure `(prev: AppState, …args) => AppState` functions in their own module, imported into `App.tsx` and passed to `updateState`: `history/completeTodo.ts`, `history/deleteGroup.ts`, `groups/reorderGroups.ts`, `backup/markBackedUp.ts`. Trivial field edits (title, notes, add todo) are inline in `App.tsx`. Keep that split — anything with branching or cross-slice effects belongs in a module.

`App.tsx` is the only stateful container; components under `src/components/` are presentational and receive per-group closures as props.

### Sync

Todos are mirrored to `chrome.storage.sync` (Google syncs it across the signed-in Chrome profile; no server, no OAuth). Everything lives in `src/sync/`. The local `APP_STATE_V1` stays authoritative; sync is a replica reconciled through a locally persisted **shadow** (`SYNC_SHADOW_V1` — the snapshot we last agreed with sync storage). Timestamps exist only in the sync layer; `AppState` and both `isAppState` guards are untouched.

Key layout (`syncKeys.ts`): `SYNC_META_V1` (`groupOrder`, `lastBackupAt`), one document per group under `SYNC_GROUP_V1:<id>`, and one for history under `SYNC_HISTORY_V1`. A document is a header `{ updatedAt, chunkCount, deleted? }` plus `chunkCount` string slices of its canonical JSON under `<base>#<i>` (`chunking.ts`, `SYNC_CHUNK_BYTES` keeps each under the 8 KB per-item quota). Canonical serialisation (`syncRecords.ts`) is load-bearing: diffs and echo detection compare strings.

- `diffForSync(state, shadow, now)` — pure; what to `set`/`remove` so sync reflects `state`. Groups gone locally become tombstones; tombstones older than `SYNC_TOMBSTONE_TTL_MS` are removed.
- `mergeRemoteIntoLocal(local, remote, shadow, unresolved)` — pure; per-group last-write-wins against the shadow. **Deletion wins in both directions.** A group whose remote chunks have not all arrived yet (`unresolved`) is left alone. A pristine default state on a fresh install adopts the remote wholesale instead of pushing a duplicate «Inbox».
- `useSyncEngine` (composed inside `useAppState`) runs pushes (debounced `SYNC_PUSH_DEBOUNCE_MS`, at most two write operations each) and pulls (on `onChanged`, full re-read) through one promise queue. The shadow is advanced *before* a write so the echo of our own write is ignored. `applyRemote` saves locally before the shadow is persisted — never the other way round. Remote `meta.version > 1` stops all pushes. Status is surfaced in `Toolbar` via `syncStatus.ts`.
- `replaceState` (backup restore) calls `pushNow` so the whole state, including tombstones for groups missing from the backup, goes out immediately.
- Loot streak is deliberately **not** synced (device-local, per-day, would cost a write per completion).

`manifest.json` carries a fixed `key` so every unpacked/packaged build has the same extension id and therefore the same sync storage; the matching `.pem` is gitignored and must not be committed.

### Completed history

Completing a todo removes it from its group and prepends a `CompletedHistoryItem` (denormalised `groupTitle`) to `completedHistory`. Deleting a group does the same for its open todos. Every write goes through `pruneHistory` (age + count cap from `constants.ts`). Restoring creates a *new* todo id and drops the history entry.

### Persistence boundaries and schema changes

Two independent `isAppState` guards validate untrusted input: `storage/loadState.ts` (falls back to `createDefaultState()`) and `backup/importBackup.ts` (returns `null` → user-facing alert). They are deliberate duplicates, both pinned to `version === 1`. Changing the shape of `AppState` means updating `types.ts`, **both** guards, and adding migration handling in `loadState`.

Backup files are `{ exportedAt, appState }`; the importer also accepts a bare `AppState` for forward compatibility.

### Loot effects

A self-contained gamification layer, intentionally outside `AppState`. `LootEffectProvider` wraps `App` in `main.tsx` and exposes `spawnLoot({ x, y })` via context (`useSpawnLoot`). `TodoRow` calls it with the checkbox's viewport centre on completion; `LootEffectLayer` renders fixed-position `LootBurst`es that self-remove after the tier's `durationMs`.

Tier comes from a per-local-day combo counter (`useLootStreak`), persisted separately under `LOOT_STREAK_V1` and reset when the day key changes. All visual tuning (colour, sparkle count, beam size, duration) is data in `effects/lootTiers.ts` — change values there, not in the components. `spawnLoot` is a no-op under `prefers-reduced-motion`.

### Styling

Two global SCSS files imported once (`styles/app.scss` from `App.tsx`, `styles/loot.scss` from the provider) — no CSS modules, no theme tokens, hardcoded dark-mode hex values. Class names follow BEM-ish `block__element--modifier` matching the component name.

The layout is deliberately viewport-fitted: `.app__main` is a 3/2/1-column grid and group cards use a fixed `calc((100vh - 10.5rem) / 2)` height so exactly two rows fit without page scroll. Overflow is handled *inside* the card — `useScrollOverflow` sets `data-can-scroll-up/down` on the todo list, which CSS turns into fade masks. Changing card padding or toolbar height means re-checking that `10.5rem` offset.

### Build specifics

- `base: "./"` in `vite.config.ts` is required — extension pages need relative asset paths.
- `manifest.json` lives at the repo root and is copied into `dist/` by `vite-plugin-static-copy`.
- `scripts/generate-icons.mjs` hand-rolls flat-colour PNGs (own CRC32 + zlib deflate, no image deps) into `public/icons/`, wired to `prebuild`. Icons only exist because the manifest references them; regenerate rather than hand-editing.
- `dist/` is gitignored and untracked despite being present locally.
- `scripts/package-extension.mjs` builds the store zip from `dist/`: strips the manifest `key` (the store rejects it), optionally sets `<major>.<minor>.<build>` and, for the very first upload only, includes `key.pem`. `.github/workflows/publish.yml` runs lint → build → package on every push/PR and uploads to the Chrome Web Store on `main` via `chrome-webstore-upload-cli@3` with four `CWS_*` secrets. Setup and versioning rules live in `PUBLISHING.md`.

## Conventions

- Arrow-function components with a `type Props = {…}` alias above them; named exports for components, default export only for `App`.
- `import type` for type-only imports (`verbatimModuleSyntax` is on).
- `crypto.randomUUID()` via `createId()` in `storage/defaults.ts` for all ids.
- `noUnusedLocals`/`noUnusedParameters` are on — dead locals fail the build, not just the lint.
- Commit messages follow Conventional Commits (`feat:`, `chore:`).
