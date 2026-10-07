import { MILAN_CENTER } from '../config/map-pins';
import { CityDto } from '../models/city.model';
import type { MapBounds } from '../services/events.service';

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = (Math.PI * EARTH_RADIUS_KM) / 180;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Straight-line (haversine) distance — what "1,2 km" on a card means. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** "850 m", "1,2 km", "14 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

export function boundsCenter(bounds: MapBounds): GeoPoint {
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
}

export function pointInBounds(bounds: MapBounds, lat: number, lng: number): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

/** Whether `inner` lies within `outer`, letting up to `tolerance` (a share of
 * inner's own width/height) stick out on each side — so the small pan that
 * centres a tapped pin doesn't count as leaving the searched area. */
export function boundsContain(outer: MapBounds, inner: MapBounds, tolerance = 0): boolean {
  const latSlack = (inner.maxLat - inner.minLat) * tolerance;
  const lngSlack = (inner.maxLng - inner.minLng) * tolerance;
  return (
    inner.minLat >= outer.minLat - latSlack &&
    inner.maxLat <= outer.maxLat + latSlack &&
    inner.minLng >= outer.minLng - lngSlack &&
    inner.maxLng <= outer.maxLng + lngSlack
  );
}

/** The smallest box holding both. */
export function boundsUnion(a: MapBounds, b: MapBounds): MapBounds {
  return {
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
    minLng: Math.min(a.minLng, b.minLng),
    maxLng: Math.max(a.maxLng, b.maxLng),
  };
}

export function boundsEqual(a: MapBounds, b: MapBounds): boolean {
  return a.minLat === b.minLat && a.maxLat === b.maxLat && a.minLng === b.minLng && a.maxLng === b.maxLng;
}

/** The active city closest to `point`, if one is within `maxKm` — a map
 * looking at the countryside belongs to no city. */
export function nearestCity(cities: CityDto[], point: GeoPoint, maxKm = 40): CityDto | null {
  let best: CityDto | null = null;
  let bestKm = maxKm;
  for (const city of cities) {
    const km = distanceKm(point, { lat: city.latitude, lng: city.longitude });
    if (km <= bestKm) {
      best = city;
      bestKm = km;
    }
  }
  return best;
}

/** The city a list opens on (/lista, /scuole): the one the map was last
 * looking at, else the visitor's, else Milano. */
export function startingCity(
  cities: CityDto[],
  mapCenter: [number, number] | null,
  position: GeoPoint | null,
): CityDto {
  const from = mapCenter ? { lat: mapCenter[0], lng: mapCenter[1] } : (position ?? { lat: MILAN_CENTER[0], lng: MILAN_CENTER[1] });
  return nearestCity(cities, from, Infinity) ?? cities[0];
}

/** How far a city's events reach: its province too. Nights out in the
 * hinterland (Brianza, 20+ km from Milano's centre) belong to the city. */
const CITY_AREA_KM = 50;

/** Box reaching CITY_AREA_KM from a city's centre each way — what /lista and
 * the menu ask the backend for. /lista adds the city's id on top, so another
 * city inside the box stays out. A tighter box (it was ~12 km) silently left
 * the hinterland's nights out of "in tutta Milano". */
export function cityBounds(city: Pick<CityDto, 'latitude' | 'longitude'>): MapBounds {
  const dLat = CITY_AREA_KM / KM_PER_DEGREE;
  // A degree of longitude shrinks with the latitude.
  const dLng = CITY_AREA_KM / (KM_PER_DEGREE * Math.cos(toRad(city.latitude)));
  return {
    minLat: city.latitude - dLat,
    maxLat: city.latitude + dLat,
    minLng: city.longitude - dLng,
    maxLng: city.longitude + dLng,
  };
}
