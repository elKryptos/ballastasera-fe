export const LANG_COOKIE_NAME = 'lang';

/**
 * Pulls `lang` out of a raw `Cookie` header string — same wire format for
 * `Request.headers.get('cookie')` on the server and `document.cookie` on
 * the client, so one parser covers both.
 */
export function readLangCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)lang=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Persists the chosen language for a year so the server can render the
 * right language on the very next visit, instead of always rendering the
 * default and swapping it client-side after hydration.
 */
export function writeLangCookie(lang: string): void {
  document.cookie = `${LANG_COOKIE_NAME}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}
