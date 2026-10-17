/** Opens the connection to `origin` before the first request that needs it:
 * DNS, TCP and TLS are a few round trips, the slowest part of a first request
 * on a phone. `crossorigin`, because the requests it's for are fetch()es
 * without credentials (MapLibre's tiles, glyphs and sprites), which don't
 * share a connection opened for credentialed ones. Once per origin. Browser
 * only. */
export function preconnect(origin: string): void {
  if (document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  link.crossOrigin = 'anonymous';
  document.head.append(link);
}
