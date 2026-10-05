import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventCardDto } from '../../../core/models/event.model';
import { VenueMapPinDto } from '../../../core/models/venue.model';
import { EventFiltersService } from '../../../core/services/event-filters.service';
import { addressPrimary, formatClock, formatPrice, isLiveAt, withoutCountry } from '../../../core/utils/event-format';
import { DATE_RANGE_PHRASES, nightShortLabel } from '../../../core/utils/event-filters';
import { EventMapCard } from '../event-map-card/event-map-card';
import { VenueMapCard } from '../venue-map-card/venue-map-card';
import { MapLayer } from '../map-layer';
import { EventPinIcon } from '../../../shared/event-filters/pin-icons';

/** A swipe on the header shorter than this is a tap. */
const SWIPE_PX = 32;

/** One row of the area's list, already formatted for the template. */
interface SheetCard {
  event: EventCardDto;
  live: boolean;
  when: string;
  place: string;
}

/**
 * The map's results: how many nights are in the area with the current
 * filters, those nights as cards (a sideways row on phones, a list in the
 * left-hand panel from md up), and the tapped pin's (or venue badge's) full
 * card in their place.
 * Pulled down on a phone it shrinks to its header, leaving the map whole;
 * over places only, that folds the open venue card away until pulled back up.
 * Presentational: MapPage owns the data and the selection.
 */
@Component({
  selector: 'app-map-sheet',
  imports: [EventMapCard, VenueMapCard, EventPinIcon, RouterLink],
  templateUrl: './map-sheet.html',
  host: { class: 'block' },
})
export class MapSheet {
  protected readonly filters = inject(EventFiltersService);

  /** The filtered events inside the view, already in display order. */
  readonly events = input.required<EventCardDto[]>();
  readonly selected = input<EventCardDto | null>(null);
  /** The tapped venue badge; never set together with `selected`. */
  readonly selectedVenue = input<VenueMapPinDto | null>(null);
  /** Off, the venue card leaves out its link to the venue's page. */
  readonly venuePageEnabled = input(false);
  readonly now = input.required<number>();
  readonly layer = input.required<MapLayer>();
  readonly loading = input(false);
  readonly error = input(false);
  /** At least one search came back — before that the count means nothing yet. */
  readonly searched = input(false);
  /** The view moved past what the last search covers. */
  readonly stale = input(false);
  readonly venueCount = input(0);
  readonly venuesLoading = input(false);
  readonly venuesError = input(false);
  readonly going = input(false);
  readonly liked = input(false);
  /** The selected event's distance from the visitor, when known. */
  readonly distanceKm = input<number | null>(null);
  readonly listEnabled = input(false);

  readonly eventSelected = output<EventCardDto>();
  readonly closed = output<void>();
  readonly goingToggled = output<void>();
  readonly likeToggled = output<void>();
  /** "Riprova" after an error, or "Cerca in questa zona" from the sheet. */
  readonly searchRequested = output<void>();

  protected readonly showsEvents = computed(() => this.layer() !== 'venues');

  /** An open card, event or venue. */
  private readonly hasSelection = computed(() => this.selected() !== null || this.selectedVenue() !== null);
  /** Phones only: the body showing, or just the header. */
  protected readonly expanded = signal(true);
  /** Anything under the header — the template's branches, in its order. Over
   * places only that's just the open card; with no body, the handle has
   * nothing to pull up and steps aside. */
  protected readonly hasBody = computed(
    () =>
      this.hasSelection() ||
      this.unsearched() ||
      this.isEmpty() ||
      (this.showsEvents() && (this.events().length > 0 || this.loading())),
  );
  /** The handle closes the open card when the nights' list is behind it;
   * over places only it folds the card away instead, and brings it back. */
  private readonly closesCard = computed(() => this.showsEvents() && this.hasSelection());
  /** A card the handle closes always shows, even pulled down. */
  protected readonly showBody = computed(() => this.closesCard() || (this.hasBody() && this.expanded()));
  protected readonly handleLabel = computed(() => {
    if (this.closesCard()) return 'Torna alle serate';
    if (this.showsEvents()) return this.showBody() ? 'Riduci le serate' : 'Mostra le serate';
    return this.showBody() ? 'Riduci il luogo' : 'Mostra il luogo';
  });

