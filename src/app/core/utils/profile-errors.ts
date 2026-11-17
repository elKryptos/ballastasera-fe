import { HttpErrorResponse } from '@angular/common/http';

/** The backend's 400 on PATCH /auth/me names each wrong field in errors, with a message in
 * English for developers: these are the same in the user's words. A dance style's own
 * fields come indexed ("danceStyles[2].level"), hence the index stripped before looking up. */
const FIELD_MESSAGES: Record<string, string> = {
  instagram: 'Il nome del profilo Instagram non è valido.',
  whatsapp: 'Il numero di WhatsApp non è valido.',
  birthDate: 'La data di nascita non è valida.',
  birthDateValid: 'Per il profilo devi avere tra 16 e 100 anni.',
  danceStyles: 'Puoi scegliere al massimo 10 stili.',
  'danceStyles[].level': 'Scegli il tuo livello per ogni stile.',
  'danceStyles[].danceStyleId': 'Uno degli stili scelti non è valido.',
};

const NOT_FOUND_MESSAGE = 'Uno degli stili scelti non esiste più. Ricarica la pagina e riprova.';
const FALLBACK_MESSAGE = 'Non siamo riusciti a salvare. Riprova tra poco.';

/** "danceStyles[2].level" → "danceStyles[].level". */
function fieldKey(field: string): string {
  return field.replace(/\[\d+\]/g, '[]');
}

/** What to tell the user when saving the profile fails. The form checks the same rules
 * first, so a 400 here means the two disagree: the first field the backend names wins. */
export function profileErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return FALLBACK_MESSAGE;
  if (error.status === 404) return NOT_FOUND_MESSAGE;
  if (error.status !== 400) return FALLBACK_MESSAGE;
  const fields = Object.keys(error.error?.errors ?? {});
  for (const field of fields) {
    const message = FIELD_MESSAGES[fieldKey(field)];
    if (message) return message;
  }
  return 'Controlla i dati inseriti e riprova.';
}
