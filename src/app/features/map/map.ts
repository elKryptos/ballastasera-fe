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
import { Subject, Subscription, debounceTime, interval } from 'rxjs';
import type { DivIcon, LatLng, Layer, Map as LeafletMap, MaplibreGL, Marker } from 'leaflet';
import { Navbar } from '../../shared/navbar/navbar';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { CitiesService } from '../../core/services/cities.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { EventEngagementService } from '../../core/services/event-engagement.service';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { EventCardDto, EventType } from '../../core/models/event.model';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { isLiveAt } from '../../core/utils/event-format';
import { environment } from '../../../environments/environment';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventMapCard } from './event-map-card/event-map-card';
import { MapFilters } from './map-filters/map-filters';
import {
  EVENT_TYPE_LABELS,
  MILAN_CENTER,
  MILAN_DEFAULT_ZOOM,
  PIN_COLORS,
  PIN_GLYPHS,
  PIN_SHAPES,
  PIN_TYPES,
} from '../../core/config/map-pins';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
const DEFAULT_CENTER = MILAN_CENTER;
const DEFAULT_ZOOM = MILAN_DEFAULT_ZOOM;

/** Waits for panning/zooming to settle before hitting the API, so a burst of
 * scroll-wheel zoom steps triggers one request instead of one per step. */
const MOVE_DEBOUNCE_MS = 400;

/** Re-evaluates pin pulse state on a timer, since an event can tip into
 * "live" purely by the clock ticking, with no new fetch — and ticks the
 * `now` signal the event card's LIVE badge and "Inizia tra X min" countdown
 * read. */
const PULSE_REFRESH_MS = 30 * 1000;

/** Fraction of the map's height at which a selected pin should sit once
 * centred — high enough on the screen that the event card docked along the
 * bottom (see event-map-card.html) never covers it. */
const SELECTED_PIN_VERTICAL_RATIO = 0.32;

/** The basemap, one MapLibre style per theme over OpenFreeMap's vector tiles
 * (free, no API key, no request limits, commercial use allowed), generated
 * into public/ by scripts/build-map-styles.mjs (`pnpm map:styles`): the same
 * layers recoloured Voyager-like (light) and Google-"night"-like (dark), metro
 * and train stations as the only POIs. */
const LIGHT_STYLE_URL = '/map-styles/light.json';
const DARK_STYLE_URL = '/map-styles/dark.json';

/** The shortest credit OpenStreetMap's attribution guidelines accept, linked
 * to their copyright page — required under the ODbL for every basemap here. */
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

let webGLSupport: boolean | undefined;

/** MapLibre draws with WebGL. Checked up front (once, then cached) because
 * without it the GL layer fails halfway through being added and leaves an
 * empty container behind; the light raster basemap stands in instead. */
function supportsWebGL(): boolean {
  if (webGLSupport === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
      webGLSupport = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webGLSupport = false;
    }
  }
  return webGLSupport;
}

