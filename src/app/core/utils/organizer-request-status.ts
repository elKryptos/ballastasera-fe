import { REJECT_REASON_LABELS } from '../config/organizer-types';
import { OrganizerRequestDto } from '../models/organizer-request.model';
import { requestDayLabel } from './request-dates';

/** Where "Diventa organizzatore" starts. Its steps' paths are the wizard's (requestStepUrl in the
 * request's form store); the two the status links to are written out below. */
export const REQUEST_URL = '/diventa-organizzatore';

/** What to tell a user about a request that's in review or was turned down: the menu's
 * "Organizza" card and the account page say the same thing, each in its own look. */
export interface RequestStatus {
  tone: 'pending' | 'rejected';
  title: string;
  text: string;
  /** Why it was turned down. */
  reason?: string;
  reasonMessage?: string | null;
  action: { label: string; url: string; queryParams?: Record<string, string>; primary: boolean };
  /** The three steps of the request, how many are done: in review only. */
  progress?: boolean[];
}

/** Null when there's nothing to tell: no request, or one that's approved or cancelled. */
export function requestStatusOf(request: OrganizerRequestDto | null): RequestStatus | null {
  if (request?.status === 'PENDING') {
    return {
      tone: 'pending',
      title: 'Richiesta in revisione',
      text: `${request.organizerName} · inviata ${requestDayLabel(request.submittedAt)}. Ti avvisiamo appena è approvata.`,
      progress: [true, true, false],
      action: { label: 'Vedi la richiesta', url: `${REQUEST_URL}/richiesta-inviata`, primary: false },
    };
  }
  if (request?.status === 'REJECTED') {
    return {
      tone: 'rejected',
      title: 'Richiesta non approvata',
      text: request.organizerName,
      reason: request.rejectionReason ? REJECT_REASON_LABELS[request.rejectionReason] : undefined,
      reasonMessage: request.rejectionMessage,
      action: { label: 'Modifica e reinvia', url: `${REQUEST_URL}/chi-sei`, queryParams: { da: request.id }, primary: true },
    };
  }
  return null;
}
