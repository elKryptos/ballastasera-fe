import { UrlMatchResult, UrlSegment } from '@angular/router';

/** The shape the backend allows (UsernameUtils), upper case tolerated: it's looked up ignoring case. */
const HANDLE = /^@([A-Za-z0-9._]{3,30})$/;

/** /@kryptos: one segment starting with "@", its rest as the `username` param. A route path can't
 * say that (":username" takes the whole segment), hence a matcher. */
export function usernameMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length !== 1) return null;
  const match = HANDLE.exec(segments[0].path);
  if (!match) return null;
  return {
    consumed: segments,
    posParams: { username: new UrlSegment(match[1].toLowerCase(), {}) },
  };
}
