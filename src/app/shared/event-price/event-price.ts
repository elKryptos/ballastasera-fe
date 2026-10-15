import { Component, computed, input } from '@angular/core';
import { Pricing, formatPrice, priceColor } from '../../core/utils/event-format';

/** An event's price, the same everywhere it's shown (the map's cards and its
 * list, /lista, the event's page): gold, or green when it's "Gratis", so a
 * free night stands out. Its size and weight are the caller's. */
@Component({
  selector: 'app-event-price',
  template: `{{ label() }}`,
  host: { class: 'shrink-0 tabular-nums', '[style.color]': 'color()' },
})
export class EventPrice {
  readonly event = input.required<Pricing>();
  protected readonly label = computed(() => formatPrice(this.event()));
  protected readonly color = computed(() => priceColor(this.event()));
}
