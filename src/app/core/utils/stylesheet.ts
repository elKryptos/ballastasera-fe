/** Adds a stylesheet kept out of the initial bundle (angular.json, "inject":
 * false) and resolves once it's applied, so what it styles never shows up
 * unstyled; on a failed load too, rather than hold up the page. It goes in
 * before the app's own styles, where it would have been bundled, so their
 * overrides keep winning ties. Once per page: later calls find the first
 * <link>. Browser only. */
export function loadStylesheet(href: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`link[data-lazy-style="${href}"]`);
  if (existing) return existing.sheet ? Promise.resolve() : loaded(existing);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset['lazyStyle'] = href;
  const appStyles = document.querySelector('link[rel="stylesheet"][href*="styles"]');
  document.head.insertBefore(link, appStyles);
  return loaded(link);
}

function loaded(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}
