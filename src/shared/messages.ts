import type { RateSnapshot } from '@/core/types';

/**
 * The message contract between the extension pages / content scripts and the
 * service worker. Only the service worker talks to the network, so everything
 * rate-related goes through here.
 */

export const MessageType = {
  /** Ask for rates, using the cache when it is still fresh. */
  GetRates: 'GET_RATES',
  /** Force a refetch regardless of cache age. */
  RefreshRates: 'REFRESH_RATES',
  /** Drop the cached snapshot. The next request refetches. */
  ClearRateCache: 'CLEAR_RATE_CACHE',
  /** Cache metadata for the options and popup screens. */
  GetRateStatus: 'GET_RATE_STATUS',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface RequestMessage {
  readonly type: MessageType;
}

export interface RateStatus {
  /** When the cached snapshot was fetched, or null when there is none. */
  readonly fetchedAt: number | null;
  /** When the snapshot goes stale and the next request will refetch. */
  readonly expiresAt: number | null;
  /** Message from the last failed fetch, for display in the options screen. */
  readonly lastError: string | null;
  readonly commodityCount: number;
  readonly currencyCount: number;
}

export interface RatesResponse {
  readonly ok: boolean;
  readonly snapshot: RateSnapshot | null;
  readonly error: string | null;
}

export type ResponseFor<T extends MessageType> = T extends typeof MessageType.GetRateStatus
  ? RateStatus
  : T extends typeof MessageType.ClearRateCache
    ? { readonly ok: true }
    : RatesResponse;

/** Narrows an unknown runtime message to one we recognise. */
export function isRequestMessage(value: unknown): value is RequestMessage {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    typeof type === 'string' && (Object.values(MessageType) as string[]).includes(type)
  );
}

/**
 * Sends a message to the service worker.
 *
 * The worker can be asleep or mid-restart, and the extension can be reloaded
 * underneath a content script still living on a page, so failure here is
 * routine rather than exceptional and is reported instead of thrown.
 */
export async function sendMessage<T extends MessageType>(
  type: T,
): Promise<ResponseFor<T> | null> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({ type } satisfies RequestMessage);
    return (response ?? null) as ResponseFor<T> | null;
  } catch {
    return null;
  }
}
