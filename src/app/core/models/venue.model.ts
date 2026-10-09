/** Mirrors VenueType in the backend: the place's own type, independent of any organizer. */
export type VenueType = 'SCHOOL' | 'CLUB' | 'BAR' | 'OTHER';

/** Mirrors VenueDetailDto in the backend. */
export interface VenueDetailDto {
  id: string;
  /** Null when the venue has no organizer profile of its own. */
  organizerId: string | null;
  organizerName: string | null;
  cityId: number;
  cityName: string;
  name: string;
  type: VenueType;
  address: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  website: string | null;
  whatsapp: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  /** Null until the admin uploads one (AdminService.uploadVenueLogo). */
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VenueCreateDto {
  organizerId: string | null;
  cityId: number;
  name: string;
  type: VenueType;
  address: string;
  /** Null when not known: the backend then geocodes the address itself. */
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  website: string | null;
  whatsapp: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
}

/** Mirrors VenueUpdateDto: a PATCH, so only what's sent changes. The city
 * and the organizer can't be changed — the backend ignores them. For the
 * contacts, "" clears the saved value (null leaves it as it is). */
export interface VenueUpdateDto {
  name: string;
  type: VenueType;
  address: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  website: string;
  whatsapp: string;
  email: string;
  facebook: string;
  instagram: string;
  youtube: string;
  tiktok: string;
}

export interface VenuesSummaryDto {
  id: string;
  name: string;
  type: VenueType;
  /** Null until the admin uploads one. */
  logoUrl: string | null;
  address: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

/** Venue pin on the map — mirrors VenueMapPinDto. The whole city comes at
 * once; filtering by type or visible area happens client-side. */
export interface VenueMapPinDto {
  id: string;
  name: string;
  type: VenueType;
  /** Null until the admin uploads one. */
  logoUrl: string | null;
  address: string;
  latitude: number;
  longitude: number;
}
