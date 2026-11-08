import { HttpErrorResponse } from '@angular/common/http';
import { requestErrorMessage } from '../../core/utils/organizer-request-errors';

/** What the backend's refusals mean for a night, when the 400s below don't say more. */
const EVENT_ERRORS: Record<number, string> = {
  400: 'Controlla i dati della serata e riprova.',
  403: 'Non puoi modificare questa serata: non è della tua pagina, o il locale scelto non è tuo.',
  404: 'La serata, il locale o la città scelta non esiste più.',
};

/** The backend's own 400s on a night, by the `details` its handler writes. */
const DETAIL_ERRORS: Record<string, string> = {
  'Address not found':
    'Non troviamo questo indirizzo sulla mappa: scegli uno dei suggerimenti, o incolla le coordinate da «Il punto non è giusto?».',
  'Date range is invalid': 'La serata deve finire dopo l\'inizio.',
  'Venue does not belong to the selected city': 'Il locale scelto è in un\'altra città: controlla la città.',
};

/** The fields a refused validation names in `errors`, first match wins. */
const FIELD_ERRORS: Record<string, string> = {
  startAt: 'La serata deve iniziare più avanti di adesso.',
  endAt: 'La serata deve finire dopo l\'inizio.',
  price: 'Il prezzo non può essere negativo.',
};

/** A 400 told apart: by its handler's `details`, else by the first field its validation names. */
function badRequestMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  const body = error.error;
  const byDetail = typeof body?.details === 'string' ? DETAIL_ERRORS[body.details] : undefined;
  if (byDetail) return byDetail;
  const field = Object.keys(body?.errors ?? {}).find((name) => name in FIELD_ERRORS);
  return field ? FIELD_ERRORS[field] : null;
}

/** The backend's error on a night, in the user's words. */
export function eventErrorMessage(error: unknown): string {
  return badRequestMessage(error) ?? requestErrorMessage(error, EVENT_ERRORS);
}
