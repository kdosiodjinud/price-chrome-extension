# Privacy Policy — Price in Metal

**Effective date:** 24 September 2026
**Applies to:** the "Price in Metal" browser extension for Google Chrome (the
"Extension"), published in the Chrome Web Store and developed by KdoSiOdJinud
(the "Developer").

This document is the privacy policy for the Extension. It describes what the
Extension does with data, what it stores, what it transmits, and what it does
not do.

## 1. Summary

- The Extension **does not collect, transmit, sell or share any personal
  data**. It has no backend, no accounts, no analytics and no telemetry.
- All processing of web page content happens **locally in your browser**.
- The Extension makes exactly **one kind of network request**: it downloads
  public market quotes (precious-metal spot prices and currency exchange
  rates) from Yahoo Finance, at most once every six hours, without cookies and
  without any information about you.

## 2. What the Extension does

The Extension's single purpose is to find prices in the text of web pages you
visit and to display them as an equivalent weight of a precious metal (for
example `1 500 Kč` → `33,0 g Ag`). The original price stays available as a
tooltip and the page is restored when the Extension is disabled.

To do this, the Extension reads the visible text of the page inside your
browser. This text is used only to locate and replace prices in that same
page. It is **never stored, never logged and never sent anywhere**.

## 3. Data the Extension collects

**None.** With reference to the data categories defined by the Chrome Web
Store, the Extension does not collect or transmit any of the following:

| Category | Collected? |
|---|---|
| Personally identifiable information (name, address, e‑mail, ID number) | No |
| Health information | No |
| Financial and payment information (transactions, card numbers, credit ratings) | No |
| Authentication information (passwords, credentials, PINs) | No |
| Personal communications (e‑mails, messages, chats) | No |
| Location (region, IP address, GPS coordinates) | No |
| Web history (list of pages visited, page titles, time of visit) | No |
| User activity (clicks, mouse position, scroll, keystrokes, network monitoring) | No |
| Website content (text, images, sounds, videos, hyperlinks) | No — page text is read locally to find prices and is never collected or transmitted |

## 4. Data stored on your device

The Extension stores the following data in the browser's extension storage
only. This data is not accessible to the Developer or to any third party.

| Data | Where | Purpose |
|---|---|---|
| Your settings: chosen metal, unit, number of decimals, label style, interface language, detected currencies, display options and the list of websites you have excluded | `chrome.storage.sync` | Remember your preferences. Google Chrome may synchronise this area between devices signed in to the same Google account, in the same way it synchronises bookmarks; this is governed by your Chrome sync settings and by Google's privacy policy, not by the Extension. |
| Cached market quotes and the time they were fetched | `chrome.storage.local` | Avoid repeated network requests while browsing. Never leaves the device. |
| The last error message from a failed quote download, if any | `chrome.storage.local` | Show a diagnostic message in the settings screen. Never leaves the device. |

You can delete this data at any time:

- the cached quotes, with the **Clear cache** button in the Extension's
  settings screen;
- everything, by removing the Extension from Chrome. Settings that Chrome has
  synchronised to your Google account are removed according to Chrome's sync
  behaviour and can also be cleared from your Google account settings.

## 5. Network requests

The only remote host the Extension ever contacts is
`https://query1.finance.yahoo.com`, operated by Yahoo. The requests download
public quotes for precious metals (gold, silver, platinum, palladium) and
currency exchange rates.

These requests:

- are made only by the Extension's background service worker, at most once
  every six hours, or when you press **Refresh now** in the settings screen;
- are sent without cookies and without any credentials
  (`credentials: 'omit'`);
- contain no identifier of you, your browser profile or your device, and no
  information about the pages you visit. The request contains only the
  public ticker symbols to look up (for example `SI=F`, `EURUSD=X`).

As with any request on the Internet, Yahoo's servers receive the IP address
the request originates from and standard HTTP headers sent by your browser.
The Developer does not receive, see or control this information. Yahoo's
handling of such data is described in Yahoo's own privacy policy at
<https://legal.yahoo.com/>.

Browsing web pages does **not** trigger any network request by the Extension.

## 6. Data sharing and sale

The Extension does not share, sell, rent or transfer any user data to anyone,
for any purpose, because it does not collect any. There are no third-party
analytics, advertising or tracking components.

## 7. Compliance with the Chrome Web Store User Data Policy

The Developer certifies that the Extension's use of data complies with the
Chrome Web Store User Data Policy, including its Limited Use requirements. In
particular, the Extension:

- does not collect or transmit user data;
- does not use or transfer user data for purposes unrelated to its single,
  user-facing purpose of converting displayed prices into a weight of metal;
- does not use or transfer user data to serve advertisements;
- does not allow humans to read user data;
- does not use or transfer user data to determine creditworthiness or for
  lending purposes.

## 8. Permissions

| Permission | Why it is needed |
|---|---|
| `storage` | Save your settings and the quote cache (section 4). |
| `alarms` | Refresh the quote cache on a six-hour schedule so browsing never triggers network requests. |
| `activeTab` | Let the toolbar popup show the hostname of the current tab so you can exclude that site with one click. Used only while the popup is open; no page content is read through it. |
| Host permission `https://query1.finance.yahoo.com/*` | Download market quotes (section 5). |
| Content script on `http://*/*` and `https://*/*`, including frames | Find and convert prices; prices can appear on any website, including inside embedded frames. The content script only reads text, replaces prices in place and never makes network requests of its own. |

## 9. Security

The Extension contains no remote code; everything it runs is included in the
package reviewed by the Chrome Web Store. Its content security policy
prohibits loading scripts from anywhere else. Data read from storage and from
the network is validated before use, and if a quote is missing or invalid the
original price is left untouched.

## 10. Children

The Extension is not directed at children and collects no data from anyone,
including children under the age of 13 (or the equivalent age of digital
consent in your jurisdiction).

## 11. Your rights

Because the Developer holds no data about you, there is nothing for the
Developer to access, correct, export or erase. All data described in section
4 is under your direct control in your own browser and can be deleted as
described there. If you are in the European Economic Area, the United Kingdom
or another jurisdiction with data-protection rights and believe this is not
the case, you can contact the Developer using the details in section 13.

## 12. Changes to this policy

If the Extension's data practices change, this policy will be updated and the
effective date at the top revised. Material changes will also be noted in the
Extension's release notes. Continued use of the Extension after a change means
you accept the updated policy.

## 13. Contact

Questions, concerns or requests regarding this policy can be raised through
the Extension's public issue tracker:

<https://github.com/kdosiodjinud/price-chrome-extension/issues>
