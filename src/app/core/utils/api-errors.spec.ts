import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorCode, apiErrorMessage, apiErrorStatus } from './api-errors';

function failed(status: number, code?: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: code ? { errors: { code } } : null });
}

describe('apiErrorCode', () => {
  it('reads the code the backend put in errors.code', () => {
    expect(apiErrorCode(failed(429, 'RATE_LIMITED'))).toBe('RATE_LIMITED');
  });

  it('is null without one, or for anything that isn\'t an HTTP error', () => {
    expect(apiErrorCode(failed(404))).toBeNull();
    expect(apiErrorCode(new HttpErrorResponse({ status: 400, error: { errors: { code: 3 } } }))).toBeNull();
    expect(apiErrorCode(new Error('boom'))).toBeNull();
  });
});

describe('apiErrorStatus', () => {
  it('is null when the request never got an answer', () => {
    expect(apiErrorStatus(failed(0))).toBeNull();
    expect(apiErrorStatus(failed(409))).toBe(409);
  });
});

describe('apiErrorMessage', () => {
  const messages = { NOT_FRIENDS: 'Non siete amici.', 404: 'Non esiste più.' };

  it('picks the code over the status, then the status, then the fallback', () => {
    expect(apiErrorMessage(failed(400, 'NOT_FRIENDS'), messages)).toBe('Non siete amici.');
    expect(apiErrorMessage(failed(404), messages)).toBe('Non esiste più.');
    expect(apiErrorMessage(failed(500), messages, 'Riprova.')).toBe('Riprova.');
  });
});
