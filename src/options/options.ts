import type { DecimalPreference, LabelStyle } from '@/core/formatter';
import { ALL_COMMODITY_IDS, getCommodity } from '@/core/registry/commodities';
import { ALL_CURRENCY_CODES } from '@/core/registry/currencies';
import { getMassUnit } from '@/core/registry/mass-units';
import { RATE_TTL_HOURS } from '@/shared/constants';
import {
  commodityName,
  massUnitName,
  SUPPORTED_LANGUAGES,
  translatorFor,
  type MessageKey,
  type Translator,
} from '@/shared/i18n';
import { MessageType, sendMessage } from '@/shared/messages';
import {
  DECIMALS,
  DEFAULT_SETTINGS,
  LABEL_STYLES,
  loadSettings,
  normalizeHost,
  saveSettings,
  type LanguagePreference,
  type Settings,
} from '@/shared/settings';

/**
 * The options screen.
 *
 * Every control writes straight through to storage, which the content scripts
 * are already watching, so changes take effect on open tabs without a reload.
 * All text is set with `textContent`; nothing here builds markup from strings.
 */

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing element #${id}`);
  return found as T;
}

const controls = {
  enabled: element<HTMLInputElement>('enabled'),
  language: element<HTMLSelectElement>('language'),
  commodity: element<HTMLSelectElement>('commodity'),
  unit: element<HTMLSelectElement>('unit'),
  decimals: element<HTMLSelectElement>('decimals'),
  labelStyle: element<HTMLSelectElement>('labelStyle'),
  showOriginalInTooltip: element<HTMLInputElement>('showOriginalInTooltip'),
  highlightConverted: element<HTMLInputElement>('highlightConverted'),
  currencies: element<HTMLDivElement>('currencies'),
  blockedHosts: element<HTMLTextAreaElement>('blockedHosts'),
  blocklistWarning: element<HTMLParagraphElement>('blocklistWarning'),
  sourceHint: element<HTMLParagraphElement>('sourceHint'),
  sourceLink: element<HTMLAnchorElement>('sourceLink'),
  lastUpdate: element<HTMLElement>('lastUpdate'),
  nextUpdate: element<HTMLElement>('nextUpdate'),
  refresh: element<HTMLButtonElement>('refresh'),
  clearCache: element<HTMLButtonElement>('clearCache'),
  toast: element<HTMLParagraphElement>('toast'),
};

let settings: Settings = DEFAULT_SETTINGS;
let translate: Translator = translatorFor(DEFAULT_SETTINGS.language);

// --- Rendering ---------------------------------------------------------------

function applyStaticText(): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset['i18n'];
    if (key === undefined) continue;
    node.textContent = translate(key as MessageKey);
  }
  document.documentElement.lang = translate.language;
}

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function fillLanguageSelect(): void {
  controls.language.replaceChildren();
  addOption(controls.language, 'auto', translate('options.language.auto'));
  for (const language of SUPPORTED_LANGUAGES) {
    // Label each language in its own language, the way language pickers do.
    addOption(controls.language, language, translatorFor(language)('lang.name'));
  }
}

function fillCommoditySelect(): void {
  controls.commodity.replaceChildren();
  for (const id of ALL_COMMODITY_IDS) {
    addOption(controls.commodity, id, commodityName(translate, id));
  }
}

/** Unit choices depend on the selected commodity, so this is rebuilt on change. */
function fillUnitSelect(commodityId: string, selected: string): void {
  const commodity = getCommodity(commodityId);
  controls.unit.replaceChildren();
  addOption(controls.unit, 'auto', translate('unit.auto'));

  for (const unitId of commodity?.supportedUnits ?? []) {
    if (getMassUnit(unitId) === undefined) continue;
    addOption(controls.unit, unitId, massUnitName(translate, unitId));
  }

  const available = [...controls.unit.options].some((option) => option.value === selected);
  controls.unit.value = available ? selected : 'auto';
}

function fillDecimalsSelect(): void {
  controls.decimals.replaceChildren();
  for (const choice of DECIMALS) {
    addOption(
      controls.decimals,
      String(choice),
      choice === 'auto' ? translate('decimals.auto') : String(choice),
    );
  }
}

function fillLabelStyleSelect(): void {
  controls.labelStyle.replaceChildren();
  for (const style of LABEL_STYLES) {
    addOption(controls.labelStyle, style, translate(`label.${style}` as MessageKey));
  }
}

function fillCurrencyChecklist(enabled: readonly string[]): void {
  controls.currencies.replaceChildren();

  for (const code of ALL_CURRENCY_CODES) {
    const label = document.createElement('label');
    label.className = 'switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = code;
    input.checked = enabled.includes(code);
    input.addEventListener('change', () => void persist());

    const text = document.createElement('span');
    text.textContent = code;

    label.append(input, text);
    controls.currencies.appendChild(label);
  }
}

function selectedCurrencies(): string[] {
  return [...controls.currencies.querySelectorAll<HTMLInputElement>('input:checked')].map(
    (input) => input.value,
  );
}

function renderSource(): void {
  const commodity = getCommodity(controls.commodity.value);
  controls.sourceHint.textContent = translate('options.source.hint', { hours: RATE_TTL_HOURS });

  if (commodity === undefined) {
    controls.sourceLink.removeAttribute('href');
    controls.sourceLink.textContent = '';
    return;
  }

  // The URL is a registry constant, but validate the scheme anyway so a bad
  // entry can never turn into a javascript: link.
  const url = new URL(commodity.sourceUrl);
  if (url.protocol !== 'https:') {
    controls.sourceLink.removeAttribute('href');
    controls.sourceLink.textContent = '';
    return;
  }

  controls.sourceLink.href = url.href;
  controls.sourceLink.textContent = translate('options.source.linkLabel', {
    commodity: commodityName(translate, commodity.id),
  });
}

