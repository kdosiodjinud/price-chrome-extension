# Chrome Web Store listing

Copy for the store entry, and the permission justifications the review asks
for. Keep this in step with `public/manifest.json` and `PRIVACY.md`.

## Listing

**Name:** Price in Metal

**Short description (132 char max):**
> Rewrites prices on any page into the equivalent weight of gold, silver, platinum or palladium.

**Category:** Shopping
**Language:** English (with Czech translation)

**Detailed description:**

> Ever wondered what a price actually costs in something that holds its value?
> Price in Metal rewrites the prices you see while browsing into an equivalent
> weight of a precious metal — 1 500 Kč becomes 33,0 g Ag.
>
> Hover any converted price to see the original. Nothing is hidden: turning the
> extension off restores every page exactly as it was.
>
> FEATURES
> • Gold, silver, platinum and palladium
> • Grams, kilograms, troy ounces and ounces — or automatic
> • Detects CZK, EUR, USD, GBP and PLN, in the many ways prices are written
> • Czech and English interface, independent of your browser language
> • Exclude individual sites, or switch everything off in one click
>
> RATES
> Spot prices and exchange rates come from Yahoo Finance and are cached for six
> hours, so browsing generates no network traffic. The settings screen links to
> the exact quote each price is based on and shows when it was last updated.
>
> Quotes are indicative market data, delayed and provided without warranty.
> They are not investment advice and not a dealer price.
>
> PRIVACY
> No analytics, no telemetry, no accounts, no data collection. Page content is
> read locally to find prices and never leaves your browser.

## Listing assets

Uploaded in the Developer Dashboard, not shipped in the package. Regenerate
with `npm run icons`.

| Asset | File | Notes |
|---|---|---|
| Store icon | `design/store-icon-128.png` | 128×128 PNG. The artwork is 96×96 centred with 16 px transparent padding on every side, which is what the Store asks for — the toolbar icons in `public/icons/` fill their canvas instead and must not be used here. The alpha channel is kept deliberately: an icon without one is dropped into the Store's own rounded frame. |
| Screenshots | — | 1280×800 or 640×400, at least one. |

## Permission justifications

**`storage`**
> Stores the user's settings (chosen metal, unit, language, excluded sites) and
> the cached exchange rates. No data leaves the device except through Chrome's
> own settings sync.

**`alarms`**
> Refreshes the cached exchange rates on a six-hour schedule so that browsing
> does not trigger network requests.

**`activeTab`**
> The toolbar popup shows the hostname of the current tab so the user can
> exclude that site with one click. Used only while the popup is open.

**Host permission `https://query1.finance.yahoo.com/*`**
> The only external host the extension contacts. It reads public spot prices
> for metals and currency exchange rates. Requests carry no cookies and no user
> data, and are made at most once every six hours.

**Content script on `http://*/*` and `https://*/*`, in all frames**
> The extension's single purpose is converting prices into a weight of metal,
> and prices appear on arbitrary shopping, news and comparison sites, so the
> user cannot know in advance which hosts to grant. Frames are included
> because listing and product widgets are routinely rendered inside them, and
> `match_about_blank` because many such frames are written by script and have
> no URL of their own; without these, the prices most users care about are
> never converted. The content script only reads text nodes to find prices and
> replaces them in place. It sends nothing anywhere, makes no network requests
> of its own, and never touches form fields, editable regions or script and
> code elements. Users can exclude individual sites or disable the extension
> entirely from the toolbar popup.

**Remote code**
> None. All code is bundled in the package, and the extension's content
> security policy blocks anything else.

## Pre-submission checklist

- [ ] `npm run lint` passes
- [ ] `npm run zip` produces the upload archive
- [ ] Version in `package.json` bumped (the build propagates it to the manifest)
- [ ] Screenshots retaken if the UI changed (1280×800 or 640×400)
- [ ] Store icon regenerated if the artwork changed (`npm run icons`)
- [ ] `PRIVACY.md` published at a public URL and linked in the listing
- [ ] Single purpose statement matches the description above
