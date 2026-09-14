/** Mirrors VenuesSummaryDto in the backend — result of GET /rest/venues?cityId={id}. */
export interface VenuesSummaryDto {
  id: string;
  name: string;
  address: string;
  cityName: string;
  latitude: number;
  longitude: number;
}
