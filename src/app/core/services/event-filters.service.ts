import { Service, computed, signal } from '@angular/core';
import { EventType } from '../models/event.model';
import { DateRange, EventFilterState } from '../utils/event-filters';
import { toggled } from '../utils/sets';

/**
 * What the visitor is looking for — day, styles, kind of night, price —
 * shared by /mappa and /lista, so switching between the two keeps the same
 * search. In memory only, like MapViewStateService: it lasts the visit, not a
 * reload. Applying it is up to each page (see matchesEventFilters); nothing
 * here triggers a request.
 */
@Service()
export class EventFiltersService {
  readonly range = signal<DateRange>('all');
  readonly styles = signal<ReadonlySet<string>>(new Set());
  readonly types = signal<ReadonlySet<EventType>>(new Set());
  readonly freeOnly = signal(false);

  readonly state = computed<EventFilterState>(() => ({
    range: this.range(),
    styles: this.styles(),
    types: this.types(),
    freeOnly: this.freeOnly(),
  }));

  /** Filters on top of the day — the number on the Filtri button. */
  readonly activeCount = computed(() => this.styles().size + this.types().size + (this.freeOnly() ? 1 : 0));

  toggleStyle(name: string): void {
    this.styles.update((names) => toggled(names, name));
  }

  toggleType(type: EventType): void {
    this.types.update((types) => toggled(types, type));
  }

  /** "Azzera": everything but the day, which has its own row of chips. */
  clear(): void {
    this.styles.set(new Set());
    this.types.set(new Set());
    this.freeOnly.set(false);
  }
}
