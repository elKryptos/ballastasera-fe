import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { EVENT_TYPE_LABELS, MILAN_CENTER } from '../../core/config/map-pins';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { EventCardDto, EventType } from '../../core/models/event.model';
import { CitiesService } from '../../core/services/cities.service';
import { CityEventsService } from '../../core/services/city-events.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { EventEngagementService } from '../../core/services/event-engagement.service';
import { EventFiltersService } from '../../core/services/event-filters.service';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { PRECISE_FIX_METERS, UserLocationService } from '../../core/services/user-location.service';
import {
  addressPrimary,
  formatClock,
  formatPrice,
  isLiveAt,
  minutesToEnd,
  withoutCountry,
} from '../../core/utils/event-format';
import {
  compareByLiveThenStart,
  dateRangeFromSlug,
  eventNight,
  eventTypesFromSlugs,
  matchesEventFilters,
  nightHeading,
  nightOf,
  rangeLastNight,
} from '../../core/utils/event-filters';
import { GeoPoint, distanceKm, formatDistance, nearestCity } from '../../core/utils/geo';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { DateRangeChips } from '../../shared/event-filters/date-range-chips';
import { EventFiltersDialog } from '../../shared/event-filters/event-filters-dialog';
import { EventPinIcon } from '../../shared/event-filters/pin-icons';
import { ViewSwitch } from '../../shared/event-filters/view-switch';

/** Keeps the LIVE badges and "finisce tra" current, and drops a night once
 * it's over, with the page left open. */
const CLOCK_TICK_MS = 30 * 1000;

/** Past this, "finisce tra 3 h 20 min" says less than "fino alle 03:00". */
const ENDING_SOON_MINUTES = 90;

type AreaId = 'city' | 'near10' | 'near3' | 'near1';

const AREAS: { id: AreaId; label: string; km: number | null }[] = [
  // The city with its province (cityBounds): up to ~50 km out.
  { id: 'city', label: 'Tutta la città', km: null },
  // The city without the farther hinterland.
  { id: 'near10', label: 'Entro 10 km', km: 10 },
  { id: 'near3', label: 'Entro 3 km', km: 3 },
  { id: 'near1', label: 'Entro 1,5 km', km: 1.5 },
];

export type ListSort = 'time' | 'distance' | 'popular';

interface ListItem {
  event: EventCardDto;
  /** From the visitor, once their position is known. */
  km: number | null;
}

/** One card, already formatted for the template. */
interface ListRow {
  id: string;
  title: string;
  start: string;
  end: string;
  /** "Live · finisce tra 52 min" while it's on, null otherwise. */
  live: string | null;
  /** "Discoteca · 2,4 km". */
  meta: string;
  /** No flyer: the type's pin stands in, as on the map's card. */
  flyerUrl: string | null;
  eventType: EventType;
  place: string;
  styles: string[];
  price: string;
  going: number;
  likes: number;
  liked: boolean;
}

interface ListGroup {
  night: number;
  heading: string;
  rows: ListRow[];
}

/**
 * /lista: the same search as the map, as a list grouped by night. One
 * request per city (CityEventsService, cached for a few minutes); the day,
 * styles, type, price, distance and sorting all work on that copy,
 * client-side, with the filters shared with /mappa (EventFiltersService).
 * Distances need the visitor's position, asked only when they pick a
 * distance or sort by it.
 */
@Component({
  selector: 'app-event-list',
  imports: [RouterLink, AuthModal, SidebarPushDirective, DateRangeChips, EventFiltersDialog, EventPinIcon, ViewSwitch],
  templateUrl: './event-list.html',
  host: { class: 'block min-h-dvh bg-(--color-ink) text-(--ev-text)' },
})
export class EventList {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly cityEvents = inject(CityEventsService);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly userLocation = inject(UserLocationService);
  private readonly engagement = inject(EventEngagementService);
  protected readonly filters = inject(EventFiltersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);
  protected readonly cityId = signal<number | null>(null);
  protected readonly city = computed(() => this.cities().find((city) => city.id === this.cityId()) ?? null);

  protected readonly areas = AREAS;
  protected readonly area = signal<AreaId>('city');
  private readonly areaKm = computed(() => AREAS.find((area) => area.id === this.area())?.km ?? null);
  protected readonly sort = signal<ListSort>('time');

  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly locating = this.userLocation.locating;
  protected readonly locateMessage = signal<string | null>(null);

