import { HttpErrorResponse } from '@angular/common/http';
import { profileErrorMessage } from './profile-errors';

function badRequest(errors: Record<string, string>): HttpErrorResponse {
  return new HttpErrorResponse({ status: 400, error: { errors } });
}

describe('profileErrorMessage', () => {
  it('reads a field the backend refused in the user\'s words', () => {
    expect(profileErrorMessage(badRequest({ whatsapp: 'whatsapp must be in E.164 format' }))).toBe(
      'Il numero di WhatsApp non è valido.',
    );
    expect(profileErrorMessage(badRequest({ birthDateValid: 'age must be between 16 and 100' }))).toBe(
      'Per il profilo devi avere tra 16 e 100 anni.',
    );
  });

  it('finds a dance style\'s field whatever its index', () => {
    expect(profileErrorMessage(badRequest({ 'danceStyles[3].level': 'must not be null' }))).toBe(
      'Scegli il tuo livello per ogni stile.',
    );
  });

  it('falls back to a general message for a field it doesn\'t know', () => {
    expect(profileErrorMessage(badRequest({ somethingNew: 'invalid' }))).toBe('Controlla i dati inseriti e riprova.');
  });

  it('tells a style that no longer exists (404) from any other failure', () => {
    expect(profileErrorMessage(new HttpErrorResponse({ status: 404 }))).toContain('non esiste più');
    expect(profileErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe(
      'Non siamo riusciti a salvare. Riprova tra poco.',
    );
    expect(profileErrorMessage(new Error('offline'))).toBe('Non siamo riusciti a salvare. Riprova tra poco.');
  });
});
