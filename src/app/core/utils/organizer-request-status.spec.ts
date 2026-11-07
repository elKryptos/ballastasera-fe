import { OrganizerRequestDto } from '../models/organizer-request.model';
import { REQUEST_URL, requestStatusOf } from './organizer-request-status';

const request = (fields: Partial<OrganizerRequestDto>) =>
  ({ id: 'r1', organizerName: 'Salsa Loca Milano', submittedAt: new Date().toISOString(), ...fields }) as OrganizerRequestDto;

describe('requestStatusOf', () => {
  it('has nothing to tell without a request, or about one approved or cancelled', () => {
    expect(requestStatusOf(null)).toBeNull();
    expect(requestStatusOf(request({ status: 'APPROVED' }))).toBeNull();
    expect(requestStatusOf(request({ status: 'CANCELLED' }))).toBeNull();
  });

  it('shows a request in review, two steps of three done', () => {
    const status = requestStatusOf(request({ status: 'PENDING' }));
    expect(status?.tone).toBe('pending');
    expect(status?.progress).toEqual([true, true, false]);
    expect(status?.action).toEqual({ label: 'Vedi la richiesta', url: `${REQUEST_URL}/richiesta-inviata`, primary: false });
  });

  it('says why one was turned down, and offers to send it again from it', () => {
    const status = requestStatusOf(
      request({ status: 'REJECTED', rejectionReason: 'INSTAGRAM_NOT_FOUND', rejectionMessage: 'Scrivici da lì.' }),
    );
    expect(status?.tone).toBe('rejected');
    expect(status?.reason).toBe('Instagram non trovato');
    expect(status?.reasonMessage).toBe('Scrivici da lì.');
    expect(status?.action.queryParams).toEqual({ da: 'r1' });
    expect(status?.action.primary).toBe(true);
  });
});
