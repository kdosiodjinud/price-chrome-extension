# CLAUDE.md

Pokyny pro práci na tomto repozitáři.

## Co to je

Chrome rozšíření (Manifest V3), které na libovolné stránce najde ceny a nahradí
je odpovídajícím množstvím drahého kovu — `1 500 Kč` → `33,0 g Ag`. Původní cena
zůstává dostupná jako tooltip a náhrada je plně vratná.

Kurzy pocházejí z Yahoo Finance a **cachují se 6 hodin**. Procházení webu
negeneruje žádné síťové requesty.

## Příkazy

```bash
npm install
npm run build        # dist/ – načítatelné rozšíření
npm test             # Vitest, 210 testů
npm run typecheck    # tsc --noEmit
npm run lint         # typecheck + testy
npm run zip          # release/price-extension-<verze>.zip pro Web Store
npm run icons        # přegeneruje PNG z design/icon.svg (vyžaduje rsvg-convert)
```

Verze se udržuje v `package.json`; `prebuild` ji propíše do manifestu
(`scripts/sync-version.mjs`). Nikdy needituj verzi v `public/manifest.json` ručně.

## Architektura

Tok dat je jednosměrný a má jediné místo, které sahá na síť:

```
Yahoo Finance
     │  (jen service worker, max 1× za 6 h)
     ▼
service worker ── rate-cache (storage.local) ──► content script ──► DOM
     ▲                                                 │
     └──────────── chrome.runtime zprávy ──────────────┘
```

| Vrstva | Cesta | Odpovědnost |
|---|---|---|
| Doména | `src/core/` | Typy, registry, parsování čísel, detekce cen, převod, formátování. Žádné Chrome API, žádný DOM. |
| Sdílené | `src/shared/` | Nastavení + validace, kontrakt zpráv, i18n, konstanty. |
| Pozadí | `src/background/` | Fetch kurzů, cache, alarmy. Jediné místo se síťovým přístupem. |
| Obsah | `src/content/` | Segmentace DOM, náhrada, MutationObserver. |
| UI | `src/options/`, `src/popup/` | Nastavení a rychlý přepínač. |

`src/core/` je čistá logika bez závislostí na prohlížeči — proto je celá
pokrytá unit testy a dá se rozšiřovat bez obav o zbytek.

### Proč dva buildy

`vite.config.ts` staví service worker a stránky jako ES moduly.
`vite.content.config.ts` staví content script zvlášť jako jediný IIFE — MV3
content scripty nejsou ES moduly a nesmí mít `import`. Nemíchej to.

## Rozšiřování

Cílem návrhu bylo, aby přidání komodity, měny nebo jednotky byl **jeden záznam
v registru** a nic jiného.

**Nová komodita** — `src/core/registry/commodities.ts`:

```ts
copper: {
  id: 'copper',
  quoteSymbol: 'HG=F',              // Yahoo symbol
  quoteCurrency: 'USD',
  quoteUnit: 'troy_ounce',
  tickerSymbol: 'Cu',
  sourceUrl: 'https://finance.yahoo.com/quote/HG%3DF/',
  supportedUnits: ['gram', 'kilogram', 'troy_ounce', 'ounce'],
  autoUnitLadder: ['kilogram', 'gram'],
},
```

