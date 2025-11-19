# Nordnet Portfolio Refresher

Nordnet Portfolio Refresher is a lightweight Firefox WebExtension that keeps the Nordnet portfolio overview up to date by automatically triggering the built-in "Opdater tabel" action. The popup exposed from the toolbar button lets you pause the refresher or change how frequently it runs.

## Features

- Automatically clicks the Nordnet "Opdater tabel" button at a configurable interval.
- Quickly enable or disable refreshing from the popup.
- Works offline by persisting settings with the browser storage API; falls back to defaults if storage is unavailable.

## Requirements

- Firefox 90 or newer (tested on desktop Firefox).
- `zip` installed if you plan to bundle the extension via the packaging script.

## Install for Local Testing

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**.
3. Select the repository `manifest.json` file.
4. Pin the toolbar button if you want quick access to the popup.

Firefox will keep the add-on active until you close the browser. Reload it from the same page after making code changes.

## Usage

1. Navigate to `https://www.nordnet.dk/oversigt/konto/`.
2. Click the extension icon to open the popup.
3. Use the **Enable automatic refresh** toggle to start or pause the refresher.
4. Adjust **Refresh interval (seconds)** to control how often the button click runs. Values below 1 second are automatically rounded up.
5. If the popup reports "Using default settings; saves are unavailable in this session", Firefox blocked access to persistent storage. The refresher still runs with default values, but custom settings will not persist until storage becomes available (e.g., sign into Firefox Sync or grant storage).

## Build a Distributable ZIP

Run the helper script to bundle the extension files:

```bash
chmod +x package.sh   # first run only
./package.sh
```

The archive is created at `dist/nn-portfoliorefresher.zip`, suitable for submission to Firefox Add-ons or manual installation.

## Development Notes

- Main logic lives in `content.js`, which listens for popup messages and schedules refresh clicks.
- `popup.js` manages the UI, syncs settings with storage, and updates all open Nordnet tabs when preferences change.
- Settings are stored under the key `nnPortfolioRefresherSettings`. Legacy keys are still read for backward compatibility.
- Logs prefixed with `NN Portfolio Refresher` in the browser console help debug storage or messaging issues.
