import { FormControl } from '@angular/forms';
import { birthDateAllowed, optionalWhatsapp, shiftYears } from './form-validators';

describe('optionalWhatsapp', () => {
  it.each(['', '  ', '333 123 4567', '+39 333 123 4567'])('takes %j', (value) => {
    expect(optionalWhatsapp(new FormControl(value, { nonNullable: true }))).toBeNull();
  });

  it('refuses a number too short', () => {
    expect(optionalWhatsapp(new FormControl('12 34', { nonNullable: true }))).toEqual({ whatsapp: true });
  });
});

describe('birth date', () => {
  const today = new Date(2026, 10, 17);

  it('shifts years the way java.time does on 29 February', () => {
    expect(shiftYears(new Date(2028, 1, 29), -16)).toBe('2012-02-29');
    expect(shiftYears(new Date(2028, 1, 29), -1)).toBe('2027-02-28');
  });

  it.each([
    ['', true],
    ['2010-11-17', true], // 16 today
    ['2010-11-18', false], // 16 tomorrow
    ['1926-11-18', true], // 99, 100 tomorrow
    ['1926-11-17', false], // 100 today
    ['2030-01-01', false], // not born yet
  ])('%s is allowed: %s', (value, allowed) => {
    expect(birthDateAllowed(value, today)).toBe(allowed);
  });
});