  protected readonly cards = computed<SheetCard[]>(() => {
    const now = this.now();
    return this.events().map((event) => {
      const live = isLiveAt(event, now);
      return {
        event,
        live,
        when: live
          ? `Live · fino alle ${formatClock(event.endAt)}`
          : `${nightShortLabel(event, now)} · ${formatClock(event.startAt)}`,
        place: `${event.venueName ?? addressPrimary(withoutCountry(event.address))} · ${formatPrice(event)}`,
      };
    });
  });

  private readonly liveCount = computed(() => this.cards().filter((card) => card.live).length);

  /** "3 serate stasera", "Nessuna serata nel weekend", "12 locali e scuole". */
  protected readonly title = computed(() => {
    if (!this.showsEvents()) {
      if (this.venuesLoading()) return 'Cerco locali e scuole…';
      if (this.venuesError()) return 'Impossibile caricare i luoghi';
      return venuesLabel(this.venueCount());
    }
    if (this.error()) return 'Impossibile caricare le serate';
    if (this.loading() && !this.searched()) return 'Cerco le serate…';
    if (this.unsearched()) return 'Zona ancora da cercare';
    const count = this.events().length;
    const phrase = DATE_RANGE_PHRASES[this.filters.range()];
    if (count === 0) return `Nessuna serata ${phrase}`;
    return `${count} ${count === 1 ? 'serata' : 'serate'} ${phrase}`;
  });

  /** Moved to where nothing was searched yet: "none here" would be a guess. */
  protected readonly unsearched = computed(
    () => this.showsEvents() && this.stale() && !this.loading() && this.events().length === 0,
  );

  protected readonly subtitle = computed(() => {
    if (this.unsearched()) return 'Cerca per vedere le serate di qui';
    if (this.stale()) return 'Hai spostato la mappa: cerca in questa zona';
    const parts = ['in questa zona'];
    if (this.showsEvents() && this.liveCount() > 0) parts.push(`${this.liveCount()} in corso`);
    if (this.layer() === 'both' && !this.venuesLoading()) parts.push(venuesLabel(this.venueCount()));
    return parts.join(' · ');
  });

  /** Nothing to show: offer the two ways out, when they'd change anything. */
  protected readonly isEmpty = computed(
    () =>
      this.showsEvents() &&
      this.searched() &&
      !this.stale() &&
      !this.loading() &&
      !this.error() &&
      this.events().length === 0,
  );
  protected readonly canWiden = computed(() => {
    const range = this.filters.range();
    return range !== 'week' && range !== 'all';
  });

  private dragStartY: number | null = null;

  /** Pulls the sheet back up. MapPage calls it on every venue badge tap: a
   * tap on the open venue's badge, its card folded away, is no change to
   * `selectedVenue`, so the inputs alone can't tell. */
  unfold(): void {
    this.expanded.set(true);
  }

  protected toggleExpanded(): void {
    if (this.closesCard()) {
      this.closed.emit();
      return;
    }
    this.expanded.update((expanded) => !expanded);
  }

  /** Touch and pen only — a mouse has the handle to click. */
  protected startDrag(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') this.dragStartY = event.clientY;
  }

  /** Down closes the open card first (see closesCard), then shrinks the
   * sheet; up grows it back. */
  protected endDrag(event: PointerEvent): void {
    if (this.dragStartY === null) return;
    const dy = event.clientY - this.dragStartY;
    this.dragStartY = null;
    if (dy > SWIPE_PX) {
      if (this.closesCard()) this.closed.emit();
      else this.expanded.set(false);
    } else if (dy < -SWIPE_PX) {
      this.expanded.set(true);
    }
  }

  protected cancelDrag(): void {
    this.dragStartY = null;
  }
}

function venuesLabel(count: number): string {
  if (count === 0) return 'Nessun locale o scuola';
  return count === 1 ? '1 locale o scuola' : `${count} locali e scuole`;
}
