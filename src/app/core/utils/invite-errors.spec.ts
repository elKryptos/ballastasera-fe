import { HttpErrorResponse } from '@angular/common/http';
import { INVITE_PRIVATE_TEXT } from '../config/social';
import { NO_INVITES_LEFT_TEXT, inviteErrorMessage, inviteStatusFromError } from './invite-errors';

const refused = (status: number, code?: string) =>
  new HttpErrorResponse({ status, error: code ? { errors: { code } } : null });

describe('inviteErrorMessage', () => {
  it('says why the backend refused, by its code', () => {
    expect(inviteErrorMessage(refused(429, 'INVITE_LIMIT'))).toBe(NO_INVITES_LEFT_TEXT);
    expect(inviteErrorMessage(refused(400, 'PROFILE_PRIVATE'))).toBe(INVITE_PRIVATE_TEXT);
    expect(inviteErrorMessage(refused(400, 'NOT_GOING'))).toContain('Ci vado');
    expect(inviteErrorMessage(refused(500))).toContain('Riprova');
  });
});

describe('inviteStatusFromError', () => {
  it('turns a refusal about the friend into their row\'s status', () => {
    expect(inviteStatusFromError(refused(400, 'ALREADY_GOING'))).toBe('ALREADY_GOING');
    expect(inviteStatusFromError(refused(400, 'FRIEND_PRIVATE'))).toBe('PRIVATE');
    expect(inviteStatusFromError(refused(429, 'INVITE_LIMIT'))).toBeNull();
  });
});
