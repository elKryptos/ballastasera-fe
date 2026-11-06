import { organizerOwnership } from './organizer-types';

describe('organizerOwnership', () => {
  it.each([
    [null, false, 'ADMIN_UNOWNED'],
    ['u1', true, 'CLAIMED'],
    ['u1', false, 'CREATED_BY_OWNER'],
  ] as const)('owner %s with claimed %s is %s', (ownerId, claimed, ownership) => {
    expect(organizerOwnership({ ownerId, claimed })).toBe(ownership);
  });

  // Can't happen (unclaim clears both), but no owner always reads as the admin's.
  it('reads a page without an owner as the admin\'s even if claimed is left on', () => {
    expect(organizerOwnership({ ownerId: null, claimed: true })).toBe('ADMIN_UNOWNED');
  });
});