  protected readonly filtersOpen = signal(false);
  protected readonly authOpen = signal(false);
  protected readonly now = signal(Date.now());

  /** Types and price — the styles have their own row here, outside the dialog. */
  protected readonly dialogFilterCount = computed(() => this.filters.types().size + (this.filters.freeOnly() ? 1 : 0));

  private readonly entry = computed(() => {
    const id = this.cityId();
    return id === null ? undefined : this.cityEvents.entries().get(id);
  });
  protected readonly hasData = computed(() => this.entry() !== undefined);

  private readonly items = computed<ListItem[]>(() => {
    const filters = this.filters.state();
    const now = this.now();
    const position = this.userLocation.position();
    const maxKm = this.areaKm();
    return (this.entry()?.events ?? [])
      .filter((event) => matchesEventFilters(event, filters, now))
      .map((event) => ({
        event,
        km: position ? distanceKm(position, { lat: event.latitude, lng: event.longitude }) : null,
      }))
      .filter((item) => maxKm === null || (item.km !== null && item.km <= maxKm));
  });

  protected readonly groups = computed<ListGroup[]>(() => {
    const now = this.now();
    const compare = this.comparator(now);
    const byNight = new Map<number, ListItem[]>();
    for (const item of this.items()) {
      const night = eventNight(item.event, now);
      const items = byNight.get(night);
      if (items) items.push(item);
      else byNight.set(night, [item]);
    }
    return Array.from(byNight, ([night, items]) => ({
      night,
      heading: nightHeading(night, now),
      rows: items.sort(compare).map((item) => this.toRow(item, now)),
    })).sort((a, b) => a.night - b.night);
  });

  /** "Mostra N serate" in the filters dialog. */
  protected readonly resultCount = computed(() => (this.hasData() ? this.items().length : null));

  protected readonly countLabel = computed(() => {
    const count = this.items().length;
    const km = this.areaKm();
    const where = km === null ? `in tutta ${this.city()?.name ?? 'la città'}` : `entro ${formatKm(km)}`;
    if (count === 0) return `Nessuna serata ${where}`;
    return `${count} ${count === 1 ? 'serata' : 'serate'} ${where}`;
  });

  /** The backend caps the city's events (earliest first): only worth saying
   * when the picked days reach past the last night it returned. */
  protected readonly truncatedForRange = computed(() => {
    const entry = this.entry();
    if (!entry?.truncated) return false;
    const lastNight = rangeLastNight(this.filters.range(), this.now());
    if (lastNight === null) return true;
    const latestStart = Math.max(...entry.events.map((event) => Date.parse(event.startAt)));
    return lastNight >= nightOf(latestStart);
  });