@Component({
  selector: 'app-map',
  imports: [Navbar, SidebarPushDirective, AuthModal, EventMapCard, MapFilters],
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
  private readonly mapViewState = inject(MapViewStateService);
  private readonly themeService = inject(ThemeService);
  /** Parteciperò/Mi piace state for the open card — see EventEngagementService. */
  protected readonly engagement = inject(EventEngagementService);

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

  /** Clock for the event card's LIVE badge and countdown, ticked by the
   * pulse timer — the app is zoneless, so nothing else would re-render the
   * card while time moves on. */
  protected readonly now = signal(Date.now());

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace — both require a session server-side. */
  protected readonly authOpen = signal(false);

  /** Filters live in a floating card on mobile, opened from the Filtri button and
   * dismissed only via its own close button, so the map keeps the full screen and
   * stays interactive by default. Here rather than in MapFilters because the
   * legend closes it too (see toggleLegend). */
  protected readonly filtersOpen = signal(false);

  /** Tracks the sm: breakpoint (640px): the filters' collapsed summary
   * (MapFilters) is a desktop-only affordance, and hideFabsForCard below
   * only applies on mobile. */
  protected readonly isDesktop = signal(false);

  /** The event card docks full-width along the bottom edge on mobile (see
   * event-map-card.html), which would otherwise sit under — or behind — the Filtri/
   * Legenda corner buttons and the filters panel itself (also bottom-anchored
   * on mobile). Desktop's card stays a small floating box, so those corners
   * remain free there. */
  protected readonly hideFabsForCard = computed(() => this.selectedEvent() !== null && !this.isDesktop());

  protected readonly legendOpen = signal(false);

  /** What each pin looks like on the map, for the legend popover. */
  protected readonly legendItems = PIN_TYPES.map((type) => ({
    type,
    label: EVENT_TYPE_LABELS[type],
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

  private map: LeafletMap | null = null;
  /** One marker per visible event, by id — see drawMarkers(). `event` is
  refreshed on every sync, so a click never opens the card with a stale copy
  (e.g. the counts from before a like). */
  private markers = new Map<string, { marker: Marker; event: EventCardDto }>();
  private leaflet: typeof import('leaflet') | null = null;
  /** The basemap — see showBaseLayer(): normally the MapLibre layer, restyled
   * to basemapStyleUrl on each theme switch; the Voyager raster instead when
   * MapLibre can't run. */
  private glLayer: MaplibreGL | null = null;
  private rasterLayer: Layer | null = null;
  private basemapStyleUrl = LIGHT_STYLE_URL;
  private basemapLoading = false;
  private readonly pinIconCache = new Map<string, DivIcon>();
  private readonly moveEnd$ = new Subject<void>();
  /** The in-flight getMapEvents call, cancelled when a newer one starts so a
   * slow response for an old viewport can't overwrite the current pins. */
  private eventsRequest: Subscription | null = null;
  /** Live/not-live state of every visible pin as of the last drawMarkers()
   * call — lets the pulse timer skip the marker sync on ticks where nothing
   * actually crossed the live threshold. */
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

    // Sync the markers whenever the style filter, the fetched events, or the
    // selected pin (which needs its own highlighted icon) change.
    effect(() => {
      this.filteredEvents();
      this.selectedEvent();
      this.drawMarkers();
    });

    // Swap the basemap when the visitor flips the theme in the sidebar. A
    // no-op until initMap() has built the map, which applies it itself.
    effect(() => {
      void this.showBaseLayer(this.themeService.theme());
    });

    // The card's countdown and the pins' live pulse depend on the clock, not
    // just on the data — an event can go live with the events list untouched.
    if (this.isBrowser) {
      interval(PULSE_REFRESH_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.now.set(Date.now());
          if (this.pulseSignature() !== this.markerPulseSignature) this.drawMarkers();
        });
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;

    // Dynamic import: leaflet touches `window` at module load time, which
    // doesn't exist during SSR. Leaflet is CJS/UMD, not real ESM: esbuild's
    // production bundle can synthesize a namespace that only has the module
    // under `.default` instead of spreading it onto the namespace itself
    // (works either way in dev, breaks silently in the optimized prod build).
    const leafletModule = await import('leaflet');
    // Page left while Leaflet loaded: ngOnDestroy has already run, so a map
    // built now would never be removed.
    if (this.destroyRef.destroyed) return;
    this.leaflet = 'map' in leafletModule ? leafletModule : (leafletModule as unknown as { default: typeof leafletModule }).default;
    this.initMap(this.leaflet);
  }

  ngOnDestroy(): void {
    this.map?.remove();
    // Nulled so a basemap still loading (see showBaseLayer) sees the page is gone.
    this.map = null;
  }

  private initMap(L: typeof import('leaflet')): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    // Scroll-wheel and pinch zoom stay on; the on-screen +/- control is
    // redundant with those and was competing for corner space with our own UI.
    // Falls back to DEFAULT_CENTER/DEFAULT_ZOOM the first time this page is
    // ever visited in the session — mapViewState only has something once a
    // previous MapPage instance has actually panned/zoomed.
    // maxZoom on the map itself: Leaflet otherwise takes it from the tile
    // layers, and the dark (vector) basemap declares none — so without this
    // the dark theme could zoom in forever, the light one stopping at 20.
    const map = L.map(container, { zoomControl: false, maxZoom: 20 }).setView(
      this.mapViewState.center ?? DEFAULT_CENTER,
      this.mapViewState.zoom ?? DEFAULT_ZOOM,
    );
    this.map = map;

    // Minimal attribution: OpenStreetMap — the data behind every basemap
    // layer — credited once here, so each layer only adds its own short
    // "© CARTO" / "© OpenMapTiles" and nothing is repeated when two are on at
    // once. Leaflet's own prefix (with its flag) stays as it is.
    map.attributionControl.addAttribution(OSM_ATTRIBUTION);

    void this.showBaseLayer(this.themeService.theme());

    map.on('moveend', () => {
      const center = map.getCenter();
      this.mapViewState.center = [center.lat, center.lng];
      this.mapViewState.zoom = map.getZoom();
      this.moveEnd$.next();
    });
    this.fetchEventsInView();
  }

  /** Puts the basemap for `theme` on the map: one MapLibre layer, created on
   * first use (MapLibre itself loads lazily) and then just restyled on a theme
   * switch — same tiles, only the colours change, so the switch is instant and
   * downloads nothing new. Without WebGL (see supportsWebGL), or if MapLibre
   * fails to load, CARTO Voyager's raster stands in for both themes rather than
   * leaving the map blank. */
  private async showBaseLayer(theme: Theme): Promise<void> {
    const L = this.leaflet;
    if (!L || !this.map) return;
    this.basemapStyleUrl = theme === 'dark' ? DARK_STYLE_URL : LIGHT_STYLE_URL;

    if (this.glLayer) {
      this.glLayer.getMaplibreMap().setStyle(this.basemapStyleUrl);
      return;
    }
    // Already on the raster fallback (one look for both themes), or MapLibre
    // is still loading — it picks up basemapStyleUrl once it's in.
    if (this.rasterLayer || this.basemapLoading) return;

    this.basemapLoading = true;
    try {
      if (!supportsWebGL()) throw new Error('WebGL unavailable');
      const styleUrl = this.basemapStyleUrl;
      const layer = await this.createGlLayer(styleUrl);
      if (!this.map) return; // page left meanwhile
      this.glLayer = layer.addTo(this.map);
      // The theme may have flipped while MapLibre loaded.
      if (this.basemapStyleUrl !== styleUrl) this.glLayer.getMaplibreMap().setStyle(this.basemapStyleUrl);
    } catch (err) {
      if (!this.map) return;
      console.warn('Vector basemap unavailable, falling back to raster tiles', err);
      this.rasterLayer = this.createRasterLayer(L).addTo(this.map);
    } finally {
      this.basemapLoading = false;
    }
  }

  /** Fallback basemap for browsers without WebGL. CARTO Voyager: the look
   * light.json is modelled on. Needs an API key (carto.com/basemaps/apikey);
   * free up to 1M tile requests a month for commercial use (5M
   * non-commercial) under CARTO's terms of 23 September 2026 — plenty for the
   * few visitors who end up here. */
  private createRasterLayer(L: typeof import('leaflet')): Layer {
    return L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${environment.cartoApiKey}`,
      {
        attribution: '© <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
        maxZoom: 20,
        subdomains: 'abcd',
      },
    );
  }

  /** Vector basemap drawn by MapLibre inside Leaflet's tile pane (markers stay
   * above it), via @maplibre/maplibre-gl-leaflet. Its attribution
   * ("© OpenMapTiles") comes from the style's own source. */
  private async createGlLayer(style: string): Promise<MaplibreGL> {
    const { maplibreGL } = await import('@maplibre/maplibre-gl-leaflet');
    return maplibreGL({ style });
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

    this.eventsRequest?.unsubscribe();
    this.eventsRequest = this.eventsService
      .getMapEvents(box, this.selectedCityId() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (events) => {
          this.events.set(events);
          this.loading.set(false);
          this.restoreSelectedEvent(events);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  /** Reopens the card for the pin that was selected before navigating away
  (e.g. to /evento/:id) — see mapViewState. Deliberately NOT consumed/nulled
  out here: navigating back can momentarily spin up two MapPage instances
  in a row (router/view-transition quirk, still under investigation), and
  the second one needs the id to still be there since the first's restore
  gets wiped out when it's torn down. Only selectEvent()/closeDetail() ever
  change it after that. Re-running this on every subsequent pan is cheap —
  the already-selected check below skips re-fetching toggle state for a
  pin that's already open, so it only actually does anything right after a
  fresh MapPage instance mounts. */
  private restoreSelectedEvent(events: EventCardDto[]): void {
    const id = this.mapViewState.selectedEventId;
    if (!id || this.selectedEvent()?.id === id) return;

    const match = events.find((event) => event.id === id);
    if (!match) return;

    this.selectedEvent.set(match);
    this.engagement.sync(match.id);
  }

  /** Syncs the markers with filteredEvents(): pins already on the map stay put
  and only get a new icon when their live/selected state changed, and only
  events that appeared or went away are added/removed. Rebuilding every
  marker instead restarted every live pin's pulse animation on each
  selection, pan (the refetch returns mostly the same events) or like. Icons
  come from pinIconCache, so an unchanged state is the very same object. */
  private drawMarkers(): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    const selectedId = this.selectedEvent()?.id;
    const previous = this.markers;
    this.markers = new Map();
    let signature = '';
    for (const event of this.filteredEvents()) {
      const live = this.isLive(event);
      signature += live ? '1' : '0';
      const icon = this.getPinIcon(L, event.eventType, live, event.id === selectedId);
      const existing = previous.get(event.id);
      if (existing) {
        previous.delete(event.id);
        existing.event = event;
        if (existing.marker.options.icon !== icon) existing.marker.setIcon(icon);
        const { lat, lng } = existing.marker.getLatLng();
        if (lat !== event.latitude || lng !== event.longitude) existing.marker.setLatLng([event.latitude, event.longitude]);
        this.markers.set(event.id, existing);
      } else {
        const marker = L.marker([event.latitude, event.longitude], { icon }).addTo(map);
        const entry = { marker, event };
        marker.on('click', () => this.selectEvent(entry.event, marker.getLatLng()));
        this.markers.set(event.id, entry);
      }
    }
    previous.forEach(({ marker }) => marker.remove());
    this.markerPulseSignature = signature;
  }

  /** One char per visible event (1 = live, 0 = not) — cheap way to tell the
  pulse timer whether a sync is actually needed. Built the same way as the one
  drawMarkers() stores. */
  private pulseSignature(): string {
    return this.filteredEvents()
      .map((event) => (this.isLive(event) ? '1' : '0'))
      .join('');
  }

  /** Pins pulse only once the event is actually underway — before that
  (even "starting soon") the pin just sits there plain, no animation.
  Reads Date.now() rather than the `now` signal on purpose: drawMarkers()
  runs inside an effect, which would otherwise track `now` and resync every
  pin on every tick. */
  private isLive(event: EventCardDto): boolean {
    return isLiveAt(event, Date.now());
  }

  private selectEvent(event: EventCardDto, position: LatLng): void {
    this.selectedEvent.set(event);
    this.mapViewState.selectedEventId = event.id;
    this.centerOn(position);
    this.engagement.sync(event.id);
  }

  /** Pans (doesn't zoom) so the pin lands higher in the viewport rather than
  dead centre, keeping it clear of the event card docked along the bottom
  edge (see event-map-card.html) once it opens. */
  private centerOn(position: LatLng): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    const size = map.getSize();
    const targetPoint = L.point(size.x / 2, size.y * SELECTED_PIN_VERTICAL_RATIO);
    map.panBy(map.latLngToContainerPoint(position).subtract(targetPoint), { animate: true });
  }

  private getPinIcon(
    L: typeof import('leaflet'),
    eventType: EventType,
    live: boolean,
    selected: boolean,
  ): DivIcon {
    const cacheKey = `${eventType}:${live ? 'live' : 'idle'}:${selected ? 'selected' : 'idle'}`;
    const cached = this.pinIconCache.get(cacheKey);
    if (cached) return cached;

    const color = PIN_COLORS[eventType];
    const liveClass = live ? ' map-pin-wrap--live' : '';
    const selectedClass = selected ? ' map-pin-wrap--selected' : '';
    // The ring only ever animates on live pins, so the others don't carry it.
    const pulseRing = live ? `<span class="map-pin-pulse" style="background:${color}"></span>` : '';
    // Selected pin is drawn inverted (white body, outline and glyph in the type
    // colour): the one hollow pin among filled ones stands out on both basemaps
    // and still reads as its type.
    const shapeAttrs = selected
      ? `fill="#fff" stroke="${color}" stroke-width="2" stroke-linejoin="round"`
      : `fill="${color}"`;
    const glyphFill = selected ? color : '#fff';
    const icon = L.divIcon({
      className: 'map-pin',
      html: `<span class="map-pin-wrap${liveClass}${selectedClass}" style="color:${color}">
        ${pulseRing}
        <svg viewBox="0 0 24 32" width="24" height="32" xmlns="http://www.w3.org/2000/svg">
          <path d="${PIN_SHAPES[eventType]}" ${shapeAttrs}/>
          <path d="${PIN_GLYPHS[eventType]}" fill="${glyphFill}"/>
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

  protected toggleLegend(): void {
    const willOpen = !this.legendOpen();
    this.legendOpen.set(willOpen);
    if (willOpen) {
      this.filtersOpen.set(false);
    }
  }

  protected closeDetail(): void {
    this.selectedEvent.set(null);
    this.mapViewState.selectedEventId = null;
  }

  /** Signed out, the engagement service refuses the toggle and the login
  dialog opens instead. */
  protected toggleGoing(event: EventCardDto): void {
    const handled = this.engagement.toggleGoing(event.id, (delta) =>
      this.adjustCount(event.id, 'goingCount', delta),
    );
    if (!handled) this.authOpen.set(true);
  }

  protected toggleLike(event: EventCardDto): void {
    const handled = this.engagement.toggleLike(event.id, (delta) =>
      this.adjustCount(event.id, 'likesCount', delta),
    );
    if (!handled) this.authOpen.set(true);
  }

  /** Optimistic +1/-1 on a displayed count field (likes or going), applied to
  both the events list and the open card so the UI updates instantly without
  a getMapEvents refetch. The card is updated on its own, not from the list:
  after a pan its event may no longer be among the fetched ones. Reversed by
  EventEngagementService's rollback on request failure. */
  private adjustCount(eventId: string, field: 'likesCount' | 'goingCount', delta: number): void {
    const bump = (event: EventCardDto): EventCardDto => ({
      ...event,
      [field]: Math.max(0, event[field] + delta),
    });

    this.events.update((events) =>
      events.map((event) => (event.id === eventId ? bump(event) : event)),
    );

    const selected = this.selectedEvent();
    if (selected?.id === eventId) this.selectedEvent.set(bump(selected));
  }
}
