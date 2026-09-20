import { Service } from '@angular/core';

/**
 * Remembers the map's last pan position and open pin across navigations away
 * from /mappa (e.g. to /evento/:id and back). MapPage is destroyed and
 * rebuilt on every route change — its Leaflet instance included — so without
 * this it always reopens at DEFAULT_CENTER/DEFAULT_ZOOM with no pin selected.
 * In-memory only, on purpose: it doesn't need to survive a page reload or
 * become a shareable link, just outlive one round trip through another route.
 */
@Service()
export class MapViewStateService {
  center: [number, number] | null = null;
  zoom: number | null = null;
  selectedEventId: string | null = null;
}
