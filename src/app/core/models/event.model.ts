import { OrganizerDetailDto, OrganizerSummaryDto } from './organizer.model';
import { DanceStyleDto } from './dance-style.model';

/** Mirrors EventType in the backend. */
export type EventType = 'EVENT' | 'SCHOOL' | 'CLUB' | 'BAR';
export type FlyerStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';
/** Mirrors EventStatus in the backend. */
export type EventStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CANCELLED';

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
  likesCount: number;
}

export interface EventCreateDto {
  organizerId: string;
  venueId: string | null; // null si el usuario no eligió venue
  cityId: number;
  title: string;
  eventType: EventType;
  description: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  startAt: string; // OffsetDateTime con offset local del navegador
  endAt: string;
  free: boolean; // el backend solo deserializa "free"; "isFree" se ignora
  price: number | null; // null cuando free === true
  currency: string; // siempre 'EUR'
  address: string;
  latitude?: number; // coordenadas de la suggestion Photon seleccionada
  longitude?: number;
  danceStyleIds: number[];
  // flyerUrl e seriesId nunca se envían.
}

/** Payload dell'endpoint admin POST /rest/admin/events (flusso del collega, fuori
 * dallo scope di questa spec): conserva la forma storica con seriesId/flyerUrl/isFree
 * così il componente admin continua a compilare senza modifiche logiche. */
export interface AdminEventCreateDto {
  organizerId: string;
  venueId: string | null;
  seriesId: string | null;
  cityId: number;
  title: string;
  eventType: EventType;
  description: string | null;
  flyerUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  startAt: string;
  endAt: string;
  isFree: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  danceStyleIds: number[];
}

export interface EventDetailDto {
  id: string;
  slug: string;
  title: string;
  eventType: EventType;
  description: string | null;
  flyerUrl: string | null;
  flyerStatus: FlyerStatus | null;
  startAt: string;
  endAt: string;
  liveNow: boolean;
  free: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityName: string;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  // The detail endpoint nests the organizer's full profile (bio, website,
  // verified…), not just the map card's summary shape — see OrganizerDetailDto.
  organizer: OrganizerDetailDto;
  venueName: string | null;
  danceStyles: string[];
  likesCount: number;
  goingCount: number;
  interestedCount: number;
}

/** Detalle privado del organizador — espeja OrganizerEventDetailDto del backend
 * (GET /rest/events/{id}/manage): no incluye likesCount y danceStyles son objetos completos. */
export interface OrganizerEventDetailDto {
  id: string;
  slug: string;
  title: string;
  eventType: EventType;
  status: EventStatus;
  description: string | null;
  flyerUrl: string | null;
  flyerStatus: FlyerStatus | null;
  startAt: string; // ISO OffsetDateTime
  endAt: string;
  liveNow: boolean;
  free: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityId: number;
  venueId: string | null;
  seriesId: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  danceStyles: DanceStyleDto[]; // id, name y slug
  organizer: OrganizerDetailDto;
  venueName: string | null;
  cityName: string;
  goingCount: number;
  interestedCount: number;
}

export interface EventStatusUpdateDto {
  status: EventStatus;
}
