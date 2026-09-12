import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, interval } from 'rxjs';
import type { Map as LeafletMap, Marker, Point } from 'leaflet';
import { Navbar } from '../../shared/navbar/navbar';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { CitiesService } from '../../core/services/cities.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { EventCardDto, EventType } from '../../core/models/event.model';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { environment } from '../../../environments/environment';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
const DEFAULT_CENTER: [number, number] = [45.4642, 9.19];
const DEFAULT_ZOOM = 14;

/** Waits for panning/zooming to settle before hitting the API, so a burst of
 * scroll-wheel zoom steps triggers one request instead of one per step. */
const MOVE_DEBOUNCE_MS = 400;

/** An event pulses on the map once it's this close to starting, even before
 * the backend flags it as liveNow. */
const STARTING_SOON_MS = 30 * 60 * 1000;

/** Re-evaluates pin pulse state on a timer, since an event can cross into
 * "starting soon" or "live" purely by the clock ticking, with no new fetch. */
const PULSE_REFRESH_MS = 30 * 1000;

/** Fraction of the map's height at which a selected pin should sit once
 * centred — low enough that its card (anchored above it) has room to
 * breathe above the fold, which matters most on short mobile viewports. */
const SELECTED_PIN_VERTICAL_RATIO = 0.68;

type PulseState = 'live' | 'soon' | null;

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
  CLUB: 'Club',
  BAR: 'Bar',
};

const LEGEND_TYPES: EventType[] = ['EVENT', 'SCHOOL', 'CLUB', 'BAR'];

@Component({
  selector: 'app-map',
  imports: [Navbar],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapPage implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly destroyRef = inject(DestroyRef);

  private readonly eventsService = inject(EventsService);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);

  private readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);
  protected readonly selectedCityId = signal<number | null>(null);
  protected readonly selectedStyleSlug = signal<string | null>(null);

  protected readonly events = signal<EventCardDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly selectedEvent = signal<EventCardDto | null>(null);
  /** Screen-space position (relative to the map container) of the pin behind
   * the selected event, so its card can be anchored right above it instead
   * of sitting in a fixed spot on the screen. Recomputed as the map pans or
   * zooms so the card keeps tracking the pin. */
  protected readonly selectedPinPoint = signal<{ x: number; y: number } | null>(null);

  /** Filters live in a bottom-sheet on mobile so the map keeps the full screen by default. */
  protected readonly filtersOpen = signal(false);

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
    const style = this.selectedStyleSlug();
    const list = this.events();
    if (!style) return list;
    return list.filter((event) => event.danceStyles.includes(style));
  });

  private map: LeafletMap | null = null;
  private markers: Marker[] = [];
  private leaflet: typeof import('leaflet') | null = null;
  private readonly pinIconCache = new Map<string, import('leaflet').DivIcon>();
  private readonly moveEnd$ = new Subject<void>();

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
    }

    // Re-draw markers whenever the style filter or the fetched events change.
    effect(() => {
      this.filteredEvents();
      this.drawMarkers();
    });

    // Pulse state depends on the clock, not just on the data — an event can
    // tip into "starting soon" or "live" with the events list untouched.
    if (this.isBrowser) {
      interval(PULSE_REFRESH_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.drawMarkers());
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
    // 'move' fires continuously during pan/zoom animations, so the card
    // stays glued to its pin instead of lagging behind until the gesture ends.
    this.map.on('move', () => this.updateSelectedPinPoint());
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

    this.markers.forEach((marker) => marker.remove());
    this.markers = this.filteredEvents().map((event) => {
      const marker = L.marker([event.latitude, event.longitude], {
        icon: this.getPinIcon(L, event.eventType, this.pulseState(event)),
      }).addTo(this.map!);
      marker.on('click', () => this.selectEvent(event, marker));
      return marker;
    });
  }

  private selectEvent(event: EventCardDto, marker: Marker): void {
    this.selectedEvent.set(event);
    const currentPoint = this.map!.latLngToContainerPoint(marker.getLatLng());
    this.selectedPinPoint.set(currentPoint);
    this.centerOnPoint(currentPoint);
  }

  /** Pans (doesn't zoom) so the pin lands lower in the viewport rather than
   * dead centre, leaving space above it for the card that just opened. */
  private centerOnPoint(currentPoint: Point): void {
    const L = this.leaflet;
    if (!L || !this.map) return;

    const size = this.map.getSize();
    const targetPoint = L.point(size.x / 2, size.y * SELECTED_PIN_VERTICAL_RATIO);
    this.map.panBy(currentPoint.subtract(targetPoint), { animate: true });
  }

  /** Re-derives the selected pin's screen position from its (unchanged)
   * lat/lng after the map moves — cheap, and keeps this in sync without
   * having to hold onto the marker instance separately. */
  private updateSelectedPinPoint(): void {
    const event = this.selectedEvent();
    if (!event || !this.map) return;
    this.selectedPinPoint.set(
      this.map.latLngToContainerPoint([event.latitude, event.longitude]),
    );
  }

  /** event.liveNow is a snapshot from whenever the event list was last
   * fetched (map pan/filter change, not on a timer), so it goes stale the
   * moment an event starts without a new fetch — read the clock instead. */
  protected isLiveNow(event: EventCardDto): boolean {
    const now = Date.now();
    return now >= new Date(event.startAt).getTime() && now <= new Date(event.endAt).getTime();
  }

  private pulseState(event: EventCardDto): PulseState {
    if (this.isLiveNow(event)) return 'live';
    if (this.startsInMinutes(event) !== null) return 'soon';
    return null;
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
  ): import('leaflet').DivIcon {
    const cacheKey = `${eventType}:${pulse ?? 'idle'}`;
    const cached = this.pinIconCache.get(cacheKey);
    if (cached) return cached;

    const pulseClass = pulse ? ` map-pin-wrap--${pulse}` : '';
    const icon = L.divIcon({
      className: 'map-pin',
      html: `<span class="map-pin-wrap${pulseClass}" style="color:${PIN_COLORS[eventType]}">
        <span class="map-pin-pulse" style="background:${PIN_COLORS[eventType]}"></span>
        <svg viewBox="0 0 24 32" width="24" height="32" xmlns="http://www.w3.org/2000/svg">
          <path d="${PIN_SHAPES[eventType]}" fill="${PIN_COLORS[eventType]}"/>
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

  protected selectStyle(slug: string | null): void {
    this.selectedStyleSlug.set(slug === this.selectedStyleSlug() ? null : slug);
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected toggleLegend(): void {
    this.legendOpen.update((open) => !open);
  }

  protected closeDetail(): void {
    this.selectedEvent.set(null);
    this.selectedPinPoint.set(null);
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
}
