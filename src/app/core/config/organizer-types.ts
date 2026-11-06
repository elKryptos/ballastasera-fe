import { OrganizerRejectReason } from '../models/organizer-request.model';
import { OrganizerType } from '../models/organizer.model';

/** How an organizer's type reads to its owner, from "Diventa organizzatore" on. */
export const ORGANIZER_TYPE_LABELS: Record<OrganizerType, string> = {
  PERSON: 'Insegnante, DJ o promoter',
  SCHOOL: 'Scuola di ballo o ASD',
  CLUB: 'Discoteca o club',
  VENUE: 'Locale o bar',
};

/** The types in the order the forms show them: the keys of the labels, so the Record keeps it complete. */
export const ORGANIZER_TYPES = Object.keys(ORGANIZER_TYPE_LABELS) as OrganizerType[];

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

/** Who a page belongs to and how it got there. Mirrors Organizers.claimed in the backend (D15):
 * - ADMIN_UNOWNED: the admin created it and nobody has claimed it.
 * - CLAIMED: the admin created it and a user claimed it. The admin can take it back (unclaim).
 * - CREATED_BY_OWNER: its owner created it with a request. It can only be deleted. */
export type OrganizerOwnership = 'ADMIN_UNOWNED' | 'CLAIMED' | 'CREATED_BY_OWNER';

export function organizerOwnership(organizer: { ownerId: string | null; claimed: boolean }): OrganizerOwnership {
  if (!organizer.ownerId) return 'ADMIN_UNOWNED';
  return organizer.claimed ? 'CLAIMED' : 'CREATED_BY_OWNER';
}
