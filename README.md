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

For UI work without rebuilding, `npm run dev` (Vite dev server) runs the full app in a normal browser tab, including adding, editing and completing todos — outside the extension it persists to `localStorage` instead of `chrome.storage`, so dev data stays separate from your real todos. The new-tab override itself only works from the built `dist/` package.

## Features

- Add todos with Enter; complete with checkbox (moves to recent history)
- Multiple groups with editable titles and notes
- Download / restore JSON backups

## Project structure

- `manifest.json` — MV3 new tab override + `storage` permission
- `src/` — React app
- `dist/` — build output (load this folder in Chrome)
