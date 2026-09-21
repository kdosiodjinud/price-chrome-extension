import { clearRateCache, getRateStatus, getRates } from './rate-cache';
import { yahooFinanceProvider } from './yahoo-finance';
import { RATE_TTL_MS } from '@/shared/constants';
import { MessageType, isRequestMessage } from '@/shared/messages';

/**
 * The service worker is the only part of the extension that touches the
 * network. Content scripts ask it for rates and it answers from cache, which
 * keeps third-party requests off the pages the user is browsing.
 */

const provider = yahooFinanceProvider;

const REFRESH_ALARM = 'refresh-rates';
const ALARM_PERIOD_MINUTES = RATE_TTL_MS / 60_000;

/** Keeps the cache warm so the first page of a session converts immediately. */
async function ensureAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(REFRESH_ALARM);
  if (existing !== undefined) return;
  await chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: ALARM_PERIOD_MINUTES,
    // Wait out the period before the first run; installation already warms
    // the cache, and a browser restart should not trigger an extra fetch.
    delayInMinutes: ALARM_PERIOD_MINUTES,
  });
}

function handleMessage(
  message: unknown,
  sendResponse: (response: unknown) => void,
): boolean {
  if (!isRequestMessage(message)) {
    sendResponse({ ok: false, snapshot: null, error: 'Unsupported message' });
    return false;
  }

  switch (message.type) {
    case MessageType.GetRates:
    case MessageType.RefreshRates: {
      const force = message.type === MessageType.RefreshRates;
      void getRates(provider, force).then(({ snapshot, error }) => {
        sendResponse({ ok: snapshot !== null, snapshot, error });
      });
      return true;
    }
    case MessageType.ClearRateCache: {
      void clearRateCache().then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }
    case MessageType.GetRateStatus: {
      void getRateStatus(provider).then((status) => {
        sendResponse(status);
      });
      return true;
    }
    default:
      sendResponse({ ok: false, snapshot: null, error: 'Unsupported message' });
      return false;
  }
}

// Only extension pages and our own content scripts can reach this listener:
// the manifest declares no `externally_connectable`, so web pages cannot.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
  handleMessage(message, sendResponse),
);

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm();
  // Warm the cache once so the very first page already has rates.
  void getRates(provider);
});

chrome.runtime.onStartup.addListener(() => {
  void ensureAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REFRESH_ALARM) return;
  void getRates(provider, true);
});