Plus dva překlady v `src/shared/i18n/{en,cs}.ts`: `commodity.copper`
(nominativ, pro UI) a `commodity.copper.amountLabel` (genitiv — „mědi").
Cache i nabídka v nastavení se přizpůsobí samy.

**Nová měna** — `src/core/registry/currencies.ts`. Uveď všechny zápisy, které
se na stránkách vyskytují, jako `affixes`. `spacing: 'forbidden'` je pro značky
psané natěsno k číslu (české `,-`); detektor pak umí i `1 500,- Kč` jako jeden
celek. `usdQuoteSymbol` je Yahoo symbol pro hodnotu jedné jednotky v USD
(`{KÓD}USD=X`); USD samo má `null`, je to pivot. Chceš-li měnu zapnutou
výchozím nastavením, přidej ji do `DEFAULT_ENABLED_CURRENCIES`.

**Nová jednotka** — `src/core/registry/mass-units.ts`, plus `unit.<id>` v obou
katalozích a zařazení do `supportedUnits` u komodit, kde dává smysl. Gram je
vnitřní základní jednotka, vše se převádí přes `gramsPerUnit`.

**Nový zdroj kurzů** — implementuj `RateProvider`
(`src/background/rate-provider.ts`) a vyměň ho v `service-worker.ts`. Nad tímto
rozhraním nic neví, odkud data jsou.

**Nová volba v nastavení** — seznam povolených hodnot patří **jen** do
`src/shared/settings.ts` (`LANGUAGES`, `LABEL_STYLES`, `DECIMALS`) a options
screen z něj staví ovládací prvky. Nikdy nezakládej druhý seznam v UI: jakmile
se rozejdou, nastavení půjde vybrat, ale `sanitizeSettings()` ho při ukládání
zahodí a volba se tiše vrátí zpět. Test „every offerable value is accepted"
to hlídá.

**Nový jazyk** — `src/shared/i18n/en.ts` je zdroj pravdy; nový katalog se typuje
jako `Catalogue`, takže chybějící klíč je chyba překladu, ne prázdný popisek.
Zaregistruj ho v `CATALOGUES`, `LOCALE_TAGS` a `SUPPORTED_LANGUAGES`.

### Proč vlastní i18n

`chrome.i18n` čte jazyk prohlížeče a nejde přepnout. Uživatel si má jazyk volit
nezávisle, proto jsou katalogy vlastní. `_locales/` se používá **jen** pro popis
v manifestu (to Chrome vykresluje ve Store a na stránce rozšíření).

Název v manifestu se **nelokalizuje**: stojí tam literálem `Price in Metal`,
ne jako `__MSG_`, takže Store, `chrome://extensions` i tooltip ikony ukazují
jedno jméno všem. `_locales/` proto nese už jen `extDescription`.

Uvnitř aplikace je to naopak — `popup.title` a `options.title` jsou běžné
klíče v katalogu a překládají se (`Cena v kovu`). Je to vědomé rozhodnutí:
ve Storu se produkt hledá pod jedním jménem, v UI má mluvit jazykem
uživatele. Nepřepisuj jedno podle druhého.

## Invarianty, které se nesmí porušit

**Text se skenuje po segmentech, ne po uzlech.** Stránky běžně rozdělují jednu
cenu mezi elementy — `<span>1 000</span><span>Kč</span>`, `1 000<sup>,-</sup>`,
`<b>1 000</b> Kč`. `collectSegments()` proto slepí souvislý běh inline textu
a detekce běží nad ním; `replacePricesInSegment()` pak mapuje nález zpět na
uzly a nahrazuje ho přes `Range`. Skenování uzel po uzlu by většinu reálných
e-shopových cen minulo.

Segment končí na blokovém elementu (`BLOCK_TAGS`), na `<br>` a na každém
přeskočeném elementu. Přeskočený element je ve `TreeWalker` filtru odmítnut
(`FILTER_REJECT`), takže se do těla cyklu nikdy nedostane — hranici je nutné
zaznamenat příznakem přímo ve filtru. Na to pozor při každé úpravě filtru.

**Slepení nesmí vyrobit sousedství, které na stránce nebylo.** Mezi sousedními
elementy není v textu mezera, takže konkatenace vytvoří `Novinka13 990,-`
a `195,-Bez členství`. V prvním případě selže hranice slova před částkou
(chytí se jen `990,-` a na stránce zůstane viset `13 `), ve druhém hranice za
značkou `,-` (nechytí se nic). `buildSegment()` proto vkládá `JOIN_SEPARATOR`
(`\u0001`) na styku *písmeno → číslice* a *cokoli kromě číslice → písmeno*.

Jediná kombinace, která musí zůstat slepená, je *číslice → písmeno*: to je
`1 000` + `Kč` a musí se číst jako jedna cena. Proto `GAP` v detektoru
oddělovač toleruje (`1 000 ` + `Kč` v sousedních elementech) a `price.text`
ho před zobrazením odstraňuje — uživatel ho nikdy nesmí vidět ani dostat do
`data-pcx-original`.

**Nespojovat číslice přes hranici elementů.** `unsafeJoins()` označí místa, kde
na styku dvou uzlů stojí číslice proti číslici; match, který takové místo
překročí, se zahodí. Bez toho by se z `<span>100</span><span>200 Kč</span>`
stalo 100 200 Kč. Cena je jedna zmeškaná konverze tam, kde hranice elementu
padne doprostřed čísla — což je mnohem levnější než vymyslet částku.

**Jedna cena se nesmí převést dvakrát.** Segmenty se sbírají dopředu a
zpracovávají po dávkách, takže mezi sběrem a zásahem se uzly mohou změnit —
buď je přepsala stránka, nebo je už převzal jiný segment ze stejného průchodu.
Ofsety ze zastaralého textu pak padnou vedle a vloží druhou náhradu k první:
`81,1 g81,1 g`. Brání tomu dvě věci a obě jsou potřeba:

- `outermostRoots()` v `scan()` zahodí kořen, který leží uvnitř jiného kořene
  téže dávky. Framework typicky nejdřív vloží kontejner a teprve pak ho naplní,
  takže ve frontě běžně skončí blok i blok uvnitř něj a stejný textový uzel by
  se octl ve dvou segmentech.
- `isSegmentCurrent()` před každým zásahem ověří, že segment své uzly pořád
  popisuje. Samotná kontrola `isConnected` nestačí: `deleteContents()` uzel
  neodpojí, jen ho zkrátí, takže uzel po odebrané ceně projde jako připojený.

Projeví se to jen tam, kde je cena rozdělená mezi víc uzlů
(`<span>3 690</span><span> Kč</span>`). Uvnitř jediného uzlu zastaralé ofsety
shodou okolností minou a `locateStart()` je zahodí — na to se ale nedá
spoléhat, je to náhoda konkrétních čísel, ne pravidlo.

**Přeskenování po změně DOM začíná u blokového předka.** MutationObserver
dostane vložený uzel, ale ten často nese jen půlku ceny. `content.ts` proto
do fronty dává `closestBlockElement(node)`, ne uzel samotný.

**Nedělitelné mezery.** `&nbsp;` (U+00A0) je v HTML běžnější než obyčejná
mezera a česká typografie používá úzkou U+202F. Oba moduly sdílejí
`GROUP_SPACES` z `number-format.ts` — nepiš vlastní seznam mezer.

**Detekce cen.** `src/core/number-format.ts` je jediné místo, které rozhoduje,
zda je řetězec částka. Regex v `price-detector.ts` je záměrně velkorysý; přísný
je až parser. Falešně negativní výsledek stojí jednu nepřevedenou cenu, falešně
pozitivní přepíše něco, co cena není — proto parser odmítá vše nejednoznačné
(IP adresy, datumy, verze, `1,2345`). Pravidlo pro oddělovače: tři číslice za
oddělovačem znamenají tisíce, jedna nebo dvě desetinnou část; když jsou v čísle
oba oddělovače, desetinný je ten poslední. Změny v této logice vždy doplň
o testy v `tests/number-format.test.ts`.

Seskupení po třech vynucuje i `AMOUNT_PATTERN_SOURCE`, ne až parser. Volnější
vzor by v souvislém textu spolkl i cizí čísla (`ETA 3348 90000 699,-`),
neuspěl při parsování a cenu ztratil; s vynuceným seskupením se regex vrátí
k číslicím, které částku opravdu tvoří. Neuvolňuj ho zpět na „cokoli mezi
číslicemi".

**Žádné HTML ze stringů.** Content script staví náhrady výhradně přes
`document.createTextNode` a `textContent`. Nikdy `innerHTML`, `insertAdjacentHTML`
ani podobné — obsah stránky je nedůvěryhodný vstup.

**Neblokovat stránku.** Content script běží na `document_idle` a veškerou práci
dělá v dávkách přes `requestIdleCallback` (`dom-scanner.ts`). Nepřidávej
synchronní průchod celým DOM.

**Nedůvěřovat uloženým datům.** `sanitizeSettings()` a `readCacheEntry()`
rekonstruují data z úložiště pole po poli. Data přežijí downgrade, ruční editaci
i poškození — nikdy je nepoužívej přímo.

**Nedůvěřovat odpovědi ze sítě.** `readQuote()` neverifikuje jen tvar, ale i
rozsah hodnot. Nesmyslná cena se zahodí, nepropaguje.

**Fail closed.** Když chybí kurz nebo se převod nepovede, cena zůstane tak, jak
byla. Nikdy nezobrazuj odhad.

**Žádné cookies třetích stran.** Fetch na Yahoo má `credentials: 'omit'`.
Rozšíření nesmí dělat identifikovatelné requesty jménem uživatele.

**Respektovat 6hodinovou cache.** Nepřidávej cesty, které obcházejí
`getRates()`. Vynucený fetch má jediné legitimní místo — tlačítko „Aktualizovat
nyní" v nastavení.

### Kde se ceny nepřepisují

`SKIP_TAGS` v `dom-scanner.ts`: editační plochy (`input`, `textarea`,
`contenteditable`) — přepis by poškodil uživatelský vstup; technický obsah
(`code`, `pre`, `script`, `style`) — číslo tam není cena. `button` v seznamu
záměrně **není**: ceny bývají v nákupních tlačítkách. Stránka se může odhlásit
atributem `data-pcx-skip`.

## Chrome Web Store

Rozhodnutí, která tam směřují, a jejich odůvodnění:

- **`permissions`: jen `storage`, `alarms`, `activeTab`.** Nic dalšího není
  potřeba; `activeTab` slouží popupu ke zjištění domény aktivního panelu.
- **`host_permissions`: jen `https://query1.finance.yahoo.com/*`.** Jediný
  cizí host, se kterým rozšíření mluví.
- **Content script na `http://*/*` a `https://*/*`**, ne `<all_urls>` — užší
  a nezahrnuje `file://`. Široký rozsah je nutný (ceny jsou na libovolném webu)
  a je potřeba ho odůvodnit v popisu položky; viz `STORE_LISTING.md`.
- **`all_frames: true` + `match_about_blank: true`.** Ceny bývají v iframech —
  reklamní a widgetové bloky (`ads-pb__price-value` a spol.) tam patří skoro
  vždy, a řada rámů je psaná scriptem bez vlastního `src`. Bez obojího se
  takové ceny nikdy nepřevedou. Změřeno na stránce s 30 rámy a ~1200 cenami:
  vše převedeno, 0 long tasks, DOMContentLoaded 24 ms — idle slicing to
  unese. Content script v rámu bez `document.body` končí hned.
- **Žádný vzdálený kód.** Vše je v balíčku, CSP zakazuje cokoli jiného.
- **Disclaimer v nastavení.** Kurzy jsou orientační a zpožděné; text to musí
  říkat, aby rozšíření nevypadalo jako finanční nástroj.

## Testování v prohlížeči

`npm test` pokrývá logiku i přepis DOM (jsdom), ale ne manifest, CSP, service
worker a messaging. Na ty je potřeba skutečný Chrome.

Po reloadu rozbaleného rozšíření zůstanou už otevřené karty s odpojeným starým
content scriptem — na nich se změny nastavení neprojeví, dokud se stránka
nenačte znovu. Při ladění vždy nejdřív refreshni kartu.

**Chrome 137+ ignoruje přepínač `--load-extension`** (opatření proti malwaru) —
nefunguje ani s `--enable-unsafe-extension-debugging`. Rozšíření se načte přes
CDP doménu `Extensions.loadUnpacked`:

```js
// proti ws z http://127.0.0.1:9222/json/version
await send('Extensions.loadUnpacked', { path: '/absolutní/cesta/dist' });
```

Chrome spusť s `--remote-debugging-port=9222` a vlastním `--user-data-dir`.
Testovací stránku servíruj přes HTTP — na `file://` se content script
neinjektuje, protože v `matches` je jen http/https.

## Konvence

- TypeScript se zapnutým `strict`, `noUncheckedIndexedAccess` a
  `exactOptionalPropertyTypes`. Indexace do `Record` vrací `T | undefined`;
  ošetři to, necastuj to pryč.
- Import uvnitř `src/` přes alias `@/`.
- Komentáře vysvětlují **proč**, ne co. Kód, který vypadá přehnaně opatrně
  (validace uložených dat, kontrola rozsahů), má mít u sebe důvod.
- Uživatelské texty patří do i18n katalogů, ne do kódu.
- `rm` vždy s absolutní cestou (viz globální instrukce).
