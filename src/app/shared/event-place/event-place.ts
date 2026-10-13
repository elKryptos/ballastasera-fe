import { Component, input } from '@angular/core';

/** Where a night is, on its cards (/lista's, the map's list and its open
 * card): the venue's name on a line of its own, in the "where" colour
 * (--ev-place), and the street under it. That line can end in something that
 * never gives way — the price, the distance: the street is cut short instead.
 * Spans only, so it fits inside a button too. */
@Component({
  selector: 'app-event-place',
  template: `
    @if (venue(); as venue) {
    <span class="block truncate font-bold text-(--ev-place)">{{ venue }}</span>
    }
    <span class="flex gap-1.5 text-(--ev-soft)">
      <span class="truncate">{{ address() }}</span>
      @if (trailing(); as trailing) {
      <span class="shrink-0">· {{ trailing }}</span>
      }
    </span>
  `,
  host: { class: 'block min-w-0 text-[0.8125rem]' },
})
export class EventPlace {
  readonly venue = input<string | null>(null);
  /** The street, already formatted (addressPrimary). */
  readonly address = input.required<string>();
  readonly trailing = input<string | null>(null);
}