  constructor() {
    // A link straight to a search — the menu's shortcuts: ?quando=domani,
    // ?quando=settimana&tipo=scuola,discoteca,bar. Each is a fresh search for
    // that day (the kinds of night it names, else all of them; styles and price
    // stay, they're the visitor's own taste), applied once and then dropped
    // from the URL: from there on the chips are the state. replaceState, not
    // a router navigation: one now would cut short the route's view
    // transition, still running.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const range = dateRangeFromSlug(params.get('quando'));
      const types = eventTypesFromSlugs(params.get('tipo'));
      if (!range && !types) return;
      if (range) this.filters.range.set(range);
      this.filters.types.set(types ?? new Set());
      if (this.isBrowser) {
        const clean = this.router.createUrlTree([], {
          relativeTo: this.route,
          queryParams: { quando: null, tipo: null },
          queryParamsHandling: 'merge',
        });
        this.location.replaceState(this.router.serializeUrl(clean));
      }
    });

    if (this.isBrowser) {
      // Same list the map uses, cached for the visit (CitiesService). The
      // city starts as the one the map was last looking at, else the
      // visitor's, else Milano's.
      this.citiesService
        .getCities()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (cities) => {
            this.cities.set(cities);
            if (this.cityId() === null && cities.length) this.cityId.set(this.startingCity(cities).id);
          },
          error: () => this.error.set(true),
        });
      this.danceStylesService
        .getDanceStyles()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (styles) => this.danceStyles.set(styles), error: () => this.danceStyles.set([]) });

      // One request for every heart on the page, instead of one per card.
      this.engagement.syncAllLikes();

      interval(CLOCK_TICK_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.now.set(Date.now()));
    }

    // A new city: its events, unless they're cached and fresh.
    effect(() => {
      const city = this.city();
      if (city) untracked(() => this.load(city));
    });
  }

  protected load(city: CityDto, force = false): void {
    this.loading.set(true);
    this.error.set(false);
    this.cityEvents
      .load(city, { force })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  protected retry(): void {
    const city = this.city();
    if (city) this.load(city, true);
  }

  protected selectCity(event: Event): void {
    this.cityId.set(Number((event.target as HTMLSelectElement).value));
  }

  /** A distance needs the visitor's position: asked on this tap, the first
   * time. Refused or failed, the area stays as it was and the reason shows. */
  protected async selectArea(area: AreaId): Promise<void> {
    const needsPosition = AREAS.find((option) => option.id === area)?.km != null;
    if (needsPosition && !(await this.ensurePosition())) return;
    this.area.set(area);
  }

  protected async selectSort(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const sort = select.value as ListSort;
    if (sort === 'distance' && !(await this.ensurePosition())) {
      select.value = this.sort();
      return;
    }
    this.sort.set(sort);
  }

  /** "Tutta Milano, questa settimana": the widest search there is. */
  protected showEverything(): void {
    this.area.set('city');
    this.filters.range.set('week');
    this.filters.clear();
  }

  protected toggleLike(eventId: string): void {
    const handled = this.engagement.toggleLike(eventId, (delta) =>
      this.cityEvents.adjustCount(eventId, 'likesCount', delta),
    );
    if (!handled) this.authOpen.set(true);
  }

  private async ensurePosition(): Promise<boolean> {
    this.locateMessage.set(null);
    if (this.userLocation.position()) return true;
    const result = await this.userLocation.locate();
    if (!result.ok) {
      this.locateMessage.set(result.message);
      return false;
    }
    if (result.position.accuracy > PRECISE_FIX_METERS) {
      const km = Math.round(result.position.accuracy / 1000);
      this.locateMessage.set(`Posizione approssimativa (±${km} km): le distanze sono indicative.`);
    }
    return true;
  }

  private startingCity(cities: CityDto[]): CityDto {
    const center = this.mapViewState.center;
    const from: GeoPoint = center
      ? { lat: center[0], lng: center[1] }
      : (this.userLocation.position() ?? { lat: MILAN_CENTER[0], lng: MILAN_CENTER[1] });
    return nearestCity(cities, from, Infinity) ?? cities[0];
  }

  private comparator(now: number): (a: ListItem, b: ListItem) => number {
    switch (this.sort()) {
      case 'distance':
        return (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || compareByLiveThenStart(a.event, b.event, now);
      case 'popular':
        return (a, b) =>
          b.event.goingCount - a.event.goingCount ||
          b.event.likesCount - a.event.likesCount ||
          compareByLiveThenStart(a.event, b.event, now);
      default:
        return (a, b) => compareByLiveThenStart(a.event, b.event, now);
    }
  }

  private toRow({ event, km }: ListItem, now: number): ListRow {
    const left = minutesToEnd(event, now);
    const live = isLiveAt(event, now)
      ? `Live · ${left !== null && left <= ENDING_SOON_MINUTES ? `finisce tra ${left} min` : `fino alle ${formatClock(event.endAt)}`}`
      : null;
    const address = addressPrimary(withoutCountry(event.address));
    return {
      id: event.id,
      title: event.title,
      start: formatClock(event.startAt),
      end: formatClock(event.endAt),
      live,
      meta: [EVENT_TYPE_LABELS[event.eventType], km !== null ? formatDistance(km) : null].filter(Boolean).join(' · '),
      flyerUrl: event.flyerUrl,
      eventType: event.eventType,
      place: event.venueName ? `${event.venueName} · ${address}` : address,
      styles: event.danceStyles,
      price: formatPrice(event),
      going: event.goingCount,
      likes: event.likesCount,
      liked: this.engagement.isLiked(event.id),
    };
  }
}

function formatKm(km: number): string {
  return `${String(km).replace('.', ',')} km`;
}
