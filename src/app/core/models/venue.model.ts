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
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VenuesSummaryDto {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
}

/** Venue pin on the map — mirrors VenueMapPinDto. The whole city comes at
 * once; filtering by type or visible area happens client-side. */
export interface VenueMapPinDto {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  latitude: number;
  longitude: number;
}
