import type { Catalogue } from './en';

/** Czech strings. Typed against the English catalogue so none can be missed. */
export const cs: Catalogue = {
  'lang.name': 'Čeština',

  'commodity.gold': 'Zlato',
  'commodity.silver': 'Stříbro',
  'commodity.platinum': 'Platina',
  'commodity.palladium': 'Palladium',
  'commodity.gold.amountLabel': 'zlata',
  'commodity.silver.amountLabel': 'stříbra',
  'commodity.platinum.amountLabel': 'platiny',
  'commodity.palladium.amountLabel': 'palladia',

  'unit.auto': 'Automaticky (gramy / kilogramy)',
  'unit.gram': 'Gramy (g)',
  'unit.kilogram': 'Kilogramy (kg)',
  'unit.troy_ounce': 'Trojské unce (oz t)',
  'unit.ounce': 'Unce (oz)',

  'decimals.auto': 'Automaticky',

  'label.ticker': 'Značka (30,2 g Ag)',
  'label.name': 'Název (30,2 g stříbra)',
  'label.none': 'Bez označení — jen hmotnost (30,2 g)',

  'options.title': 'Cena v kovu — nastavení',
  'options.heading': 'Nastavení',

  'options.section.general': 'Obecné',
  'options.section.display': 'Zobrazení',
  'options.section.currencies': 'Rozpoznávané měny',
  'options.section.sites': 'Weby',
  'options.section.data': 'Zdroj kurzů',

  'options.enabled': 'Převádět ceny na stránkách',
  'options.enabled.hint': 'Vypne rozšíření všude, aniž byste ho museli odinstalovat.',
  'options.language': 'Jazyk',
  'options.language.auto': 'Podle prohlížeče',
  'options.commodity': 'Převádět ceny na',
  'options.unit': 'Jednotka hmotnosti',
  'options.decimals': 'Počet desetinných míst',
  'options.labelStyle': 'Označení kovu',
  'options.tooltip': 'Zobrazit původní cenu po najetí myší',
  'options.tooltip.hint':
    'Nahrazená cena zůstane dostupná jako tooltip, takže vždy uvidíte skutečnou částku.',
  'options.highlight': 'Podtrhnout převedené ceny',

  'options.currencies.hint':
    'Rozpoznávají se jen zde vybrané měny. Méně měn znamená méně chybných detekcí.',

  'options.blocklist': 'Nikdy nepřevádět na těchto webech',
  'options.blocklist.hint':
    'Jeden název domény na řádek. Zápis *.example.com pokryje i subdomény.',
  'options.blocklist.placeholder': 'example.com\n*.shop.example.org',
  'options.blocklist.invalid': 'Tyto řádky nejsou platné domény a byly ignorovány: {items}',

  'options.source': 'Zdroj dat',
  'options.source.hint':
    'Spotové ceny a měnové kurzy pocházejí z Yahoo Finance. Kurzy se ukládají do mezipaměti na {hours} hodin, takže procházení webu negeneruje žádné requesty navíc.',
  'options.source.linkLabel': 'Yahoo Finance — kurz: {commodity}',
  'options.source.disclaimer':
    'Kurzy jsou orientační tržní data, zpožděná a poskytovaná bez záruky. Nejde o investiční doporučení ani o cenu obchodníka.',
  'options.lastUpdate': 'Poslední aktualizace',
  'options.nextUpdate': 'Mezipaměť platí do',
  'options.never': 'Nikdy',
  'options.refresh': 'Aktualizovat nyní',
  'options.clearCache': 'Vymazat mezipaměť',
  'options.clearCache.hint':
    'Smaže uložené kurzy. Při další otevřené stránce se načtou znovu.',
  'options.cacheCleared': 'Mezipaměť vymazána.',
  'options.refreshed': 'Kurzy aktualizovány.',
  'options.refreshFailed': 'Kurzy se nepodařilo načíst: {error}',
  'options.saved': 'Uloženo.',

  'popup.title': 'Cena v kovu',
  'popup.globalToggle': 'Rozšíření zapnuté',
  'popup.activeOnSite': 'Převádět na {host}',
  'popup.enabledHere': 'Aktivní na tomto webu',
  'popup.blockedHere': 'Vypnuto pro {host}',
  'popup.globallyOff': 'Rozšíření je vypnuté',
  'popup.currentRate': '1 {unit} {commodity} = {price}',
  'popup.noRate': 'Kurzy zatím nenačteny',
  'popup.openOptions': 'Nastavení',
  'popup.unavailable': 'Na této stránce není dostupné',
};
