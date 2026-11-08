import { HttpErrorResponse } from '@angular/common/http';
import { eventErrorMessage } from './event-management-errors';

function httpError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('eventErrorMessage', () => {
  it('tells an address the backend can\'t place from a date problem', () => {
    const message = eventErrorMessage(httpError(400, { details: 'Address not found' }));
    expect(message).toContain('Non troviamo questo indirizzo');
  });

  it('tells a venue of another city', () => {
    const message = eventErrorMessage(httpError(400, { details: 'Venue does not belong to the selected city' }));
    expect(message).toContain('in un\'altra città');
  });

  it('tells an end before the start, from its handler or from the validation', () => {
    expect(eventErrorMessage(httpError(400, { details: 'Date range is invalid' }))).toContain('finire dopo l\'inizio');
    expect(
      eventErrorMessage(httpError(400, { details: 'One or more fields are invalid', errors: { endAt: 'x' } })),
    ).toContain('finire dopo l\'inizio');
  });

  it('tells a start already gone', () => {
    const message = eventErrorMessage(
      httpError(400, { details: 'One or more fields are invalid', errors: { startAt: 'must be a future date' } }),
    );
    expect(message).toBe('La serata deve iniziare più avanti di adesso.');
  });

  it('falls back to a plain 400 when nothing is known', () => {
    expect(eventErrorMessage(httpError(400, { details: 'Something else' }))).toBe(
      'Controlla i dati della serata e riprova.',
    );
    expect(eventErrorMessage(httpError(400, null))).toBe('Controlla i dati della serata e riprova.');
  });

  it('keeps the other statuses as they were', () => {
    expect(eventErrorMessage(httpError(403, {}))).toContain('Non puoi modificare questa serata');
    expect(eventErrorMessage(httpError(404, {}))).toContain('non esiste più');
  });
});
