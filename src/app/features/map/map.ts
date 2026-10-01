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
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, debounceTime, interval } from 'rxjs';
import type { DivIcon, LatLng, Layer, Map as LeafletMap, MaplibreGL, Marker } from 'leaflet';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { VenuesService } from '../../core/services/venues.service';
import { CitiesService } from '../../core/services/cities.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { EventEngagementService } from '../../core/services/event-engagement.service';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { KeepAliveHooks } from '../../core/routing/keep-alive-reuse.strategy';
import { EventCardDto, EventType } from '../../core/models/event.model';
import { VenueMapPinDto, VenueType } from '../../core/models/venue.model';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { isLiveAt } from '../../core/utils/event-format';
import { supportsWebGL } from '../../core/utils/webgl';
import { environment } from '../../../environments/environment';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventMapCard } from './event-map-card/event-map-card';
import { MapFilters, MapLayer } from './map-filters/map-filters';
import {
  EVENT_TYPE_LABELS,
  MILAN_CENTER,
  MILAN_DEFAULT_ZOOM,
  PIN_COLORS,
  PIN_GLYPHS,
  PIN_SHAPES,
  PIN_TYPES,
  VENUE_PIN_COLORS,
  VENUE_PIN_GLYPHS,
  VENUE_TYPE_LABELS,
  VENUE_TYPES,
} from '../../core/config/map-pins';
import { MAP_STYLE_URLS } from '../../core/config/map-styles';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
const DEFAULT_CENTER = MILAN_CENTER;
const DEFAULT_ZOOM = MILAN_DEFAULT_ZOOM;

/** Waits for panning/zooming to settle before hitting the API, so a burst of
 * scroll-wheel zoom steps triggers one request instead of one per step. */
const MOVE_DEBOUNCE_MS = 400;

/** Re-evaluates pin pulse state on a timer, since an event can tip into
 * "live" purely by the clock ticking, with no new fetch and ticks the
 * `now` signal the event card's LIVE badge and "Inizia tra X min" countdown
 * read. */
const PULSE_REFRESH_MS = 30 * 1000;

/** Fraction of the map's height at which a selected pin should sit once
 * centred high enough on the screen that the event card docked along the
 * bottom (see event-map-card.html) never covers it. */
const SELECTED_PIN_VERTICAL_RATIO = 0.32;

/** Venue badges sit under every event pin: when a place hosts an event right
 * now, the event is what the visitor should be able to tap. */
const VENUE_PIN_Z_OFFSET = -1000;
const VENUE_PIN_SIZE = 20;

/** "Intorno a me": GPS on phones (desktop falls back to Wi-Fi/IP, so the fix
 * can be off by hundreds of metres the accuracy circle shows how much), a
 * reading up to a minute old is fine, and past 10s we give up and say so. */
const LOCATE_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 };
/** A real GPS fix (a few to ~100 m on phones) gets its accuracy circle and a
 * zoom that fits it, capped at LOCATE_MAX_ZOOM. Past LOCATE_CIRCLE_MAX_METERS the
 * fix is Wi-Fi/IP guesswork (desktops: often several km, bigger than the whole
 * city): no circle, just the dot at city zoom and a note saying it's rough.
 * The cap is 14, not street level: a couple of km around the visitor is what
 * "events near me" needs, and it's the last zoom served by the light z13 vector
 * tiles (~125 KB each) — from 15 up MapLibre switches to z14 tiles, ~3x
 * heavier, mostly POIs this style never draws. Closer is one pinch away. */
const LOCATE_MAX_ZOOM = 14;
const LOCATE_APPROX_ZOOM = 13;
const LOCATE_CIRCLE_MAX_METERS = 1000;
const LOCATE_MESSAGE_MS = 5000;
/** The classic "you are here" blue, outside the pin palette on purpose. */
const USER_LOCATION_COLOR = '#3b82f6';

/** The app only covers Italy: panning is kept to it (plus a margin, so the
 * coast and the borders never sit flush with the screen edge) and zooming out
 * stops once the whole country fits a phone. Without this, dragging or
 * zooming far away downloaded basemap tiles for places with no events at all. */
