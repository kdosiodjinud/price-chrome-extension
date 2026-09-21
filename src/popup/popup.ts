import { getCommodity } from '@/core/registry/commodities';
import { getMassUnit } from '@/core/registry/mass-units';
import { commodityName, translatorFor, type MessageKey, type Translator } from '@/shared/i18n';
import { MessageType, sendMessage } from '@/shared/messages';
import {
  isHostBlocked,
  loadSettings,
  normalizeHost,
  saveSettings,
  type Settings,
} from '@/shared/settings';

/**
 * The toolbar popup: the current rate, a global on/off switch and a
 * one-click switch for the site in front of the user. Anything more detailed
 * lives in the options screen.
 */

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Missing element #${id}`);
  return found as T;
}

const controls = {
  rate: element<HTMLParagraphElement>('rate'),
  globalToggle: element<HTMLInputElement>('globalToggle'),
  globalToggleLabel: element<HTMLSpanElement>('globalToggleLabel'),
  siteToggle: element<HTMLInputElement>('siteToggle'),
  siteToggleRow: element<HTMLLabelElement>('siteToggleRow'),
  siteToggleLabel: element<HTMLSpanElement>('siteToggleLabel'),
  state: element<HTMLParagraphElement>('state'),
  openOptions: element<HTMLButtonElement>('openOptions'),
};

/** Hostname of the active tab, or null on pages we cannot act on. */
async function activeHost(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  if (url === undefined) return null;

  try {
    const parsed = new URL(url);
    // Only http(s) pages get a content script, so only those can be toggled.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return normalizeHost(parsed.hostname);
  } catch {
    return null;
  }
}

function applyStaticText(translate: Translator): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset['i18n'];
    if (key === undefined) continue;
    node.textContent = translate(key as MessageKey);
  }
  document.documentElement.lang = translate.language;
}

async function renderRate(settings: Settings, translate: Translator): Promise<void> {
  const commodity = getCommodity(settings.commodity);
  const response = await sendMessage(MessageType.GetRates);
  const snapshot = response?.snapshot ?? null;

  if (commodity === undefined || snapshot === null) {
    controls.rate.textContent = translate('popup.noRate');
    return;
  }

  const usdPerQuoteUnit = snapshot.commodityUsdPerQuoteUnit[commodity.id];
  const quoteUnit = getMassUnit(commodity.quoteUnit);
  if (usdPerQuoteUnit === undefined || quoteUnit === undefined) {
    controls.rate.textContent = translate('popup.noRate');
    return;
  }

  const price = new Intl.NumberFormat(translate.locale, {
    style: 'currency',
    currency: commodity.quoteCurrency,
    maximumFractionDigits: 2,
  }).format(usdPerQuoteUnit);

  controls.rate.textContent = translate('popup.currentRate', {
    unit: quoteUnit.symbol,
    commodity: commodityName(translate, commodity.id),
    price,
  });
}

/** Reflects the current state in the switches and the status line. */
function render(settings: Settings, translate: Translator, host: string | null): void {
  const blocked = host !== null && isHostBlocked(host, settings.blockedHosts);

  controls.globalToggle.checked = settings.enabled;

  controls.siteToggle.checked = !blocked;
  // A per-site switch means nothing while the extension is off everywhere.
  controls.siteToggle.disabled = host === null || !settings.enabled;
  controls.siteToggleRow.hidden = host === null;
  controls.siteToggleLabel.textContent =
    host === null ? '' : translate('popup.activeOnSite', { host });

  if (!settings.enabled) controls.state.textContent = translate('popup.globallyOff');
  else if (host === null) controls.state.textContent = translate('popup.unavailable');
  else if (blocked) controls.state.textContent = translate('popup.blockedHere', { host });
  else controls.state.textContent = translate('popup.enabledHere');
}

async function init(): Promise<void> {
  let settings = await loadSettings();
  const translate = translatorFor(settings.language);
  applyStaticText(translate);

  const host = await activeHost();
  controls.globalToggleLabel.textContent = translate('popup.globalToggle');
  render(settings, translate, host);
  await renderRate(settings, translate);

  controls.globalToggle.addEventListener('change', () => {
    void (async () => {
      const current = await loadSettings();
      settings = { ...current, enabled: controls.globalToggle.checked };
      await saveSettings(settings);
      render(settings, translate, host);
    })();
  });

  controls.siteToggle.addEventListener('change', () => {
    void (async () => {
      if (host === null) return;
      const current = await loadSettings();
      const withoutHost = current.blockedHosts.filter((entry) => entry !== host);
      const blockedHosts = controls.siteToggle.checked ? withoutHost : [...withoutHost, host];

      settings = { ...current, blockedHosts };
      await saveSettings(settings);
      // The content script watches storage and re-applies or reverts on its
      // own, so the open tab updates without a reload.
      render(settings, translate, host);
    })();
  });

  controls.openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

void init();
