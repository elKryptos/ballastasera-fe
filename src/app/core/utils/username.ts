import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { RESERVED_USERNAMES, SITE_HOST, USERNAME_MAX, USERNAME_MIN } from '../config/social';
import { apiErrorCode } from './api-errors';

/** What's wrong with a username, by the backend's rules (UsernameUtils): checked here first, so
 * only a free/taken question goes to the backend. TAKEN comes from it. */
export type UsernameIssue = 'chars' | 'short' | 'dots' | 'reserved' | 'taken';

export const USERNAME_ISSUE_TEXTS: Record<UsernameIssue, string> = {
  chars: 'Solo lettere minuscole, numeri, punto e trattino basso.',
  short: `Almeno ${USERNAME_MIN} caratteri.`,
  dots: 'Non può iniziare o finire con un punto, né averne due di fila.',
  reserved: 'Questo nome è riservato: scegline un altro.',
  taken: 'Già in uso: scegline un altro.',
};

export const USERNAME_EMPTY_TEXT =
  `Serve per il link del tuo profilo. Minuscole, numeri, punto e trattino basso, da ${USERNAME_MIN} a ${USERNAME_MAX}.`;

/** The way it's typed to the way it's kept: no "@" in front, no spaces, lower case. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase().slice(0, USERNAME_MAX);
}

/** Its problem, or null: a good username (or none at all, which is fine: it's optional). */
export function usernameIssue(username: string): Exclude<UsernameIssue, 'taken'> | null {
  if (!username) return null;
  if (!/^[a-z0-9._]+$/.test(username)) return 'chars';
  if (username.length < USERNAME_MIN) return 'short';
  if (/^\.|\.$|\.\./.test(username)) return 'dots';
  if (RESERVED_USERNAMES.includes(username)) return 'reserved';
  return null;
}

/** The form's check, on what was typed, normalized. */
export function usernameFormat(control: AbstractControl<string>): ValidationErrors | null {
  const issue = usernameIssue(normalizeUsername(control.value ?? ''));
  return issue ? { username: issue } : null;
}

/** The Instagram handle as a username, when it would be a valid one: the field suggests it. */
export function usernameFromInstagram(instagram: string | null | undefined): string | null {
  if (!instagram) return null;
  const candidate = normalizeUsername(instagram);
  return candidate && !usernameIssue(candidate) ? candidate : null;
}

/** "ballastasera.it/@name". */
export function usernameLink(username: string): string {
  return `${SITE_HOST}/@${username}`;
}

/** What to say when saving the username failed, or null when the failure is about something else. */
export function usernameErrorMessage(error: unknown): string | null {
  const code = apiErrorCode(error);
  if (code === 'USERNAME_TAKEN') return 'Questo nome utente è appena stato preso: scegline un altro.';
  if (code === 'USERNAME_RESERVED') return USERNAME_ISSUE_TEXTS.reserved;
  if (error instanceof HttpErrorResponse && error.status === 400 && error.error?.errors?.username) {
    return `Il nome utente non va bene. ${USERNAME_ISSUE_TEXTS.chars}`;
  }
  return null;
}
