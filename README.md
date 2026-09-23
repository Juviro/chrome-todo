# Todo — Chrome new tab extension

A minimal dark-mode todo list that replaces Chrome’s new tab page. Groups, notes, completed history, and JSON backup/restore.

## Development

```bash
npm install
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

After code changes, run `npm run build` again and reload the extension.

Releases are automatic: every push to `main` is built and uploaded to the Chrome Web Store by GitHub Actions. See [PUBLISHING.md](PUBLISHING.md) for the one-time setup and how versions are derived.

For UI work without rebuilding, `npm run dev` (Vite dev server) runs the full app in a normal browser tab, including adding, editing and completing todos — outside the extension it persists to `localStorage` instead of `chrome.storage`, so dev data stays separate from your real todos. The new-tab override itself only works from the built `dist/` package.

## Features

- Syncs across your Chrome browsers via `chrome.storage.sync` — no account or login beyond the Chrome profile you are already signed into. Requires Chrome sync with «Extensions» enabled; a small status dot in the toolbar shows the state. Note that todo and note contents leave your device through Google's sync service. The quota is 100 KB in total; above that the extension keeps working locally and shows «Sync paused».
- Add todos with Enter; complete with checkbox (moves to recent history)
- Multiple groups with editable titles and notes
- Download / restore JSON backups

## Project structure

- `manifest.json` — MV3 new tab override + `storage` permission. The `key` field pins the extension id (needed so every install shares one sync storage); the private `.pem` is not in the repo.
- `src/` — React app
- `dist/` — build output (load this folder in Chrome)
