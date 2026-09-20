import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AddressSuggestion } from '../models/geocoding.model';

const PHOTON_API_URL = 'https://photon.komoot.io/api/';

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

@Service()
export class GeocodingService {
  private readonly http = inject(HttpClient);

  searchAddress(query: string, limit = 5): Observable<AddressSuggestion[]> {
    return this.http
      .get<PhotonResponse>(PHOTON_API_URL, { params: { q: query, limit } })
      .pipe(map((response) => dedupeByLabel(response.features.map(toAddressSuggestion))));
  }
}

function toAddressSuggestion(feature: PhotonFeature): AddressSuggestion {
  const { properties, geometry } = feature;
  const streetLine = [properties.street, properties.housenumber].filter(Boolean).join(' ') || properties.name;
  const label = [streetLine, properties.postcode, properties.city, properties.state, properties.country]
    .filter(Boolean)
    .join(', ');

  return {
    label,
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
  };
}

/** Photon can return near-duplicate results (same street/city, no house number); collapsing them
 *  avoids duplicate labels in the dropdown, which would otherwise make it impossible to tell which
 *  of two identical-looking rows resolves to which coordinates. */
function dedupeByLabel(suggestions: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    if (!suggestion.label || seen.has(suggestion.label)) {
      return false;
    }
    seen.add(suggestion.label);
    return true;
  });
}
