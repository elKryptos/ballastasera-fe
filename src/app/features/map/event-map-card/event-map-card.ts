import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENT_TYPE_LABELS } from '../../../core/config/map-pins';
import { EventCardDto } from '../../../core/models/event.model';
import {
  addressPrimary,
  formatClock,
  formatPrice,
  formatTimeRange,
  googleMapsUrl,
  minutesToEnd,
  minutesToStart,
  withoutCountry,
} from '../../../core/utils/event-format';
import { nightShortLabel } from '../../../core/utils/event-filters';
import { formatDistance } from '../../../core/utils/geo';
import { EventPinIcon } from '../../../shared/event-filters/pin-icons';

/** Past this, "Finisce tra 3 h 20 min" says less than "Fino alle 03:00". */
const ENDING_SOON_MINUTES = 90;

/** The tapped pin's event, in the map's bottom sheet (MapSheet).
 * Presentational only: MapPage owns the selection and the Parteciperò/Mi
 * piace state, and reacts to the outputs below. Title and flyer lead to the
 * event's page; "Portami lì" opens Google Maps directions. */
@Component({
  selector: 'app-event-map-card',
  imports: [RouterLink, EventPinIcon],
  templateUrl: './event-map-card.html',
})
export class EventMapCard {
  readonly event = input.required<EventCardDto>();
  /** Clock tick from MapPage — drives the LIVE badge and the countdowns. The
  app is zoneless, so reading Date.now() in the template would never
  refresh on its own. */
  readonly now = input.required<number>();
  readonly going = input(false);
  readonly liked = input(false);
  /** From the visitor's position, once "Intorno a me" found it. */
  readonly distanceKm = input<number | null>(null);

  readonly closed = output<void>();
  readonly goingToggled = output<void>();
  readonly likeToggled = output<void>();

  /** "Live · finisce tra 52 min", "Inizia tra 12 min", or "Stasera · 22:30 – 03:00". */
  protected readonly status = computed(() => {
    const event = this.event();
    const now = this.now();
    const left = minutesToEnd(event, now);
    if (left !== null) {
      const tail = left <= ENDING_SOON_MINUTES ? `finisce tra ${left} min` : `fino alle ${formatClock(event.endAt)}`;
      return { tone: 'live' as const, text: `Live · ${tail}` };
    }
    const toStart = minutesToStart(event, now);
    if (toStart !== null) return { tone: 'soon' as const, text: `Inizia tra ${toStart} min` };
    return { tone: 'plain' as const, text: `${nightShortLabel(event, now)} · ${formatTimeRange(event)}` };
  });

  /** "Discoteca · Nome locale · 1,2 km" — or the street when there's no venue. */
  protected readonly placeLine = computed(() => {
    const event = this.event();
    const parts = [EVENT_TYPE_LABELS[event.eventType], event.venueName ?? addressPrimary(withoutCountry(event.address))];
    const km = this.distanceKm();
    if (km !== null) parts.push(formatDistance(km));
    return parts.join(' · ');
  });

  protected readonly priceLabel = computed(() => formatPrice(this.event()));
  protected readonly directionsUrl = computed(() => {
    const event = this.event();
    return googleMapsUrl(event.address, event.venueName);
  });
}
