import { Service } from '@angular/core';

/**
 * The map's pan position and open pin, shared with the pages that send the
 * visitor to /mappa. MapPage itself survives navigating away
 * (KeepAliveReuseStrategy), so this is what an event's page writes to point
 * the map at that event (openOnMap) — read by MapPage when it's first built
 * and whenever it's reattached. In-memory only, on purpose: it doesn't need to
 * survive a page reload or become a shareable link.
 */
@Service()
export class MapViewStateService {
  center: [number, number] | null = null;
  zoom: number | null = null;
  selectedEventId: string | null = null;
}
