import type { LanguagePreference } from '@/shared/settings';
import { cs } from './cs';
import { en, type Catalogue, type MessageKey } from './en';

/**
 * A small translation layer of our own.
 *
 * `chrome.i18n` reads the browser UI language and cannot be overridden, but
 * the user is allowed to pick the extension's language independently of the
 * browser, so the catalogues live here. `_locales` is still used, but only for
 * the manifest strings Chrome renders in the store and the extensions page.
 */

export type SupportedLanguage = 'cs' | 'en';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'cs'];

const CATALOGUES: Readonly<Record<SupportedLanguage, Catalogue>> = { en, cs };

const LOCALE_TAGS: Readonly<Record<SupportedLanguage, string>> = {
  en: 'en-US',
  cs: 'cs-CZ',
};

export type { MessageKey };

/** Values substituted into `{placeholder}` slots. */
export type Placeholders = Readonly<Record<string, string | number>>;

export interface Translator {
  readonly language: SupportedLanguage;
  /** BCP 47 tag for Intl formatting in the chosen language. */
  readonly locale: string;
  (key: MessageKey, placeholders?: Placeholders): string;
}

function detectBrowserLanguage(): SupportedLanguage {
  let tag = '';
  try {
    tag = chrome.i18n?.getUILanguage?.() ?? '';
  } catch {
    tag = '';
  }
  if (tag === '' && typeof navigator !== 'undefined') tag = navigator.language ?? '';

  const primary = tag.toLowerCase().split('-')[0] ?? '';
  return primary === 'cs' ? 'cs' : 'en';
}

export function resolveLanguage(preference: LanguagePreference): SupportedLanguage {
  if (preference === 'cs' || preference === 'en') return preference;
  return detectBrowserLanguage();
}

/**
 * Fills `{placeholder}` slots. The result is only ever written with
 * `textContent`, never parsed as HTML, so no escaping is involved.
 */
function interpolate(template: string, placeholders: Placeholders | undefined): string {
  if (placeholders === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = placeholders[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(language: SupportedLanguage): Translator {
  const catalogue = CATALOGUES[language];

  const translate = ((key: MessageKey, placeholders?: Placeholders): string =>
    interpolate(catalogue[key] ?? en[key] ?? key, placeholders)) as Translator;

  return Object.assign(translate, {
    language,
    locale: LOCALE_TAGS[language],
  });
}

/** Convenience for call sites that hold a preference rather than a language. */
export function translatorFor(preference: LanguagePreference): Translator {
  return createTranslator(resolveLanguage(preference));
}

/**
 * Names of registry entries.
 *
 * Registry ids are data, so the keys are built at runtime. The translator
 * falls back to the key itself, which makes a missing entry visible without
 * breaking the page.
 */
export function commodityName(translate: Translator, commodityId: string): string {
  return translate(`commodity.${commodityId}` as MessageKey);
}

/** Genitive-style label used when an amount is labelled with a name. */
export function commodityAmountLabel(translate: Translator, commodityId: string): string {
  return translate(`commodity.${commodityId}.amountLabel` as MessageKey);
}

export function massUnitName(translate: Translator, unitId: string): string {
  return translate(`unit.${unitId}` as MessageKey);
}
