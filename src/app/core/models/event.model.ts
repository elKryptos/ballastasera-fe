import { OrganizerDetailDto } from './organizer.model';

/** Mirrors EventType in the backend. */
export type EventType = 'EVENT' | 'SCHOOL' | 'CLUB' | 'BAR';

/** Mirrors EventStatus in the backend. */
export type EventStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CANCELLED';

/** Mirrors FlyerStatus in the backend — async WebP conversion lifecycle. */
export type FlyerStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';

export interface OrganizerSummaryDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  verified: boolean;
}

/** Marker/card payload for the map — mirrors EventCardDto in the backend. */
export interface EventCardDto {
  id: string;
  slug: string;
  title: string;
  flyerUrl: string | null;
  eventType: EventType;
  startAt: string;
  endAt: string;
  liveNow: boolean;
  free: boolean;
  price: number | null;
  currency: string | null;
  latitude: number;
  longitude: number;
  address: string;
  organizer: OrganizerSummaryDto;
  venueName: string | null;
  danceStyles: string[];
  goingCount: number;
}

/** Full event payload — mirrors EventDetailDto in the backend. */
export interface EventDetailDto {
  id: string;
  slug: string;
  title: string;
  eventType: EventType;
  description: string | null;
  flyerUrl: string | null;
  flyerStatus: FlyerStatus;
  startAt: string;
  endAt: string;
  liveNow: boolean;
  // Il backend serializza "free", non "isFree".
  free: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityName: string;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  organizer: OrganizerDetailDto;
  venueName: string | null;
  danceStyles: string[];
  goingCount: number;
  interestedCount: number;
}

/** Body for POST /rest/events — venueId null se non è stato scelto un venue. */
export interface EventCreateDto {
  organizerId: string;
  venueId: string | null;
  cityId: number;
  title: string;
  eventType: EventType;
  description: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  // OffsetDateTime ISO con l'offset locale del browser.
  startAt: string;
  endAt: string;
  free: boolean;
  // null quando free è true.
  price: number | null;
  // Sempre 'EUR'.
  currency: string;
  address: string;
  danceStyleIds: number[];
}

/** Body for PATCH /rest/events/{id}/status. */
export interface EventStatusUpdateDto {
  status: EventStatus;
}
