import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, debounceTime, interval } from 'rxjs';
import type { Map as LeafletMap, Marker, Point } from 'leaflet';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideClock,
  lucideHeart,
  lucideInstagram,
  lucideUserCheck,
  lucideUserPlus,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { CitiesService } from '../../core/services/cities.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { AuthService } from '../../core/services/auth.service';
import { EventCardDto, EventType } from '../../core/models/event.model';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { environment } from '../../../environments/environment';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
const DEFAULT_CENTER: [number, number] = [45.4642, 9.19];
const DEFAULT_ZOOM = 14;

/** Waits for panning/zooming to settle before hitting the API, so a burst of
 * scroll-wheel zoom steps triggers one request instead of one per step. */
const MOVE_DEBOUNCE_MS = 400;

/** Window before an event's start in which the popup card shows an "Inizia
 * tra X min" countdown instead of the plain start time. Pins themselves
 * don't react to this — see pulseState(). */
const STARTING_SOON_MS = 30 * 60 * 1000;

/** Re-evaluates pin pulse state on a timer, since an event can tip into
 * "live" purely by the clock ticking, with no new fetch — this also keeps
 * the popup's "Inizia tra X min" countdown current, since it runs inside
 * Angular's zone. */
const PULSE_REFRESH_MS = 30 * 1000;

/** Fraction of the map's height at which a selected pin should sit once
 * centred — high enough on the screen that the event card docked along the
 * bottom (see map.html) never covers it. */
const SELECTED_PIN_VERTICAL_RATIO = 0.32;

type PulseState = 'live' | null;

/** Pin colour per EventType, reusing the brand accents from styles.css so the
 * map stays inside the same palette as the rest of the UI. */
const PIN_COLORS: Record<EventType, string> = {
  EVENT: '#ff4d6d', // rose
  SCHOOL: '#8b5cf6', // violet
  CLUB: '#2dd4bf', // mint
  BAR: '#ffa24c', // amber
};

/** Outer pin outline per EventType — colour alone isn't enough to
 * distinguish them (colourblindness, greyscale printouts), so the shape
 * itself changes too. Each path fills a 24x32 viewBox, tip at (12, 32). */
const PIN_SHAPES: Record<EventType, string> = {
  // Classic teardrop.
  EVENT: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z',
  // Shield.
  SCHOOL: 'M12 0 1 4v9c0 9.4 6.3 15.8 11 19 4.7-3.2 11-9.6 11-19V4z',
  // Hexagon on a point.
  CLUB: 'M12 0 23 7v14L12 32 1 21V7z',
  // Rounded square on a point.
  BAR: 'M4 0h16a4 4 0 0 1 4 4v14a4 4 0 0 1-1.2 2.9L12 32 1.2 20.9A4 4 0 0 1 0 18V4a4 4 0 0 1 4-4z',
};

/** Inner glyph per EventType, drawn in white centred around (12, 12). */
const PIN_GLYPHS: Record<EventType, string> = {
  // Star.
  EVENT: 'M12 7.2l1.4 3 3.3.3-2.5 2.2.8 3.3-3-1.8-3 1.8.8-3.3-2.5-2.2 3.3-.3z',
  // Graduation cap.
  SCHOOL:
    'M12 6.5 5 9.5l7 3 7-3zm-4.5 5.2V15c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3.3L12 14z',
  // Music note.
  CLUB: 'M14.5 5.5v8.3a2.7 2.7 0 1 1-1-2.1V8h2.8V5.5z',
  // Cocktail glass.
  BAR: 'M7 6h10l-4 5.3V15h2v1H9v-1h2v-3.7z',
};

/** Italian label per EventType, shown in the map legend. */
const PIN_LABELS: Record<EventType, string> = {
  EVENT: 'Evento',
  SCHOOL: 'Scuola',
  CLUB: 'Discoteca',
  BAR: 'Bar',
};

