import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VENUE_TYPE_LABELS } from '../../../core/config/map-pins';
import { VenueMapPinDto } from '../../../core/models/venue.model';
import { addressPrimary, addressSecondary, googleMapsUrl, withoutCountry } from '../../../core/utils/event-format';
import { formatDistance } from '../../../core/utils/geo';
import { VenuePinIcon } from '../../../shared/event-filters/pin-icons';

/** The tapped venue badge's place, in the map's bottom sheet (MapSheet) —
 * the venue counterpart of EventMapCard. Presentational only: MapPage owns
 * the selection. Its page (/luogo/:id) is reached from here, never straight
 * from the badge, so a stray tap on the map doesn't leave it. */
@Component({
  selector: 'app-venue-map-card',
  imports: [RouterLink, VenuePinIcon],
  templateUrl: './venue-map-card.html',
})
export class VenueMapCard {
  readonly venue = input.required<VenueMapPinDto>();
  /** From the visitor's position, once "Intorno a me" found it. */
  readonly distanceKm = input<number | null>(null);
  /** Off (feature flag), there's no page to link to. */
  readonly detailsEnabled = input(false);

  readonly closed = output<void>();

  /** "Scuola · 1,2 km". */
  protected readonly typeLine = computed(() => {
    const parts = [VENUE_TYPE_LABELS[this.venue().type]];
    const km = this.distanceKm();
    if (km !== null) parts.push(formatDistance(km));
    return parts.join(' · ');
  });

  /** "Via Roma 12, 20121 Milano". */
  protected readonly addressLine = computed(() => {
    const address = withoutCountry(this.venue().address);
    return [addressPrimary(address), addressSecondary(address)].filter(Boolean).join(', ');
  });

  protected readonly directionsUrl = computed(() => {
    const venue = this.venue();
    return googleMapsUrl(venue.address, venue.name);
  });
}
