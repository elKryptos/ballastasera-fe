import { Component, booleanAttribute, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventCardDto } from '../../../core/models/event.model';
import { MyNightsKind } from '../../../core/services/user-activity.service';
import { addressPrimary, addressTown, formatClock, liveLabel } from '../../../core/utils/event-format';
import { EventPinIcon } from '../../../shared/event-filters/pin-icons';
import { EventPrice } from '../../../shared/event-price/event-price';

/** One night of "Le tue serate", as drawn on the canvas ("La tua scena"):
 * a small flyer, the time (or the LIVE badge), the title, where, the price and
 * who's going, and on the right the tab's own button, already on — the check
 * of Parteciperò, the heart of Mi piace — that takes the night out of the list.
 * Presentational only: MyNights owns the lists and the Annulla, and reacts to
 * removed. A night that's over is drawn without a fill and says "ci sono
 * andati"; a past Parteciperò has no button, there's nothing left to cancel. */
@Component({
  selector: 'app-my-night-card',
  imports: [RouterLink, EventPinIcon, EventPrice],
  templateUrl: './my-night-card.html',
  host: { class: 'block' },
})
export class MyNightCard {
  readonly event = input.required<EventCardDto>();
  readonly kind = input.required<MyNightsKind>();
  readonly past = input(false, { transform: booleanAttribute });
  /** Clock tick from MyNights — drives the LIVE badge. The app is zoneless,
   * so reading Date.now() in the template would never refresh on its own. */
  readonly now = input.required<number>();

  readonly removed = output<void>();

  /** "Live · dalle 22:30" while it's on, in place of the time. */
  protected readonly live = computed(() => (this.past() ? null : liveLabel(this.event(), this.now())));
  protected readonly start = computed(() => formatClock(this.event().startAt));

  /** One line: "Salsa Club · Pioltello", or the street when there's no venue. */
  protected readonly place = computed(() => {
    const event = this.event();
    const where = event.venueName ?? addressPrimary(event.address);
    const town = addressTown(event.address);
    return town ? `${where} · ${town}` : where;
  });

  protected readonly goingLabel = computed(() => {
    const count = this.event().goingCount;
    if (this.past()) return count === 1 ? 'c’è andato' : 'ci sono andati';
    return count === 1 ? 'ci va' : 'ci vanno';
  });

  protected readonly canRemove = computed(() => !(this.past() && this.kind() === 'going'));
  protected readonly removeLabel = computed(() =>
    this.kind() === 'going'
      ? `Non parteciperò più a ${this.event().title}`
      : `Togli il mi piace a ${this.event().title}`,
  );
}
