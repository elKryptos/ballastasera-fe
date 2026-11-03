import { HttpErrorResponse } from '@angular/common/http';

/** The backend's 409s on organizer requests carry a code in errors.code. */
const CONFLICT_MESSAGES: Record<string, string> = {
  PENDING_REQUEST_EXISTS: 'Hai già una richiesta in revisione.',
  ORGANIZER_LIMIT_REACHED: 'Hai già una pagina da organizzatore.',
  ORGANIZER_ALREADY_CLAIMED: 'Questa pagina è appena stata assegnata a qualcun altro.',
  REQUEST_NOT_PENDING: 'Questa richiesta è già stata revisionata.',
  CONCURRENT_UPDATE: 'Questa richiesta è già stata revisionata.',
  LOGO_NOT_ALLOWED: 'Il logo si può caricare una sola volta, dopo l\'invio della richiesta.',
  VENUE_REQUIRED: 'Manca il locale: crealo prima di approvare.',
  VENUE_ALREADY_LINKED: 'Questo locale è già collegato a un altro organizzatore.',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Controlla i dati inseriti e riprova.',
  403: 'Il tuo account non può inviare questa richiesta.',
  404: 'La pagina o la città scelta non esiste più.',
};

const FALLBACK_MESSAGE = 'Qualcosa è andato storto. Riprova tra poco.';

export function requestErrorCode(error: unknown): string | null {
  return error instanceof HttpErrorResponse ? (error.error?.errors?.code ?? null) : null;
}

/** The backend's error, in the user's words. The admin reads some of them
 * differently: overrides, by code or by status, win. */
export function requestErrorMessage(error: unknown, overrides: Record<string | number, string> = {}): string {
  const code = requestErrorCode(error);
  if (code) {
    const message = overrides[code] ?? CONFLICT_MESSAGES[code];
    if (message) return message;
  }
  if (!(error instanceof HttpErrorResponse)) return FALLBACK_MESSAGE;
  return overrides[error.status] ?? STATUS_MESSAGES[error.status] ?? FALLBACK_MESSAGE;
}

/** Someone else reviewed it first: there's nothing left to decide. */
export function isAlreadyReviewed(error: unknown): boolean {
  const code = requestErrorCode(error);
  return code === 'CONCURRENT_UPDATE' || code === 'REQUEST_NOT_PENDING';
}
