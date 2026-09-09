# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build   # tsc -b (project refs) + vite build → dist/ ; prebuild regenerates icons
npm run lint    # eslint (flat config, ts + react-hooks + react-refresh)
npm run icons   # regenerate public/icons/*.png
npm run dev     # Vite dev server (works standalone, see Storage backend)
```

There is no test runner and no tests. Verification is `npm run lint` + `npm run build`, plus loading `dist/` in Chrome (`chrome://extensions` → Developer mode → Load unpacked → `dist/`, then reload after each build).

`npm run dev` serves the fully working app in a normal tab (see *Storage backend* below), so behaviour changes can be verified there. Only manifest-level behaviour — the new-tab override, permissions — needs the built extension.

## Architecture

MV3 extension with a single surface: `chrome_url_overrides.newtab` → `index.html`. No background service worker, no content scripts, no messaging. Everything runs in the new-tab page, and the only permission is `storage`.

### State

`AppState` (`src/types.ts`) is the one source of truth: `{ version, groups[], completedHistory[], lastBackupAt }`. It lives in `useAppState` (`src/hooks/useAppState.ts`) and is persisted to `chrome.storage.local` under `APP_STATE_V1`, debounced by `SAVE_DEBOUNCE_MS`.

- `updateState(prev => next)` — normal edits, debounced save.
- `replaceState(next)` — wholesale swap with an immediate save; used for backup restore.

`state === null` means "not loaded yet"; `App` renders the loading screen until then.

### Storage backend

Nothing outside `storage/storageArea.ts` may touch `chrome.storage` — it is the single place that knows which backend is in use. It exports a `{ get, set }` adapter resolved once at module load: `chrome.storage.local` when the extension API is present, `localStorage` otherwise (Vite dev server, `npm run preview`), with the same async contract so callers cannot tell them apart. The fallback logs a warning, because inside the packaged extension it would mean the `storage` permission is missing.

Both persisted keys go through it: `APP_STATE_V1` (`storage/loadState.ts`, `storage/saveState.ts`) and `LOOT_STREAK_V1` (`effects/lootStreakStorage.ts`). New persisted state should follow the same shape — key in `constants.ts`, type guard next to the loader, adapter for the I/O.

### State transformers

Non-trivial mutations are pure `(prev: AppState, …args) => AppState` functions in their own module, imported into `App.tsx` and passed to `updateState`: `history/completeTodo.ts`, `history/deleteGroup.ts`, `groups/reorderGroups.ts`, `backup/markBackedUp.ts`. Trivial field edits (title, notes, add todo) are inline in `App.tsx`. Keep that split — anything with branching or cross-slice effects belongs in a module.

`App.tsx` is the only stateful container; components under `src/components/` are presentational and receive per-group closures as props.

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

## Conventions

- Arrow-function components with a `type Props = {…}` alias above them; named exports for components, default export only for `App`.
- `import type` for type-only imports (`verbatimModuleSyntax` is on).
- `crypto.randomUUID()` via `createId()` in `storage/defaults.ts` for all ids.
- `noUnusedLocals`/`noUnusedParameters` are on — dead locals fail the build, not just the lint.
- Commit messages follow Conventional Commits (`feat:`, `chore:`).
