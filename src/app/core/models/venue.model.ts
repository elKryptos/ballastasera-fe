/** Mirrors VenueDetailDto in the backend. */
export interface VenueDetailDto {
  id: string;
  organizerId: string;
  organizerName: string;
  cityId: number;
  cityName: string;
  name: string;
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
  address: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
}
