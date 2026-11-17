import { isValidWhatsapp, normalizeWhatsapp } from './whatsapp';

describe('normalizeWhatsapp', () => {
  it.each([
    ['333 123 4567', '+393331234567'],
    ['+39 333-123.4567', '+393331234567'],
    ['0039 333 123 4567', '+393331234567'],
    ['(+34) 612 345 678', '+34612345678'],
    ['+393331234567', '+393331234567'],
  ])('%s is saved as %s', (typed, saved) => {
    expect(normalizeWhatsapp(typed)).toBe(saved);
  });

  it.each(['', '   ', null, undefined])('leaves %s empty', (typed) => {
    expect(normalizeWhatsapp(typed)).toBe('');
  });
});

describe('isValidWhatsapp', () => {
  it.each(['333 123 4567', '+44 7911 123456'])('takes %s', (typed) => {
    expect(isValidWhatsapp(typed)).toBe(true);
  });

  it.each(['12 34', '+39 333 123 4567 8901 23', '333 abc 4567', '+0 333 123 4567'])('refuses %s', (typed) => {
    expect(isValidWhatsapp(typed)).toBe(false);
  });
});
