# Privacy Policy — Price in Metal

_Last updated: 2026-09-21_

## Summary

The extension collects nothing, transmits nothing about you, and has no
backend. It makes one kind of outbound request: fetching public market rates
from Yahoo Finance, at most once every six hours, without cookies.

## What the extension does on a page

It reads the text of pages you visit to find prices and replaces them with an
equivalent weight of metal. This happens entirely in your browser. Page content
is never sent anywhere, never stored, and never logged.

## What is stored

Locally, in the browser's extension storage:

- **Your settings** (metal, unit, language, detected currencies, the list of
  sites you excluded). Stored in `chrome.storage.sync`, so Chrome syncs them
  between your own signed-in devices, the same way it syncs bookmarks.
- **The cached rates** and when they were fetched. Stored in
  `chrome.storage.local` and never leaves the device.

Both can be cleared at any time: the rates from the options screen ("Clear
cache"), everything by removing the extension.

## Network requests

The only host contacted is `query1.finance.yahoo.com`, to read public quotes
for metals and currencies. Requests:

- carry no cookies (`credentials: 'omit'`) and no identifier of any kind,
- contain no information about you or the pages you visit,
- happen at most once every six hours, plus whenever you press "Refresh now".

Yahoo, like any web server, will see the IP address the request comes from.
The extension sends nothing beyond the symbol being looked up.

## What is not collected

No analytics. No telemetry. No crash reporting. No advertising identifiers. No
browsing history. No personal data. Nothing is sold or shared, because nothing
is collected.

## Permissions and why they are needed

| Permission | Why |
|---|---|
| `storage` | Save your settings and the rate cache |
| `alarms` | Refresh the cached rates on a six-hour schedule |
| `activeTab` | Let the toolbar popup show which site you are on, so you can exclude it |
| `host_permissions: query1.finance.yahoo.com` | Fetch the rates |
| Content script on `http`/`https` pages | Find and convert prices; prices can appear on any site |

## Contact

Report issues through the repository's issue tracker.
