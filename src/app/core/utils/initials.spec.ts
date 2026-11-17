import { firstNameOf, initialOf } from './initials';

describe('initials', () => {
  it.each([
    ['Sara M.', 'S', 'Sara'],
    ['  luca   rossi ', 'L', 'luca'],
    ['', '', ''],
    [null, '', ''],
  ])('%j: initial %j, first name %j', (name, initial, firstName) => {
    expect(initialOf(name)).toBe(initial);
    expect(firstNameOf(name)).toBe(firstName);
  });
});
