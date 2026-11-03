import { OrganizerRejectReason } from '../models/organizer-request.model';
import { OrganizerType } from '../models/organizer.model';

/** How an organizer's type reads to its owner, from "Diventa organizzatore" on. */
export const ORGANIZER_TYPE_LABELS: Record<OrganizerType, string> = {
  PERSON: 'Insegnante, DJ o promoter',
  SCHOOL: 'Scuola di ballo',
  CLUB: 'Discoteca o club',
  VENUE: 'Locale o bar',
  ASSOCIATION: 'Associazione',
};

/** Why a request was turned down, in the words the admin picks and the user reads. */
export const REJECT_REASON_LABELS: Record<OrganizerRejectReason, string> = {
  INSTAGRAM_NOT_FOUND: 'Instagram non trovato',
  INCOMPLETE_DATA: 'Dati incompleti',
  NOT_DANCE_ORGANIZER: 'Non organizza serate di ballo',
  DUPLICATE: 'Doppione',
  OTHER: 'Altro',
};

/** Needs a venue of its own to be approved. Mirrors OrganizerType.requiresVenue() in the backend. */
export function requiresVenue(type: OrganizerType): boolean {
  return type === 'VENUE' || type === 'CLUB' || type === 'SCHOOL';
}

/** Publishes only in its own venues. Mirrors OrganizerType.isVenueBound() in the backend. */
export function isVenueBound(type: OrganizerType): boolean {
  return type === 'VENUE' || type === 'CLUB';
}