function formatTimestamp(value: number | null): string {
  if (value === null) return translate('options.never');
  return new Intl.DateTimeFormat(translate.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function renderStatus(): Promise<void> {
  const status = await sendMessage(MessageType.GetRateStatus);
  controls.lastUpdate.textContent = formatTimestamp(status?.fetchedAt ?? null);
  controls.nextUpdate.textContent = formatTimestamp(status?.expiresAt ?? null);
}

let toastTimer: number | null = null;

function showToast(text: string): void {
  controls.toast.textContent = text;
  controls.toast.hidden = false;
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    controls.toast.hidden = true;
  }, 2_500) as unknown as number;
}

// --- Persistence -------------------------------------------------------------

/**
 * Reads the blocklist textarea, keeping valid hostnames and reporting the rest
 * rather than silently dropping what the user typed.
 */
function readBlocklist(): { hosts: string[]; invalid: string[] } {
  const hosts: string[] = [];
  const invalid: string[] = [];

  for (const line of controls.blockedHosts.value.split('\n')) {
    if (line.trim() === '') continue;
    const host = normalizeHost(line);
    if (host === null) invalid.push(line.trim());
    else if (!hosts.includes(host)) hosts.push(host);
  }
  return { hosts, invalid };
}

function readForm(): Settings {
  const { hosts, invalid } = readBlocklist();

  if (invalid.length > 0) {
    controls.blocklistWarning.textContent = translate('options.blocklist.invalid', {
      items: invalid.join(', '),
    });
    controls.blocklistWarning.hidden = false;
  } else {
    controls.blocklistWarning.hidden = true;
  }

  const rawDecimals = controls.decimals.value;
  const decimals: DecimalPreference =
    rawDecimals === 'auto' ? 'auto' : (Number(rawDecimals) as DecimalPreference);

  return {
    enabled: controls.enabled.checked,
    language: controls.language.value as LanguagePreference,
    commodity: controls.commodity.value,
    unit: controls.unit.value,
    decimals,
    labelStyle: controls.labelStyle.value as LabelStyle,
    enabledCurrencies: selectedCurrencies(),
    blockedHosts: hosts,
    showOriginalInTooltip: controls.showOriginalInTooltip.checked,
    highlightConverted: controls.highlightConverted.checked,
  };
}

async function persist(): Promise<void> {
  const next = readForm();
  const languageChanged = next.language !== settings.language;
  const commodityChanged = next.commodity !== settings.commodity;

  await saveSettings(next);
  settings = await loadSettings();

  if (languageChanged) {
    translate = translatorFor(settings.language);
    renderAll();
  } else if (commodityChanged) {
    fillUnitSelect(settings.commodity, settings.unit);
    renderSource();
  }

  showToast(translate('options.saved'));
}

function renderAll(): void {
  applyStaticText();
  fillLanguageSelect();
  fillCommoditySelect();
  fillDecimalsSelect();
  fillLabelStyleSelect();
  fillCurrencyChecklist(settings.enabledCurrencies);

  controls.enabled.checked = settings.enabled;
  controls.language.value = settings.language;
  controls.commodity.value = settings.commodity;
  fillUnitSelect(settings.commodity, settings.unit);
  controls.decimals.value = String(settings.decimals);
  controls.labelStyle.value = settings.labelStyle;
  controls.showOriginalInTooltip.checked = settings.showOriginalInTooltip;
  controls.highlightConverted.checked = settings.highlightConverted;
  controls.blockedHosts.value = settings.blockedHosts.join('\n');
  controls.blockedHosts.placeholder = translate('options.blocklist.placeholder');

  renderSource();
  void renderStatus();
}

// --- Wiring ------------------------------------------------------------------

function attachListeners(): void {
  const immediate = [
    controls.enabled,
    controls.language,
    controls.commodity,
    controls.unit,
    controls.decimals,
    controls.labelStyle,
    controls.showOriginalInTooltip,
    controls.highlightConverted,
  ];
  for (const control of immediate) {
    control.addEventListener('change', () => void persist());
  }

  // The blocklist is free text, so save when the user is done with it.
  controls.blockedHosts.addEventListener('blur', () => void persist());

  controls.refresh.addEventListener('click', () => {
    void (async () => {
      controls.refresh.disabled = true;
      try {
        const response = await sendMessage(MessageType.RefreshRates);
        if (response?.ok === true) showToast(translate('options.refreshed'));
        else {
          showToast(
            translate('options.refreshFailed', { error: response?.error ?? 'unknown' }),
          );
        }
        await renderStatus();
      } finally {
        controls.refresh.disabled = false;
      }
    })();
  });

  controls.clearCache.addEventListener('click', () => {
    void (async () => {
      controls.clearCache.disabled = true;
      try {
        await sendMessage(MessageType.ClearRateCache);
        showToast(translate('options.cacheCleared'));
        await renderStatus();
      } finally {
        controls.clearCache.disabled = false;
      }
    })();
  });
}

async function init(): Promise<void> {
  settings = await loadSettings();
  translate = translatorFor(settings.language);
  renderAll();
  attachListeners();
}

void init();
