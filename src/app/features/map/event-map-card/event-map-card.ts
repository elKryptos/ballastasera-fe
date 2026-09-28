import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideClock,
  lucideHeart,
  lucideInstagram,
  lucideMapPin,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { EventCardDto } from '../../../core/models/event.model';
import {
  addressPrimary,
  addressSecondary,
  formatPrice,
  isLiveAt,
  minutesToStart,
} from '../../../core/utils/event-format';

/** Detail card docked over the map when a pin is tapped. Presentational
 * only: MapPage owns the selected event and the Parteciperò/Mi piace
 * state, and reacts to the outputs below. Its only navigation is the link
 * to the event's detail page. */
@Component({
  selector: 'app-event-map-card',
  imports: [RouterLink, NgIcon],
  templateUrl: './event-map-card.html',
  styleUrl: './event-map-card.css',
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideClock,
      lucideHeart,
      lucideInstagram,
      lucideMapPin,
      lucideUsers,
      lucideX,
    }),
  ],
})
export class EventMapCard {
  readonly event = input.required<EventCardDto>();
  /** Clock tick from MapPage — drives the LIVE badge and the countdown. The
  app is zoneless, so reading Date.now() in the template would never
  refresh on its own. */
  readonly now = input.required<number>();
  readonly going = input(false);
  readonly liked = input(false);

  readonly closed = output<void>();
  readonly goingToggled = output<void>();
  readonly likeToggled = output<void>();

  protected readonly live = computed(() => isLiveAt(this.event(), this.now()));
  protected readonly startsInMinutes = computed(() => minutesToStart(this.event(), this.now()));

  protected readonly startLabel = computed(() =>
    new Date(this.event().startAt).toLocaleString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );

  protected readonly priceLabel = computed(() => formatPrice(this.event()));
  protected readonly addressLine1 = computed(() => addressPrimary(this.event().address));
  protected readonly addressLine2 = computed(() => addressSecondary(this.event().address));

  /** Outline (inheriting the surrounding text colour) when not liked, filled
  with the theme's heart colour (--mc-heart, event-map-card.css) when liked
  — shared by the count badge and the "Mi piace" button so the two spots
  can't drift apart. lucideHeart's <svg> hardcodes fill="none" and ng-icon
  has no input for it, so the fill goes on the inner svg via an arbitrary
  variant. Same approach as heartIconClass in event-details.ts. */
  protected readonly heartIconClass = computed(() =>
    this.liked() ? 'text-(--mc-heart) [&_svg]:fill-current' : '',
  );
}
