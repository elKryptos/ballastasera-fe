import { HttpErrorResponse } from '@angular/common/http';

/** The code the backend puts in errors.code to say which rule a request broke (RATE_LIMITED,
 * NOT_FRIENDS, USERNAME_TAKEN…), or null: another kind of failure, or a status without one. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const code: unknown = error.error?.errors?.code;
  return typeof code === 'string' ? code : null;
}

/** The status of a failed request, or null when it never got an answer (a thrown error, offline). */
export function apiErrorStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse && error.status !== 0 ? error.status : null;
}

/** The user's words for a failed request: by its code first, then by its status, then the fallback.
 * Each feature keeps its own table (invites, usernames, moderation…), the reading is the same. */
export function apiErrorMessage(
  error: unknown,
  messages: Partial<Record<string | number, string>>,
  fallback = 'Qualcosa è andato storto. Riprova tra poco.',
): string {
  const code = apiErrorCode(error);
  if (code && messages[code]) return messages[code];
  const status = apiErrorStatus(error);
  if (status !== null && messages[status]) return messages[status];
  return fallback;
}
