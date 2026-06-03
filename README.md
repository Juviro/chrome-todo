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

For local UI work without reloading the extension, use `npm run dev` (Vite dev server). New-tab override only works from the built `dist/` package.

## Features

- Add todos with Enter; complete with checkbox (moves to recent history)
- Multiple groups with editable titles and notes
- Download / restore JSON backups
- Reminder banner if no backup in 7 days

## Project structure

- `manifest.json` — MV3 new tab override + `storage` permission
- `src/` — React app
- `dist/` — build output (load this folder in Chrome)
