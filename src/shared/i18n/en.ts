/**
 * English strings. This file is the source of truth for the message catalogue:
 * every other language is typed against its keys, so a missing translation is
 * a compile error rather than a blank label at runtime.
 */
export const en = {
  'lang.name': 'English',

  'commodity.gold': 'Gold',
  'commodity.silver': 'Silver',
  'commodity.platinum': 'Platinum',
  'commodity.palladium': 'Palladium',
  // Used when a converted amount is labelled with a name instead of a ticker.
  'commodity.gold.amountLabel': 'of gold',
  'commodity.silver.amountLabel': 'of silver',
  'commodity.platinum.amountLabel': 'of platinum',
  'commodity.palladium.amountLabel': 'of palladium',

  'unit.auto': 'Automatic (grams / kilograms)',
  'unit.gram': 'Grams (g)',
  'unit.kilogram': 'Kilograms (kg)',
  'unit.troy_ounce': 'Troy ounces (oz t)',
  'unit.ounce': 'Ounces (oz)',

  'decimals.auto': 'Automatic',

  'label.ticker': 'Ticker (30.2 g Ag)',
  'label.name': 'Name (30.2 g of silver)',
  'label.none': 'None — weight only (30.2 g)',

  'options.title': 'Price in Metal — settings',
  'options.heading': 'Settings',

  'options.section.general': 'General',
  'options.section.display': 'Display',
  'options.section.currencies': 'Detected currencies',
  'options.section.sites': 'Sites',
  'options.section.data': 'Rate data',

  'options.enabled': 'Convert prices on pages',
  'options.enabled.hint': 'Turn the extension off everywhere without uninstalling it.',
  'options.language': 'Language',
  'options.language.auto': 'Follow the browser',
  'options.commodity': 'Convert prices to',
  'options.unit': 'Weight unit',
  'options.decimals': 'Decimal places',
  'options.labelStyle': 'Metal label',
  'options.tooltip': 'Show the original price on hover',
  'options.tooltip.hint':
    'The replaced price stays readable as a tooltip, so you can always see the real amount.',
  'options.highlight': 'Underline converted prices',

  'options.currencies.hint':
    'Only the currencies you pick here are detected. Fewer currencies means fewer false matches.',

  'options.blocklist': 'Never convert on these sites',
  'options.blocklist.hint':
    'One hostname per line. Use *.example.com to cover subdomains as well.',
  'options.blocklist.placeholder': 'example.com\n*.shop.example.org',
  'options.blocklist.invalid': 'These lines are not valid hostnames and were ignored: {items}',

  'options.source': 'Data source',
  'options.source.hint':
    'Spot prices and exchange rates come from Yahoo Finance. Rates are cached for {hours} hours, so browsing sends no extra requests.',
  // Phrased to avoid grammatical agreement with the commodity name, which
  // would need declension in Czech.
  'options.source.linkLabel': 'Yahoo Finance — {commodity} quote',
  'options.source.disclaimer':
    'Quotes are indicative market data, delayed and provided without warranty. They are not investment advice and not a dealer price.',
  'options.lastUpdate': 'Last updated',
  'options.nextUpdate': 'Cache valid until',
  'options.never': 'Never',
  'options.refresh': 'Refresh now',
  'options.clearCache': 'Clear cache',
  'options.clearCache.hint':
    'Removes the stored rates. The next page you open fetches them again.',
  'options.cacheCleared': 'Cache cleared.',
  'options.refreshed': 'Rates updated.',
  'options.refreshFailed': 'Could not fetch rates: {error}',
  'options.saved': 'Saved.',

  'popup.title': 'Price in Metal',
  'popup.globalToggle': 'Extension enabled',
  'popup.activeOnSite': 'Convert on {host}',
  'popup.enabledHere': 'Active on this site',
  'popup.blockedHere': 'Turned off for {host}',
  'popup.globallyOff': 'The extension is turned off',
  'popup.currentRate': '1 {unit} {commodity} = {price}',
  'popup.noRate': 'No rates loaded yet',
  'popup.openOptions': 'Settings',
  'popup.unavailable': 'Not available on this page',
} as const;

export type MessageKey = keyof typeof en;
export type Catalogue = Record<MessageKey, string>;
