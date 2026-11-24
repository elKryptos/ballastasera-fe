import { UrlSegment } from '@angular/router';
import { usernameMatcher } from './username-matcher';

const path = (...parts: string[]) => parts.map((part) => new UrlSegment(part, {}));

describe('usernameMatcher', () => {
  it('takes /@name, lower case', () => {
    expect(usernameMatcher(path('@Ana.Baila'))?.posParams?.['username'].path).toBe('ana.baila');
  });

  it('leaves alone anything else', () => {
    expect(usernameMatcher(path('persona'))).toBeNull();
    expect(usernameMatcher(path('@ab'))).toBeNull();
    expect(usernameMatcher(path('@ana', 'serate'))).toBeNull();
    expect(usernameMatcher(path('@ana bai'))).toBeNull();
  });
});
