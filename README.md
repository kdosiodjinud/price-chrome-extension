# Price in Metal

Chrome extension that rewrites prices on any page into the equivalent weight of
a precious metal, so `1 500 Kč` reads as `33,0 g Ag`.

Hovering a converted price shows the original. Nothing is lost, and turning the
extension off restores the page exactly.

## Features

- **Generic price detection** — handles `1 500 Kč`, `1.500 Kč`, `1 499,90 Kč`,
  `$1,299.00`, `49,99 €`, `120 zł`, `£85.50` and the Czech `1 500,-` shorthand,
  while leaving version numbers, IP addresses, percentages and dates alone.
- **Prices split across elements** — `<span>1 000</span><span>Kč</span>` and
  `1 000<sup>,-</sup>` are converted just like plain text, which is how most
  real shops mark prices up.
- **Gold, silver, platinum, palladium**, priced from Yahoo Finance.
- **Grams, kilograms, troy ounces, ounces**, or automatic unit selection.
- **Czech and English**, independent of the browser language.
- **Six-hour rate cache** — browsing generates no network requests at all.
- **Label the metal** with its ticker (`33,1 g Ag`), its name
  (`33,1 g stříbra`) or not at all (`33,1 g`).
- **Per-site opt-out** and a global switch, both from the toolbar popup.

## Install for development

```bash
npm install
npm run build
```

Then load `dist/` in `chrome://extensions` with developer mode on
("Load unpacked").

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Build the extension into `dist/` |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Type-check and test |
| `npm run zip` | Package `release/price-extension-<version>.zip` |
| `npm run icons` | Regenerate PNG icons from `design/icon.svg` |

## Data source

Spot prices and exchange rates come from [Yahoo Finance](https://finance.yahoo.com/commodities/).
Every commodity links to its own quote page from the options screen. Quotes are
indicative market data, delayed and provided without warranty — they are not
investment advice and not a dealer price.

Rates are cached for six hours in the extension's own storage and shared by all
tabs. The options screen shows when they were last fetched and can refresh or
clear the cache on demand.

## Privacy

The extension sends no data anywhere. It reads page text locally to find prices
and talks to exactly one external host, Yahoo Finance, to fetch rates — without
cookies, and at most once every six hours. See [PRIVACY.md](PRIVACY.md).

## Contributing

Architecture, extension points and the invariants to preserve are documented in
[CLAUDE.md](CLAUDE.md). Adding a commodity, currency or unit is a single
registry entry.

## Licence

MIT
