/** Values shared between the service worker and the extension pages. */

/**
 * How long a fetched set of rates is served before going back to the
 * provider. Browsing must not generate network traffic, so this is
 * deliberately long: metal prices and FX rates move far too slowly to justify
 * a request per page.
 */
export const RATE_TTL_MS = 6 * 60 * 60 * 1000;

export const RATE_TTL_HOURS = RATE_TTL_MS / (60 * 60 * 1000);
