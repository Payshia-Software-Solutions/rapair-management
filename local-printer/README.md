# BizzFlow Printer

Silent-print bridge between the BizzFlow web app and the Windows printers on a POS / kitchen PC.
The web app sends receipt HTML to `http://127.0.0.1:5001/print`; the bridge renders it with the
installed Chrome/Edge and sends it straight to the thermal printer, with no print dialog.

## Install on a POS PC

Run **`dist/BizzFlowPrinter-Setup-<version>.exe`** (about 22 MB) and click through the wizard. No admin rights are needed.
It installs to `%LOCALAPPDATA%\Programs\BizzFlowPrinter`, adds a Start menu entry (and an optional desktop
shortcut), offers **Start automatically with Windows** (checked by default), and launches the app.
To uninstall, use *Settings → Apps → BizzFlow Printer*. Printer settings are kept for a reinstall.

Silent / remote install: `BizzFlowPrinter-Setup-2.0.0.exe /VERYSILENT` (starts quietly in the tray).
To skip the startup entry, add `/TASKS=""`.

Requirements: Windows 10/11 64-bit with Edge or Chrome (Edge comes with Windows).
If you don't use the installer, copy `bizzflow-printer.exe` and `setup.bat` into one folder and double-click `setup.bat`.

The app runs with **no console window**: it lives in the system tray (bottom-right, near the clock).
Tray menu: *Open Dashboard*, *Print Test Page*, *Start with Windows*, *Restart Service*, *Exit*.
Opening the app again while it's already running just brings up the dashboard.

## Dashboard

Opens as its own app window (`http://127.0.0.1:5001`, this PC only):

- choose the default printer and paper width (80 mm / 58 mm), print a test page
- turn *Start with Windows* on/off
- recent print jobs with success/failure reasons, live activity log, open the log folder, restart

Settings and logs: `%APPDATA%\BizzFlowPrinter` (`config.json`, `logs\service.log`).

## API (used by `front-end/src/lib/api/silent-print.ts`)

| Method | Path | Body / result |
| --- | --- | --- |
| GET | `/printers` | `{ success, data: [{ name, isDefault, offline, port, driver }] }` |
| POST | `/print` | `{ html, printer?, width?: "80mm"\|"58mm", title? }` → `{ success, jobId, error? }` |
| GET | `/health` | `{ success, app, version }` |

Jobs are queued and printed one at a time; a warm browser instance is reused for speed and closed after
5 idle minutes. `/api/*` (dashboard) only accepts requests from this PC.

## Development

```bash
npm install
npm start            # run from source (shows logs in the terminal)
npm run build        # -> bizzflow-printer.exe (Node 18, no console window)
npm run installer    # -> dist/BizzFlowPrinter-Setup-<version>.exe (needs: winget install JRSoftware.InnoSetup)
npm run release      # build + installer
npm run icon         # regenerate assets/icon.ico
```

`npm run build` uses `pkg`, then `scripts/hide-console.js` flips the exe to the Windows GUI subsystem
so it starts without a command-prompt window. Stop the running app before rebuilding (the exe is locked
while it runs).

Flags: `--startup` (launched at sign-in: stay in the tray, don't open the dashboard),
`--restarted` (used by *Restart Service*).