const LEGEND_TYPES: EventType[] = ['EVENT', 'SCHOOL', 'CLUB', 'BAR'];

@Component({
  selector: 'app-map',
  imports: [Navbar, SidebarPushDirective, NgIcon, AuthModal],
  templateUrl: './map.html',
  styleUrl: './map.css',
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideClock,
      lucideHeart,
      lucideInstagram,
      lucideUserCheck,
      lucideUserPlus,
      lucideUsers,
      lucideX,
    }),
  ],
})
export class MapPage implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly destroyRef = inject(DestroyRef);

  private readonly eventsService = inject(EventsService);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly authService = inject(AuthService);

  private readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);
  protected readonly selectedCityId = signal<number | null>(null);
  /** Matched against EventCardDto.danceStyles, which the backend sends as
   * display names (e.g. "Salsa"), not slugs. */
  protected readonly selectedStyleNames = signal<ReadonlySet<string>>(new Set());

  protected readonly events = signal<EventCardDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly selectedEvent = signal<EventCardDto | null>(null);

  /** Optimistic local state for the popup's Parteciperò/Mi piace toggles,
   * keyed by event id so it survives switching between pins within the same
   * session. Flipped immediately on click, then reconciled against
   * EventsService.addAttendance/removeAttendance and addFavorite/removeFavorite
   * — reverted if the request fails. There's no follow-organizer endpoint
   * yet, so followedOrganizerIds stays local-only for now. */
  protected readonly goingEventIds = signal<ReadonlySet<string>>(new Set());
  protected readonly likedEventIds = signal<ReadonlySet<string>>(new Set());
  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace — both require a session server-side. */
  protected readonly authOpen = signal(false);
  protected readonly followedOrganizerIds = signal<ReadonlySet<string>>(new Set());

  /** Filters live in a floating card on mobile, opened from the Filtri button and
   * dismissed only via its own close button, so the map keeps the full screen and
   * stays interactive by default. */
  protected readonly filtersOpen = signal(false);

  /** Desktop-only: the floating filters card can shrink down to just its
   * active filters via the collapse arrow, freeing up map space without
   * closing it outright. Starts collapsed so the map is unobstructed on
   * load. Never toggled from mobile, which uses filtersOpen instead — but
   * combine it with isDesktop() before trusting it for anything visual,
   * since mobile never resets it back to false. */
  protected readonly filtersCollapsed = signal(true);

  /** Tracks the sm: breakpoint (640px) so the filters card's collapsed
   * summary — a desktop-only affordance — never renders on mobile even
   * though filtersCollapsed defaults true there too. */
  protected readonly isDesktop = signal(false);

  protected readonly filtersSummaryMode = computed(() => this.isDesktop() && this.filtersCollapsed());

  /** The event card docks full-width along the bottom edge on mobile (see
   * map.html), which would otherwise sit under — or behind — the Filtri/
   * Legenda corner buttons and the filters panel itself (also bottom-anchored
   * on mobile). Desktop's card stays a small floating box, so those corners
   * remain free there. */
  protected readonly hideFabsForCard = computed(() => this.selectedEvent() !== null && !this.isDesktop());

  /** The filters card's size/chrome depends on whether it's showing the full
   * list or just the collapsed summary, which Tailwind's opacity-modifier
   * class names (e.g. "bg-ink/10") can't cleanly express as `[class.x]`
   * bindings — so this returns the whole combination as one string instead.
   * Open looks the same on mobile and on the desktop-expanded state, on
   * purpose — same glass tint everywhere the full filter list is showing. */
  protected readonly filtersCardStateClass = computed(() =>
    this.filtersSummaryMode() ? 'w-auto p-2 bg-neutral-800/15 text-ink' : 'w-72 p-4 border shadow-2xl bg-neutral-800/15 text-bone',
  );

  /** Pinned near the top corner while the full filter list is showing, but
   * centred on the single row of chips once collapsed to the summary. */
  protected readonly filtersToggleButtonClass = computed(() =>
    this.filtersSummaryMode() ? 'top-1/2 -translate-y-1/2' : 'top-3',
  );

  protected readonly legendOpen = signal(false);

  /** What each pin looks like on the map, for the legend popover. */
  protected readonly legendItems = LEGEND_TYPES.map((type) => ({
    type,
    label: PIN_LABELS[type],
    color: PIN_COLORS[type],
    shape: PIN_SHAPES[type],
    glyph: PIN_GLYPHS[type],
  }));

  protected readonly filteredEvents = computed(() => {
    const styles = this.selectedStyleNames();
    const list = this.events();
    if (styles.size === 0) return list;
    return list.filter((event) => event.danceStyles.some((style) => styles.has(style)));
  });

  protected readonly activeCityName = computed(() => {
    const id = this.selectedCityId();
    if (id === null) return null;
    return this.cities().find((city) => city.id === id)?.name ?? null;
  });

  protected readonly activeStyleNames = computed(() => Array.from(this.selectedStyleNames()));

  protected readonly hasActiveFilters = computed(
    () => this.selectedCityId() !== null || this.selectedStyleNames().size > 0,
  );

  private map: LeafletMap | null = null;
  private markers: Marker[] = [];
  private leaflet: typeof import('leaflet') | null = null;
  private readonly pinIconCache = new Map<string, import('leaflet').DivIcon>();
  private readonly moveEnd$ = new Subject<void>();
  /** Live/not-live state of every visible pin as of the last drawMarkers()
   * call — lets the pulse timer skip the full marker teardown/recreate on
   * ticks where nothing actually crossed the live threshold. */
  private markerPulseSignature = '';

  constructor() {
    this.moveEnd$
      .pipe(debounceTime(MOVE_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchEventsInView());

    // Client-only: the HTTP transfer cache isn't picking these up, so
    // fetching them during SSR too just means fetching them twice (see
    // events/Leaflet below, which already avoid this the same way).
    if (this.isBrowser) {
      this.citiesService.getCities().subscribe({
        next: (cities) => this.cities.set(cities),
        error: () => this.error.set(true),
      });
      this.danceStylesService.getDanceStyles().subscribe({
        next: (styles) => this.danceStyles.set(styles),
        error: () => this.error.set(true),
      });

      // Tailwind's sm: breakpoint — kept in sync via matchMedia rather than
      // read once, since the filters card's collapsed summary must stop
      // rendering the moment the viewport narrows past it.
      const desktopQuery = window.matchMedia('(min-width: 640px)');
      this.isDesktop.set(desktopQuery.matches);
      const handleDesktopChange = (event: MediaQueryListEvent) => this.isDesktop.set(event.matches);
      desktopQuery.addEventListener('change', handleDesktopChange);
      this.destroyRef.onDestroy(() => desktopQuery.removeEventListener('change', handleDesktopChange));
    }

    // Re-draw markers whenever the style filter, the fetched events, or the
    // selected pin (which needs its own highlighted icon) change.
    effect(() => {
      this.filteredEvents();
      this.selectedEvent();
      this.drawMarkers();
    });

    // Pulse state depends on the clock, not just on the data — an event can
    // tip into "starting soon" or "live" with the events list untouched.
    if (this.isBrowser) {
      interval(PULSE_REFRESH_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.pulseSignature() !== this.markerPulseSignature) this.drawMarkers();
        });
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;

    // Dynamic import: leaflet touches `window` at module load time, which
    // doesn't exist during SSR.
    this.leaflet = await import('leaflet');
    this.initMap(this.leaflet);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(L: typeof import('leaflet')): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    // Scroll-wheel and pinch zoom stay on; the on-screen +/- control is
    // redundant with those and was competing for corner space with our own UI.
    this.map = L.map(container, { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    // CARTO Voyager: closer to Google Maps' look than plain OSM tiles.
    // Free, but requires an API key (carto.com/basemaps/apikey) — 5M tile
    // requests/month fair-use limit.
    L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${environment.cartoApiKey}`,
      {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 20,
        subdomains: 'abcd',
      },
    ).addTo(this.map);

    this.map.on('moveend', () => this.moveEnd$.next());
    this.fetchEventsInView();
  }

  private fetchEventsInView(): void {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    const box: MapBounds = {
      minLat: bounds.getSouth(),
      maxLat: bounds.getNorth(),
      minLng: bounds.getWest(),
      maxLng: bounds.getEast(),
    };

    this.loading.set(true);
    this.error.set(false);

    this.eventsService.getMapEvents(box, this.selectedCityId() ?? undefined).subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private drawMarkers(): void {
    const L = this.leaflet;
    if (!L || !this.map) return;

    const selectedId = this.selectedEvent()?.id;
    this.markers.forEach((marker) => marker.remove());
    this.markers = this.filteredEvents().map((event) => {
      const marker = L.marker([event.latitude, event.longitude], {
        icon: this.getPinIcon(L, event.eventType, this.pulseState(event), event.id === selectedId),
      }).addTo(this.map!);
      marker.on('click', () => this.selectEvent(event, marker));
      return marker;
    });
    this.markerPulseSignature = this.pulseSignature();
  }

  /** One char per visible event (1 = live, 0 = not) — cheap way to tell the
   * pulse timer whether a redraw is actually needed. */
  private pulseSignature(): string {
    return this.filteredEvents()
      .map((event) => (this.isLiveNow(event) ? '1' : '0'))
      .join('');
  }

  private selectEvent(event: EventCardDto, marker: Marker): void {
    this.selectedEvent.set(event);
    this.centerOnPoint(this.map!.latLngToContainerPoint(marker.getLatLng()));
    this.syncToggleState(event.id, this.likedEventIds, (id) => this.eventsService.isFavorite(id));
    this.syncToggleState(event.id, this.goingEventIds, (id) => this.eventsService.isGoing(id));
  }

  /** goingEventIds/likedEventIds are only ever flipped locally by
   * toggleGoing/toggleLike, so they start every page load empty — without
   * this, a user who's already attending/liking sees the button uncoloured
   * until they click it, and that click would fire the "add" request again
   * instead of "remove". */
  private syncToggleState(
    eventId: string,
    idsSignal: WritableSignal<ReadonlySet<string>>,
    fetchActive: (id: string) => Observable<boolean>,
  ): void {
    if (!this.authService.isAuthenticated()) return;

    fetchActive(eventId).subscribe({
      next: (active) => this.setMembership(idsSignal, eventId, active),
      error: (err) => console.error('Failed to sync toggle state for event', eventId, err),
    });
  }

  /** Pans (doesn't zoom) so the pin lands higher in the viewport rather than
   * dead centre, keeping it clear of the event card docked along the bottom
   * edge (see map.html) once it opens. */
  private centerOnPoint(currentPoint: Point): void {
    const L = this.leaflet;
    if (!L || !this.map) return;

    const size = this.map.getSize();
    const targetPoint = L.point(size.x / 2, size.y * SELECTED_PIN_VERTICAL_RATIO);
    this.map.panBy(currentPoint.subtract(targetPoint), { animate: true });
  }

  /** event.liveNow is a snapshot from whenever the event list was last
   * fetched (map pan/filter change, not on a timer), so it goes stale the
   * moment an event starts without a new fetch — read the clock instead. */
  protected isLiveNow(event: EventCardDto): boolean {
    const now = Date.now();
    return now >= new Date(event.startAt).getTime() && now <= new Date(event.endAt).getTime();
  }

  /** Pins pulse only once the event is actually underway — before that
   * (even "starting soon") the pin just sits there plain, no animation. */
  private pulseState(event: EventCardDto): PulseState {
    return this.isLiveNow(event) ? 'live' : null;
  }

  /** Minutes to start, only while inside the "starting soon" window; null
   * once the event is live (isLiveNow covers that) or too far out to flag. */
  protected startsInMinutes(event: EventCardDto): number | null {
    const msToStart = new Date(event.startAt).getTime() - Date.now();
    if (msToStart <= 0 || msToStart > STARTING_SOON_MS) return null;
    return Math.max(1, Math.round(msToStart / 60000));
  }

  private getPinIcon(
    L: typeof import('leaflet'),
    eventType: EventType,
    pulse: PulseState,
    selected: boolean,
  ): import('leaflet').DivIcon {
    const cacheKey = `${eventType}:${pulse ?? 'idle'}:${selected ? 'selected' : 'idle'}`;
    const cached = this.pinIconCache.get(cacheKey);
    if (cached) return cached;

    const pulseClass = pulse ? ` map-pin-wrap--${pulse}` : '';
    const selectedClass = selected ? ' map-pin-wrap--selected' : '';
    const pinFill = selected ? '#000000' : PIN_COLORS[eventType];
    const icon = L.divIcon({
      className: 'map-pin',
      html: `<span class="map-pin-wrap${pulseClass}${selectedClass}" style="color:${PIN_COLORS[eventType]}">
        <span class="map-pin-pulse" style="background:${PIN_COLORS[eventType]}"></span>
        <svg viewBox="0 0 24 32" width="24" height="32" xmlns="http://www.w3.org/2000/svg">
          <path d="${PIN_SHAPES[eventType]}" fill="${pinFill}"/>
          <path d="${PIN_GLYPHS[eventType]}" fill="#fff"/>
        </svg>
      </span>`,
      iconSize: [24, 32],
      iconAnchor: [12, 32],
    });

    this.pinIconCache.set(cacheKey, icon);
    return icon;
  }

  protected selectCity(cityId: number | null): void {
    this.selectedCityId.set(cityId);

    const city = this.cities().find((c) => c.id === cityId);
    if (city && this.map) {
      this.map.setView([city.latitude, city.longitude], DEFAULT_ZOOM);
    } else {
      this.fetchEventsInView();
    }
  }

  protected selectStyle(name: string): void {
    this.selectedStyleNames.update((names) => {
      const next = new Set(names);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  protected toggleFilters(): void {
    const willOpen = !this.filtersOpen();
    this.filtersOpen.set(willOpen);
    if (willOpen) {
      this.legendOpen.set(false);
    }
  }

  protected toggleFiltersCollapsed(): void {
    this.filtersCollapsed.update((collapsed) => !collapsed);
  }

  protected toggleLegend(): void {
    const willOpen = !this.legendOpen();
    this.legendOpen.set(willOpen);
    if (willOpen) {
      this.filtersOpen.set(false);
    }
  }

  protected closeDetail(): void {
    this.selectedEvent.set(null);
  }

  protected formatStart(event: EventCardDto): string {
    return new Date(event.startAt).toLocaleString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected formatPrice(event: EventCardDto): string {
    if (event.free) return 'GRATIS';
    if (event.price == null) return 'Prezzo su invito';
    return `${event.price} ${event.currency ?? ''}`.trim();
  }

  protected addressPrimary(address: string): string {
    const idx = address.indexOf(',');
    return idx === -1 ? address : address.slice(0, idx).trim();
  }

  protected addressSecondary(address: string): string | null {
    const idx = address.indexOf(',');
    return idx === -1 ? null : address.slice(idx + 1).trim();
  }

  protected googleMapsUrl(event: EventCardDto): string {
    const query = event.venueName ? `${event.venueName}, ${event.address}` : event.address;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }

  protected instagramUrl(handle: string): string {
    return `https://www.instagram.com/${handle}/`;
  }

  protected isGoing(eventId: string): boolean {
    return this.goingEventIds().has(eventId);
  }

  protected isLiked(eventId: string): boolean {
    return this.likedEventIds().has(eventId);
  }

  protected isFollowing(organizerId: string): boolean {
    return this.followedOrganizerIds().has(organizerId);
  }

  protected toggleGoing(event: EventCardDto): void {
    this.toggleOptimistic(
      this.goingEventIds,
      event.id,
      (id) => this.eventsService.addAttendance(id),
      (id) => this.eventsService.removeAttendance(id),
      (activating) => this.adjustCount(event.id, 'goingCount', activating ? 1 : -1),
    );
  }

  protected toggleLike(event: EventCardDto): void {
    this.toggleOptimistic(
      this.likedEventIds,
      event.id,
      (id) => this.eventsService.addFavorite(id),
      (id) => this.eventsService.removeFavorite(id),
      (activating) => this.adjustCount(event.id, 'likesCount', activating ? 1 : -1),
    );
  }

  /** No follow-organizer endpoint exists yet — stays a local-only toggle
   * until the backend adds one (see the note on followedOrganizerIds). */
  protected toggleFollow(organizerId: string): void {
    this.toggleId(this.followedOrganizerIds, organizerId);
  }

  protected likeIconFill(eventId: string): 'currentColor' | 'none' {
    return this.isLiked(eventId) ? 'currentColor' : 'none';
  }

  /** White outline when not liked, rose when liked — shared by the count
   * badge and the "Mi piace" button so the two spots can't drift apart. */
  protected heartIconClass(eventId: string): string {
    return this.isLiked(eventId) ? 'text-rose' : 'text-white';
  }

  /** Going-count badge colours by the count itself, not by the current
   * user's own attendance — white while nobody's going yet, rose the moment
   * it's non-zero, for any viewer. */
  protected goingCountIconClass(goingCount: number): string {
    return goingCount > 0 ? 'text-violet' : 'text-white';
  }

  /** Shared by toggleGoing/toggleLike: flips the local state immediately,
   * fires the matching add/remove request, and rolls back if it fails.
   * Gated on auth first, since both actions require a session server-side. */
  private toggleOptimistic(
    idsSignal: WritableSignal<ReadonlySet<string>>,
    id: string,
    add: (id: string) => Observable<void>,
    remove: (id: string) => Observable<void>,
    adjustCount?: (activating: boolean) => void,
  ): void {
    if (!this.authService.isAuthenticated()) {
      this.authOpen.set(true);
      return;
    }

    const wasActive = idsSignal().has(id);
    this.toggleId(idsSignal, id);
    adjustCount?.(!wasActive);

    const request = wasActive ? remove(id) : add(id);
    request.subscribe({
      error: () => {
        this.toggleId(idsSignal, id);
        adjustCount?.(wasActive);
      },
    });
  }

  /** Optimistic +1/-1 on a displayed count field (likes or going), mirrored
   * into both the events list and the open card (same object reference) so
   * the UI updates instantly without a getMapEvents refetch. Reversed by
   * toggleOptimistic's rollback on request failure. */
  private adjustCount(eventId: string, field: 'likesCount' | 'goingCount', delta: number): void {
    let updated: EventCardDto | null = null;

    this.events.update((events) =>
      events.map((event) => {
        if (event.id !== eventId) return event;
        updated = { ...event, [field]: Math.max(0, event[field] + delta) };
        return updated;
      }),
    );

    if (updated && this.selectedEvent()?.id === eventId) {
      this.selectedEvent.set(updated);
    }
  }

  private toggleId(idsSignal: WritableSignal<ReadonlySet<string>>, id: string): void {
    this.setMembership(idsSignal, id, !idsSignal().has(id));
  }

  private setMembership(idsSignal: WritableSignal<ReadonlySet<string>>, id: string, active: boolean): void {
    idsSignal.update((ids) => {
      const next = new Set(ids);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
