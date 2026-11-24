import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AddressSuggestion } from '../models/geocoding.model';
import { HomeCityDto } from '../models/user.model';

const PHOTON_API_URL = 'https://photon.komoot.io/api/';

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  state?: string;
  country?: string;
  /** ISO 3166-1 alpha-2, as Photon sends it ("IT"). */
  countrycode?: string;
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

  /** Towns only (Photon's city layer), in Italian: "Città dove vivi" in the profile. Never an address. */
  searchCities(query: string, limit = 5): Observable<HomeCityDto[]> {
    return this.http
      .get<PhotonResponse>(PHOTON_API_URL, { params: { q: query, limit, layer: 'city', lang: 'it' } })
      .pipe(map((response) => dedupeCities(response.features.map(toHomeCity).filter((city) => city !== null))));
  }
}

/** A town as the profile keeps it: its name, region and country code. null without a name or a
 * country, which the backend needs. */
function toHomeCity(feature: PhotonFeature): HomeCityDto | null {
  const { properties, geometry } = feature;
  const name = properties.name ?? properties.city;
  const country = properties.countrycode?.toUpperCase();
  if (!name || !country || !/^[A-Z]{2}$/.test(country)) return null;
  return {
    name,
    region: properties.state ?? null,
    country,
    latitude: geometry.coordinates[1],
    longitude: geometry.coordinates[0],
  };
}

/** "Milano, Lombardia" once, however many times Photon has it. */
function dedupeCities(cities: HomeCityDto[]): HomeCityDto[] {
  const seen = new Set<string>();
  return cities.filter((city) => {
    const key = `${city.name}|${city.region}|${city.country}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
