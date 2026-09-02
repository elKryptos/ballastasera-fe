/** Mirrors EventType in the backend. */
export type EventType = 'EVENT' | 'SCHOOL' | 'CLUB' | 'BAR';

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
