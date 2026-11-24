import { SITE_HOST } from '../config/social';

/** Someone's page in the app: /persona/{id}. */
export function personPath(userId: string): string {
  return `/persona/${userId}`;
}

/** The address to share a profile with: ballastasera.it/@name when they picked a username (short,
 * and readable in a story), else their /persona link. */
export function profileShareUrl(userId: string, username: string | null | undefined): string {
  return username ? `https://${SITE_HOST}/@${username}` : `https://${SITE_HOST}${personPath(userId)}`;
}

/** The same without the scheme, the way it's printed: "ballastasera.it/@kryptos". */
export function profileShareLabel(userId: string, username: string | null | undefined): string {
  return profileShareUrl(userId, username).replace(/^https:\/\//, '');
}
