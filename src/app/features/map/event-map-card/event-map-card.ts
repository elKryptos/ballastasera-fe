import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENT_TYPE_LABELS } from '../../../core/config/map-pins';
import { EventCardDto } from '../../../core/models/event.model';
import {
  addressPrimary,
  addressTown,
  eventBadge,
  formatClock,
  formatPrice,
  googleMapsUrl,
} from '../../../core/utils/event-format';
import { nightShortLabel } from '../../../core/utils/event-filters';
import { formatDistance } from '../../../core/utils/geo';
import { EventPinIcon } from '../../../shared/event-filters/pin-icons';
import { EventPlace } from '../../../shared/event-place/event-place';

/** The tapped pin's event, in the map's bottom sheet (MapSheet).
 * Presentational only: MapPage owns the selection and the Parteciperò/Mi
 * piace state, and reacts to the outputs below. Title and flyer lead to the
 * event's page; "Portami lì" opens Google Maps directions. */
@Component({
  selector: 'app-event-map-card',
  imports: [RouterLink, EventPinIcon, EventPlace],
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

  /** "Live · dalle 22:30", "Inizia tra 12 min", or "Stasera · 22:30". */
  protected readonly status = computed(() => {
    const event = this.event();
    const now = this.now();
    const badge = eventBadge(event, now);
    if (badge) return { tone: badge.live ? ('live' as const) : ('soon' as const), text: badge.text };
    return { tone: 'plain' as const, text: `${nightShortLabel(event, now)} · ${formatClock(event.startAt)}` };
  });

  /** "Discoteca · Via Roma 12", under the venue's name. */
  protected readonly placeLine = computed(() => {
    const event = this.event();
    return `${EVENT_TYPE_LABELS[event.eventType]} · ${addressPrimary(event.address)}`;
  });
  /** "Pioltello", after the street. */
  protected readonly town = computed(() => addressTown(this.event().address));
  /** "1,2 km", at the end of that line. */
  protected readonly distance = computed(() => {
    const km = this.distanceKm();
    return km === null ? null : formatDistance(km);
  });

  protected readonly priceLabel = computed(() => formatPrice(this.event()));
  protected readonly directionsUrl = computed(() => {
    const event = this.event();
    return googleMapsUrl(event.address, event.venueName);
  });
}
