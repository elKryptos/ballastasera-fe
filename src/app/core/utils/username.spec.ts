import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { normalizeUsername, usernameErrorMessage, usernameFormat, usernameFromInstagram, usernameIssue } from './username';

describe('normalizeUsername', () => {
  it('keeps it the way the backend does: no @, no spaces, lower case', () => {
    expect(normalizeUsername(' @Ana Baila ')).toBe('anabaila');
  });
});

describe('usernameIssue', () => {
  it('follows the backend\'s rules', () => {
    expect(usernameIssue('')).toBeNull();
    expect(usernameIssue('ana.baila_92')).toBeNull();
    expect(usernameIssue('ana-baila')).toBe('chars');
    expect(usernameIssue('an')).toBe('short');
    expect(usernameIssue('.ana')).toBe('dots');
    expect(usernameIssue('ana.')).toBe('dots');
    expect(usernameIssue('ana..baila')).toBe('dots');
    expect(usernameIssue('admin')).toBe('reserved');
  });

  it('is the form\'s check too, on what was typed', () => {
    expect(usernameFormat(new FormControl('@Ana-Baila', { nonNullable: true }))).toEqual({ username: 'chars' });
    expect(usernameFormat(new FormControl('@Ana.Baila', { nonNullable: true }))).toBeNull();
  });
});

describe('usernameFromInstagram', () => {
  it('suggests the Instagram handle only when it would be a valid username', () => {
    expect(usernameFromInstagram('@Kryptos')).toBe('kryptos');
    expect(usernameFromInstagram('salsa..club')).toBeNull();
    expect(usernameFromInstagram(null)).toBeNull();
  });
});

describe('usernameErrorMessage', () => {
  it('reads the backend\'s 409s on the username, and leaves anything else alone', () => {
    const conflict = (code: string) => new HttpErrorResponse({ status: 409, error: { errors: { code } } });
    expect(usernameErrorMessage(conflict('USERNAME_TAKEN'))).toContain('preso');
    expect(usernameErrorMessage(conflict('USERNAME_RESERVED'))).toContain('riservato');
    expect(usernameErrorMessage(new HttpErrorResponse({ status: 400, error: { errors: { instagram: 'x' } } }))).toBeNull();
  });
});
