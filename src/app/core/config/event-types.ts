import { EventType } from '../models/event.model';
import { VenueType } from '../models/venue.model';

/** A night's kind as the nights' management asks for it and sums it up (the canvas's SerataNuova),
 * in the order the form shows it. RESTAURANT last: it isn't on the canvas, but older nights have it.
 * The map's legend has its own, shorter words (EVENT_TYPE_LABELS in map-pins.ts). */
export const EVENT_TYPE_CHOICES: { value: EventType; label: string }[] = [
  { value: 'EVENT', label: 'Serata / social' },
  { value: 'SCHOOL', label: 'Lezione o stage' },
  { value: 'CLUB', label: 'Club' },
  { value: 'BAR', label: 'Bar' },
  { value: 'RESTAURANT', label: 'Ristorante' },
];

/** The night's kind a venue suggests when it's picked. A venue has no EVENT (a social), but a
 * generic place (OTHER: a hall, a theatre, a square) most often holds one. */
export const EVENT_TYPE_OF_VENUE: Record<VenueType, EventType> = {
  CLUB: 'CLUB',
  BAR: 'BAR',
  RESTAURANT: 'RESTAURANT',
  SCHOOL: 'SCHOOL',
  OTHER: 'EVENT',
};
