import { OrganizerDetailDto, OrganizerSummaryDto } from "./organizer.model";

/** Mirrors EventType in the backend. */
export type EventType = 'EVENT' | 'SCHOOL' | 'CLUB' | 'BAR';
export type FlyerStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';
/** Mirrors java.time.DayOfWeek, used by EventSeries recurrence. */
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** Marker/card payload for the map — mirrors EventCardDto in the backend. */
export interface EventCardDto {
  id: string;
  /** Non-null when this occurrence was generated from an EventSeries. */
  seriesId: string | null;
  slug: string;
  title: string;
  flyerUrl: string | null;
  eventType: EventType;
  startAt: string;
  endAt: string;
  liveNow: boolean;
  isFree: boolean;
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
  venueId: string | null;
  seriesId: string | null;
  cityId: number;
  title: string;
  eventType: EventType;
  description: string | null;
  flyerUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  startAt: string; //ISO OffDateTime
  endAt: string; //ISO OffDateTime
  isFree: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  danceStyleIds: number[];
}

export interface EventDetailDto {
  id: string;
  /** Non-null when this occurrence was generated from an EventSeries. */
  seriesId: string | null;
  slug: string;
  title: string;
  eventType: EventType;
  description: string | null;
  flyerUrl: string | null;
  flyerStatus: FlyerStatus | null;
  startAt: string;
  endAt: string;
  liveNow: boolean;
  isFree: boolean;
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

export interface EventSeriesCreateDto {
  organizerId: string;
  venueId: string | null;
  cityId: number;
  title: string;
  recurrenceDays: DayOfWeek[];
  description: string | null;
  flyerUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  isFree: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  startTime: string;        // "HH:mm[:ss]" (LocalTime)
  endTime: string | null;
  danceStyleIds: number[];
}

export interface EventSeriesDetailDto {
  id: string;
  title: string;
  recurrenceDays: DayOfWeek[];
  active: boolean;
  /** Last date through which occurrences have already been generated in `events`. */
  generatedUntil: string | null;
  description: string | null;
  flyerUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  startTime: string;
  endTime: string | null;
  isFree: boolean;
  price: number | null;
  currency: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cityName: string;
  venueName: string | null;
  organizer: OrganizerDetailDto;
  danceStyles: string[];
}

/** Body for POST /event-series/{id}/occurrences — generates concrete Events
 * for every recurrenceDays match within [startDate, endDate]. */
export interface EventSeriesGenerateOccurrencesDto {
  startDate: string; // "yyyy-MM-dd" (LocalDate)
  endDate: string;   // "yyyy-MM-dd" (LocalDate)
}
