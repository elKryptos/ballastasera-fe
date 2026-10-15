import { Component, booleanAttribute, input } from '@angular/core';

/** Where a night is, on its cards (/lista's, the map's list and its open
 * card): the venue's name on a line of its own, in the "where" colour
 * (--ev-place), the street under it and its town under that, on a line of
 * its own so it never takes the street's room — or, with townBeside, after
 * the street from md up, where there's room for both. The street's line can
 * end in something that never gives way — the town, the price, the distance:
 * the street is cut short instead. Spans only, so it fits inside a button. */
@Component({
  selector: 'app-event-place',
  template: `
    @if (venue(); as venue) {
    <span class="block truncate font-bold text-(--ev-place)">{{ venue }}</span>
    }
    <span class="flex gap-1.5">
      <span class="truncate">{{ address() }}</span>
      @if (townBeside() && town()) {
      <span class="hidden shrink-0 md:inline">· {{ town() }}</span>
      }
      @if (trailing(); as trailing) {
      <span class="shrink-0">· {{ trailing }}</span>
      }
    </span>
    @if (town(); as town) {
    <span [class]="townBeside() ? 'block truncate md:hidden' : 'block truncate'">{{ town }}</span>
    }
  `,
  host: { class: 'block min-w-0 text-[0.8125rem] text-(--ev-soft)' },
})
export class EventPlace {
  readonly venue = input<string | null>(null);
  /** The street, already formatted (addressPrimary). */
  readonly address = input.required<string>();
  /** The town it's in (addressTown): Milano or which town out of it. */
  readonly town = input<string | null>(null);
  /** The town after the street from md up, one line less: /lista's cards,
   * which would otherwise run taller than their flyer. */
  readonly townBeside = input(false, { transform: booleanAttribute });
  readonly trailing = input<string | null>(null);
}