const MAP_BOUNDS: [[number, number], [number, number]] = [
  [35.0, 5.5],
  [47.8, 19.5],
];
const MAP_MIN_ZOOM = 5;

/** The shortest credit OpenStreetMap's attribution guidelines accept, linked
 * to their copyright page required under the ODbL for every basemap here. */
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

@Component({
  selector: 'app-map',
  imports: [SidebarPushDirective, AuthModal, EventMapCard, MapFilters],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class MapPage implements AfterViewInit, OnDestroy, KeepAliveHooks {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly destroyRef = inject(DestroyRef);

  private readonly eventsService = inject(EventsService);
  private readonly venuesService = inject(VenuesService);
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

  /** True when the backend hit its limit and some far-off events may be missing. */
  protected readonly truncated = signal(false);

  /** What the map shows, picked under "Mostra" in the filters: events (the
   * default), places only, or both. Venue pins are only fetched once a layer
   * that includes them is picked; with places only, events aren't fetched at all. */
  protected readonly mapLayer = signal<MapLayer>('events');
  protected readonly showEvents = computed(() => this.mapLayer() !== 'venues');
  protected readonly showVenues = computed(() => this.mapLayer() !== 'events');
  protected readonly venuesError = signal(false);
  /** Venues are fixed places, so each city is fetched once per page lifetime
   * and kept here — panning or switching layers again never refetches. */
  private readonly venuesByCity = signal<ReadonlyMap<number, VenueMapPinDto[]>>(new Map());
  /** Cities whose venues are in flight, so a quick switch doesn't double-fetch. */
  private readonly venueRequests = signal<ReadonlySet<number>>(new Set());
  protected readonly venuesLoading = computed(() => this.venueRequests().size > 0);

  /** The selected city, or with "Tutte" every active one the venues API is per city. */
  private readonly venueCityIds = computed(() => {
    const cityId = this.selectedCityId();
    return cityId !== null ? [cityId] : this.cities().map((city) => city.id);
  });

  /** "Intorno a me" in progress the button shows a spinner meanwhile. */
  protected readonly locating = signal(false);
  /** Why the last "Intorno a me" failed, or that its fix is only approximate
   * shown briefly over the map. */
  protected readonly locateMessage = signal<string | null>(null);

  protected readonly visibleVenues = computed(() => {
    if (!this.showVenues()) return [];
    const byCity = this.venuesByCity();
    return this.venueCityIds().flatMap((cityId) => byCity.get(cityId) ?? []);
  });

  /** Clock for the event card's LIVE badge and countdown, ticked by the
   * pulse timer the app is zoneless, so nothing else would re-render the
   * card while time moves on. */
  protected readonly now = signal(Date.now());

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace both require a session server-side. */
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
   * event-map-card.html), which would otherwise sit under or behind the Filtri/
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

  /** The venue badges, listed in the legend only while their layer is on. */
  protected readonly venueLegendItems = VENUE_TYPES.map((type) => ({
    type,
    label: VENUE_TYPE_LABELS[type],
    color: VENUE_PIN_COLORS[type],
    glyph: VENUE_PIN_GLYPHS[type],
  }));

  protected readonly filteredEvents = computed(() => {
    if (!this.showEvents()) return [];
    const styles = this.selectedStyleNames();
    const list = this.events();
    if (styles.size === 0) return list;
    return list.filter((event) => event.danceStyles.some((style) => styles.has(style)));
  });

  private map: LeafletMap | null = null;
  /** One marker per visible event, by id see drawMarkers(). `event` is
  refreshed on every sync, so a click never opens the card with a stale copy
  (e.g. the counts from before a like). */
  private markers = new Map<string, { marker: Marker; event: EventCardDto }>();
  /** One marker per visible venue, by id — see drawVenueMarkers(). */
  private venueMarkers = new Map<string, Marker>();
  private readonly venuePinIconCache = new Map<VenueType, DivIcon>();
  /** The "you are here" dot plus its accuracy circle, replaced on each locate. */
  private userLocationLayer: Layer | null = null;
  private locateMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private leaflet: typeof import('leaflet') | null = null;
  /** The basemap see showBaseLayer(): normally the MapLibre layer, restyled
   * to basemapStyleUrl on each theme switch; the Voyager raster instead when
   * MapLibre can't run. */
  private glLayer: MaplibreGL | null = null;
  private rasterLayer: Layer | null = null;
  private basemapStyleUrl = MAP_STYLE_URLS.light;
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
  /** False while the page sits detached on another route see
   * onRouteDetached(). */
  private onScreen = true;

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

      // Tailwind's sm: breakpoint kept in sync via matchMedia rather than
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

    // Venue layer on: fetch whichever of the needed cities isn't cached yet
    // (the selected one, or all of them under "Tutte"). untracked so the
    // cache filling up doesn't re-run this for nothing.
    effect(() => {
      if (!this.showVenues()) return;
      const cityIds = this.venueCityIds();
      untracked(() => this.loadVenues(cityIds));
    });

    effect(() => {
      this.visibleVenues();
      this.drawVenueMarkers();
    });

    // Swap the basemap when the visitor flips the theme in the sidebar. A
    // no-op until initMap() has built the map, which applies it itself.
    effect(() => {
      void this.showBaseLayer(this.themeService.theme());
    });

    // The card's countdown and the pins' live pulse depend on the clock, not
    // just on the data an event can go live with the events list untouched.
    if (this.isBrowser) {
      interval(PULSE_REFRESH_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (!this.onScreen) return;
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
    if (this.locateMessageTimer) clearTimeout(this.locateMessageTimer);
    this.map?.remove();
    // Nulled so a basemap still loading (see showBaseLayer) sees the page is gone.
    this.map = null;
  }

  /** Leaving /mappa doesn't destroy this page: KeepAliveReuseStrategy
   * detaches it, Leaflet and MapLibre (WebGL context, loaded style and tiles)
   * included, so coming back shows the map as it was instead of an empty one
   * while the basemap rebuilds. Until then, the clock and the moveend
   * handler stand down. */
  onRouteDetached(): void {
    this.onScreen = false;
  }

  /** Back on screen: resync what may have changed meanwhile the container's
   * size, the view and open pin (openOnMap on an event's page rewrites both
   * in mapViewState), and the events themselves (a like or Parteciperò on the
   * event's page, which keeps its own copy of that state). The theme needs
   * nothing here: its effect runs as soon as the view is checked again. */
  onRouteAttached(): void {
    const map = this.map;
    if (map) {
      // Still flagged off screen, so any moveend these fire is ignored the
      // fetch below replaces it.
      map.invalidateSize();
      const { center, zoom } = this.mapViewState;
      if (center && zoom !== null && (!map.getCenter().equals(center) || map.getZoom() !== zoom)) {
        map.setView(center, zoom, { animate: false });
      }
      this.glLayer?.getMaplibreMap().triggerRepaint();
    }
    this.onScreen = true;
    if (!map) return; // left before Leaflet loaded: initMap() does all of this itself

    this.now.set(Date.now());
    const selectedId = this.mapViewState.selectedEventId;
    // Opened on the map from an event's page (openOnMap) while only places
    // were showing: bring events back, or that pin could never open.
    if (selectedId && !this.showEvents()) this.mapLayer.set('both');
    if (this.selectedEvent()?.id === selectedId) {
      if (selectedId) this.engagement.sync(selectedId);
    } else {
      this.selectedEvent.set(null);
      this.restoreSelectedEvent(this.events());
    }
    this.fetchEventsInView();
  }

  private initMap(L: typeof import('leaflet')): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    // Scroll-wheel and pinch zoom stay on; the on-screen +/- control is
    // redundant with those and was competing for corner space with our own UI.
    // Falls back to DEFAULT_CENTER/DEFAULT_ZOOM the first time this page is
    // ever visited in the session mapViewState only has something once a
    // previous MapPage instance has actually panned/zoomed.
    // maxZoom on the map itself: Leaflet otherwise takes it from the tile
    // layers, and the dark (vector) basemap declares none so without this
    // the dark theme could zoom in forever, the light one stopping at 20.
    // minZoom/maxBounds: Italy only, see MAP_BOUNDS. Viscosity 1 makes the
    // edge solid instead of letting the map be dragged past it and spring back.
    const map = L.map(container, {
      zoomControl: false,
      maxZoom: 20,
      minZoom: MAP_MIN_ZOOM,
      maxBounds: MAP_BOUNDS,
      maxBoundsViscosity: 1,
    }).setView(
      this.mapViewState.center ?? DEFAULT_CENTER,
      this.mapViewState.zoom ?? DEFAULT_ZOOM,
    );
    this.map = map;

    // Minimal attribution: OpenStreetMap the data behind every basemap
    // layer credited once here, so each layer only adds its own short
    // "© CARTO" / "© OpenMapTiles" and nothing is repeated when two are on at
    // once. Leaflet's own prefix (with its flag) stays as it is.
    map.attributionControl.addAttribution(OSM_ATTRIBUTION);

    void this.showBaseLayer(this.themeService.theme());

    map.on('moveend', () => {
      // Detached, the container is out of the DOM and a window resize makes
      // Leaflet measure it as 0×0 — neither that view nor its bounds are real.
      if (!this.onScreen) return;
      const center = map.getCenter();
      this.mapViewState.center = [center.lat, center.lng];
      this.mapViewState.zoom = map.getZoom();
      this.moveEnd$.next();
    });
    this.fetchEventsInView();
    // The layer may have been switched on while Leaflet was still loading.
    this.drawVenueMarkers();
  }

  /** Puts the basemap for `theme` on the map: one MapLibre layer, created on
   * first use (MapLibre itself loads lazily) and then just restyled on a theme
   * switch same tiles, only the colours change, so the switch is instant and
   * downloads nothing new. Without WebGL (see supportsWebGL), or if MapLibre
   * fails to load, CARTO Voyager's raster stands in for both themes rather than
   * leaving the map blank. */
  private async showBaseLayer(theme: Theme): Promise<void> {
    const L = this.leaflet;
    if (!L || !this.map) return;
    this.basemapStyleUrl = MAP_STYLE_URLS[theme];

    if (this.glLayer) {
      this.glLayer.getMaplibreMap().setStyle(this.basemapStyleUrl);
      return;
    }
    // Already on the raster fallback (one look for both themes), or MapLibre
    // is still loading it picks up basemapStyleUrl once it's in.
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
   * non-commercial) under CARTO's terms of 23 September 2026 plenty for the
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
    // Places only: no event pins to show, so no request on every pan either.
    if (!this.map || !this.showEvents()) return;

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
        next: ({ events, truncated }) => {
          this.events.set(events);
          this.truncated.set(truncated);
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
  (e.g. to /evento/:id) see mapViewState. Deliberately NOT consumed/nulled
  out here: navigating back can momentarily spin up two MapPage instances
  in a row (router/view-transition quirk, still under investigation), and
  the second one needs the id to still be there since the first's restore
  gets wiped out when it's torn down. Only selectEvent()/closeDetail() ever
  change it after that (and openOnMap on an event's page, see
  onRouteAttached). Re-running this on every subsequent pan is cheap for a
  pin that's already open it only swaps in the fresh copy (so the card's
  counts follow the server, e.g. after a like on the event's page) and skips
  re-fetching toggle state. */
  private restoreSelectedEvent(events: EventCardDto[]): void {
    const id = this.mapViewState.selectedEventId;
    if (!id) return;

    const match = events.find((event) => event.id === id);
    if (!match) return;

    const alreadyOpen = this.selectedEvent()?.id === id;
    this.selectedEvent.set(match);
    if (!alreadyOpen) this.engagement.sync(match.id);
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

  /** One char per visible event (1 = live, 0 = not) cheap way to tell the
  pulse timer whether a sync is actually needed. Built the same way as the one
  drawMarkers() stores. */
  private pulseSignature(): string {
    return this.filteredEvents()
      .map((event) => (this.isLive(event) ? '1' : '0'))
      .join('');
  }

  /** Pins pulse only once the event is actually underway before that
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

  /** Fetches the venues of each city in `cityIds` that isn't cached or
  already in flight. A failed city stays uncached, so going back to "Eventi"
  and picking a places layer again retries it. */
  private loadVenues(cityIds: number[]): void {
    for (const cityId of cityIds) {
      if (this.venuesByCity().has(cityId) || this.venueRequests().has(cityId)) continue;

      this.venueRequests.update((pending) => new Set(pending).add(cityId));
      const done = () =>
        this.venueRequests.update((pending) => {
          const next = new Set(pending);
          next.delete(cityId);
          return next;
        });
      this.venuesService
        .getMapVenues(cityId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (venues) => {
            done();
            this.venuesByCity.update((byCity) => new Map(byCity).set(cityId, venues));
          },
          error: () => {
            done();
            this.venuesError.set(true);
          },
        });
    }
  }

  /** Syncs the venue badges with visibleVenues(), same idea as drawMarkers():
  badges already on the map stay put, only venues that appeared or went away
  (layer toggled, city changed) are added/removed. */
  private drawVenueMarkers(): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    const previous = this.venueMarkers;
    this.venueMarkers = new Map();
    for (const venue of this.visibleVenues()) {
      const existing = previous.get(venue.id);
      if (existing) {
        previous.delete(venue.id);
        this.venueMarkers.set(venue.id, existing);
        continue;
      }
      const marker = L.marker([venue.latitude, venue.longitude], {
        icon: this.getVenuePinIcon(L, venue.type),
        zIndexOffset: VENUE_PIN_Z_OFFSET,
        title: venue.name,
      })
        .bindPopup(() => this.buildVenuePopup(venue), { className: 'venue-popup', closeButton: false })
        .addTo(map);
      this.venueMarkers.set(venue.id, marker);
    }
    previous.forEach((marker) => marker.remove());
  }

  /** Round badge in the type's colour with its glyph see VENUE_PIN_COLORS. */
  private getVenuePinIcon(L: typeof import('leaflet'), type: VenueType): DivIcon {
    const cached = this.venuePinIconCache.get(type);
    if (cached) return cached;

    const half = VENUE_PIN_SIZE / 2;
    const icon = L.divIcon({
      className: 'venue-pin',
      html: `<svg viewBox="0 0 24 24" width="${VENUE_PIN_SIZE}" height="${VENUE_PIN_SIZE}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="${VENUE_PIN_COLORS[type]}" stroke="#fff" stroke-width="2"/>
        <path d="${VENUE_PIN_GLYPHS[type]}" fill="#fff"/>
      </svg>`,
      iconSize: [VENUE_PIN_SIZE, VENUE_PIN_SIZE],
      iconAnchor: [half, half],
      popupAnchor: [0, -half],
    });

    this.venuePinIconCache.set(type, icon);
    return icon;
  }

  /** Popup body built from DOM nodes with textContent, never innerHTML: venue
  names and addresses are free text from the backend. Styled globally in
  styles.css (.venue-popup), since Leaflet renders popups outside Angular's view. */
  private buildVenuePopup(venue: VenueMapPinDto): HTMLElement {
    const body = document.createElement('div');
    body.className = 'venue-popup-body';

    const type = document.createElement('span');
    type.className = 'venue-popup-type';
    const dot = document.createElement('span');
    dot.className = 'venue-popup-dot';
    dot.style.background = VENUE_PIN_COLORS[venue.type];
    type.append(dot, VENUE_TYPE_LABELS[venue.type]);

    const name = document.createElement('strong');
    name.className = 'venue-popup-name';
    name.textContent = venue.name;

    const address = document.createElement('span');
    address.className = 'venue-popup-address';
    address.textContent = venue.address;

    body.append(type, name, address);
    return body;
  }

  /** "Intorno a me". Only ever asked from this tap, never on page load:
  browsers penalise permission prompts nobody asked for, and visitors tend to
  refuse them. The position never leaves the browser it only moves the map,
  and the events for the new area come from the usual bounding-box fetch. */
  protected locateMe(): void {
    if (!this.isBrowser || this.locating()) return;

    if (!window.isSecureContext) {
      // Plain http (e.g. the dev server opened by LAN IP from a phone): the
      // browser refuses geolocation outright, so say why instead of "denied".
      this.showLocateMessage('La posizione richiede una connessione sicura (HTTPS).');
      return;
    }
    if (!('geolocation' in navigator)) {
      this.showLocateMessage('Questo browser non supporta la geolocalizzazione.');
      return;
    }

    this.locating.set(true);
    this.clearLocateMessage();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        this.showUserPosition(position.coords);
      },
      (error) => {
        this.locating.set(false);
        this.showLocateMessage(this.locateErrorMessage(error));
      },
      LOCATE_OPTIONS,
    );
  }

  private locateErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Posizione non autorizzata: attivala nelle impostazioni del browser.';
      case error.TIMEOUT:
        return 'La posizione sta impiegando troppo, riprova.';
      default:
        return 'Impossibile trovare la tua posizione.';
    }
  }

  /** Drops the "you are here" dot at `coords` (plus its accuracy circle when
  the fix is precise enough to be worth drawing see LOCATE_CIRCLE_MAX_METERS),
  then moves the map there which fires moveend, so the events around the
  visitor load like after any pan. */
  private showUserPosition(coords: GeolocationCoordinates): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    const position = L.latLng(coords.latitude, coords.longitude);
    // Outside MAP_BOUNDS the map couldn't pan there anyway (it would stop at
    // the edge with the dot off screen), so say why instead.
    if (!L.latLngBounds(MAP_BOUNDS).contains(position)) {
      this.userLocationLayer?.remove();
      this.userLocationLayer = null;
      this.showLocateMessage('Per ora la mappa copre solo l’Italia.');
      return;
    }

    const precise = coords.accuracy <= LOCATE_CIRCLE_MAX_METERS;
    const dot = L.marker(position, {
      icon: L.divIcon({
        className: 'user-location',
        html: '<span class="user-location-dot"></span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    });

    const layers: Layer[] = [dot];
    if (precise) {
      layers.unshift(
        L.circle(position, {
          radius: coords.accuracy,
          stroke: false,
          fillColor: USER_LOCATION_COLOR,
          fillOpacity: 0.15,
          interactive: false,
        }),
      );
    }
    this.userLocationLayer?.remove();
    this.userLocationLayer = L.layerGroup(layers).addTo(map);

    if (precise) {
      // toBounds takes the square's side, so twice the radius: the whole circle fits.
      map.fitBounds(position.toBounds(coords.accuracy * 2), { maxZoom: LOCATE_MAX_ZOOM });
    } else {
      map.setView(position, LOCATE_APPROX_ZOOM);
      const km = Math.round(coords.accuracy / 1000);
      this.showLocateMessage(`Posizione approssimativa (±${km} km): sul telefono, con il GPS, è molto più precisa.`);
    }
  }

  private showLocateMessage(message: string): void {
    this.clearLocateMessage();
    this.locateMessage.set(message);
    this.locateMessageTimer = setTimeout(() => this.locateMessage.set(null), LOCATE_MESSAGE_MS);
  }

  private clearLocateMessage(): void {
    if (this.locateMessageTimer) clearTimeout(this.locateMessageTimer);
    this.locateMessageTimer = null;
    this.locateMessage.set(null);
  }

  protected selectLayer(layer: MapLayer): void {
    if (layer === this.mapLayer()) return;
    const hadEvents = this.showEvents();
    const hadVenues = this.showVenues();
    this.mapLayer.set(layer);

    // Places switched on afresh: the error line only reflects this attempt's fetches.
    if (!hadVenues && this.showVenues()) this.venuesError.set(false);

    if (!this.showEvents()) {
      // Events hidden: drop any in-flight fetch and the open event card.
      this.eventsRequest?.unsubscribe();
      this.loading.set(false);
      this.closeDetail();
    } else if (!hadEvents) {
      // Back from places only: the list is stale (no fetch while hidden).
      this.fetchEventsInView();
    }
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
