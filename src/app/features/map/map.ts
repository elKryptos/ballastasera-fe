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
import { Subscription, interval } from 'rxjs';
import type { LatLng, LatLngBounds, Layer, Map as LeafletMap, MaplibreGL, Marker } from 'leaflet';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { VenuesService } from '../../core/services/venues.service';
import { CitiesService } from '../../core/services/cities.service';
import { CityEventsService } from '../../core/services/city-events.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { EventEngagementService } from '../../core/services/event-engagement.service';
import { EventFiltersService } from '../../core/services/event-filters.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { PRECISE_FIX_METERS, UserLocationService, UserPosition } from '../../core/services/user-location.service';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { KeepAliveHooks } from '../../core/routing/keep-alive-reuse.strategy';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { EventCardDto } from '../../core/models/event.model';
import { VenueMapPinDto } from '../../core/models/venue.model';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';
import { isLiveAt } from '../../core/utils/event-format';
import {
  compareByLiveThenStart,
  matchesEventFilters,
  nightOf,
  rangeLastNight,
} from '../../core/utils/event-filters';
import {
  boundsCenter,
  boundsContain,
  boundsEqual,
  boundsUnion,
  distanceKm,
  nearestCity,
  pointInBounds,
} from '../../core/utils/geo';
import { supportsWebGL } from '../../core/utils/webgl';
import { environment } from '../../../environments/environment';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { EventFiltersDialog } from '../../shared/event-filters/event-filters-dialog';
import { VenuePinIcon } from '../../shared/event-filters/pin-icons';
import { MILAN_CENTER, MILAN_DEFAULT_ZOOM, VENUE_TYPES, VENUE_TYPE_LABELS } from '../../core/config/map-pins';
import { MAP_STYLE_URLS } from '../../core/config/map-styles';
import { LAYER_OPTIONS, MapLayer } from './map-layer';
import { MapPinIcons } from './map-pin-icons';
import { MapSheet } from './map-sheet/map-sheet';
import { MapToolbar } from './map-toolbar/map-toolbar';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
const DEFAULT_CENTER = MILAN_CENTER;
const DEFAULT_ZOOM = MILAN_DEFAULT_ZOOM;

/** Ticks the `now` signal: the card's LIVE badge and countdowns, the pins'
 * live pulse and the day filter all depend on the clock, not just on the
 * data — an event can go live, or end, with no new fetch. */
const CLOCK_TICK_MS = 30 * 1000;

/** How far the view may stick out of the last searched area (a share of its
 * own size, per side) before "Cerca in questa zona" shows up — enough that
 * the pan centring a tapped pin doesn't trigger it. */
const SEARCH_TOLERANCE = 0.25;

/** The sheet grows to the full card once a pin is tapped, so the pin is
 * centred clear of at least this much at the bottom on phones. */
const SELECTED_CARD_MIN_PX = 300;

/** Stacking for pins close enough to overlap, on top of Leaflet's own
 * (further south = in front), which a pin's height of offset already beats:
 * venue badges under every event pin (when a place hosts an event right now,
 * the event is what the visitor should be able to tap), events in progress
 * over the other events, and the open pin or badge over everything. */
const VENUE_PIN_Z_OFFSET = -1000;
const LIVE_PIN_Z_OFFSET = 500;
const SELECTED_PIN_Z_OFFSET = 1000;

/** "Intorno a me": a real GPS fix (a few to ~100 m on phones) gets its
 * accuracy circle and a zoom that fits it, capped at LOCATE_MAX_ZOOM. Past
 * PRECISE_FIX_METERS the fix is Wi-Fi/IP guesswork (desktops: often several
 * km, bigger than the whole city): no circle, just the dot at city zoom and a
 * note saying it's rough. The cap is 14, not street level: a couple of km
 * around the visitor is what "events near me" needs, and it's the last zoom
 * served by the light z13 vector tiles (~125 KB each) — from 15 up MapLibre
 * switches to z14 tiles, ~3x heavier, mostly POIs this style never draws.
 * Closer is one pinch away. */
const LOCATE_MAX_ZOOM = 14;
const LOCATE_APPROX_ZOOM = 13;
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
 * to their copyright page — required under the ODbL for every basemap here. */
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

/** Room the floating UI takes over the map, in px from each edge — see
 * observeInsets(). */
interface MapInsets {
  top: number;
  bottom: number;
  left: number;
}

const NO_INSETS: MapInsets = { top: 0, bottom: 0, left: 0 };

function toMapBounds(bounds: LatLngBounds): MapBounds {
  return {
    minLat: bounds.getSouth(),
    maxLat: bounds.getNorth(),
    minLng: bounds.getWest(),
    maxLng: bounds.getEast(),
  };
}

/**
 * /mappa. Events are fetched for an area only when the visitor asks — the
 * first view, "Cerca in questa zona", "Intorno a me", jumping to a city —
 * never on a plain pan or zoom, which used to fire a request on every stop
 * and is what the backend (a small VPS) can't afford. Everything else (day,
 * styles, type, price) filters what's already here, client-side, through
 * EventFiltersService — shared with /lista. Venues ("Locali e scuole") are
 * fetched per city, only once their layer is switched on.
 */
@Component({
  selector: 'app-map',
  imports: [SidebarPushDirective, AuthModal, MapToolbar, MapSheet, EventFiltersDialog, VenuePinIcon],
  templateUrl: './map.html',
  styleUrl: './map.css',
  host: {
    '[style.--map-inset-top]': "insets().top + 'px'",
    '[style.--map-inset-bottom]': "insets().bottom + 'px'",
    '[style.--map-inset-left]': "insets().left + 'px'",
  },
})
export class MapPage implements AfterViewInit, OnDestroy, KeepAliveHooks {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly destroyRef = inject(DestroyRef);

  private readonly eventsService = inject(EventsService);
  private readonly venuesService = inject(VenuesService);
  private readonly citiesService = inject(CitiesService);
  private readonly cityEvents = inject(CityEventsService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly themeService = inject(ThemeService);
  private readonly userLocation = inject(UserLocationService);
  protected readonly filters = inject(EventFiltersService);
  /** Parteciperò/Mi piace state for the open card — see EventEngagementService. */
  protected readonly engagement = inject(EventEngagementService);

  protected readonly listEnabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.eventListPage);
  /** Off, the venue card has no "Vedi dettagli": /luogo/:id wouldn't match
   * and the link would land on the home page instead. */
  protected readonly venuePageEnabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.venueDetailsPage);

  private readonly mapArea = viewChild<ElementRef<HTMLDivElement>>('mapArea');
  private readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  private readonly toolbar = viewChild(MapToolbar, { read: ElementRef });
  private readonly sheet = viewChild(MapSheet, { read: ElementRef });

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);

  protected readonly events = signal<EventCardDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly selectedEvent = signal<EventCardDto | null>(null);
  /** The tapped venue badge, whose card shows in the sheet. Never set
  together with selectedEvent: opening one closes the other. Kept as is
  while away on the venue's page (keepAlive), so its card is still open on
  the way back. */
  protected readonly selectedVenue = signal<VenueMapPinDto | null>(null);

  /** True when the backend hit its limit and some events may be missing. */
  protected readonly truncated = signal(false);

  /** The area `events` covers: the bounds of the last search that came back. */
  private readonly searchedBounds = signal<MapBounds | null>(null);
  protected readonly hasSearched = computed(() => this.searchedBounds() !== null);
  /** searchedBounds plus wherever the map panned on its own to show a tapped
   * pin (centerOn): the visitor didn't go anywhere, so no "Cerca in questa
   * zona" for it. What areaStale() measures the view against. */
  private readonly settledBounds = signal<MapBounds | null>(null);
  /** What's on screen, updated on every moveend — costs no request. */
  private readonly viewBounds = signal<MapBounds | null>(null);

  /** What the map shows, picked under "Sulla mappa" in the filters: events
   * (the default), places only, or both. */
  protected readonly mapLayer = signal<MapLayer>('events');
  protected readonly showEvents = computed(() => this.mapLayer() !== 'venues');
  protected readonly showVenues = computed(() => this.mapLayer() !== 'events');
  protected readonly layerOptions = LAYER_OPTIONS;
  protected readonly venueLegend = VENUE_TYPES.map((type) => ({ type, label: VENUE_TYPE_LABELS[type] }));

  protected readonly venuesError = signal(false);
  /** Venues are fixed places, so each city is fetched once per page lifetime
   * and kept here — panning or switching layers again never refetches. */
  private readonly venuesByCity = signal<ReadonlyMap<number, VenueMapPinDto[]>>(new Map());
  /** Cities whose venues are in flight, so a quick switch doesn't double-fetch. */
  private readonly venueRequests = signal<ReadonlySet<number>>(new Set());
  protected readonly venuesLoading = computed(() => this.venueRequests().size > 0);

  /** The city the map is looking at (the nearest active one, if any is
   * close): the venues API is per city, and it's the highlighted chip under
   * "Città" in the filters. */
  protected readonly viewCity = computed(() => {
    const view = this.viewBounds();
    return view ? nearestCity(this.cities(), boundsCenter(view)) : null;
  });

  /** Every city fetched so far — they're far apart, so all can stay drawn. */
  private readonly visibleVenues = computed(() =>
    this.showVenues() ? Array.from(this.venuesByCity().values()).flat() : [],
  );

  protected readonly venuesInView = computed(() => {
    const view = this.viewBounds();
    if (!view) return 0;
    return this.visibleVenues().filter((venue) => pointInBounds(view, venue.latitude, venue.longitude)).length;
  });

  /** "Intorno a me" in progress — the button shows a spinner meanwhile. */
  protected readonly locating = this.userLocation.locating;
  /** Why the last "Intorno a me" failed, or that its fix is only approximate —
   * shown briefly over the map. */
  protected readonly locateMessage = signal<string | null>(null);

  /** The app is zoneless, so nothing else would re-render the card, or drop
   * a night that just ended, while time moves on. */
  protected readonly now = signal(Date.now());

  /** Opens the shared login dialog when a signed-out visitor taps
   * Parteciperò/Mi piace — both require a session server-side. */
  protected readonly authOpen = signal(false);
  protected readonly filtersOpen = signal(false);

  /** Tracks the md: breakpoint (768px), where the toolbar and the sheet turn
   * into a panel on the left — see observeInsets(). */
  private readonly isDesktop = signal(false);

  protected readonly insets = signal<MapInsets>(NO_INSETS, {
    equal: (a, b) => a.top === b.top && a.bottom === b.bottom && a.left === b.left,
  });

  protected readonly filteredEvents = computed(() => {
    if (!this.showEvents()) return [];
    const filters = this.filters.state();
    const now = this.now();
    return this.events().filter((event) => matchesEventFilters(event, filters, now));
  });

  /** Pins on the map: the filtered events, plus the open card's own event even
   * when a filter would hide it — opened from an event's page ("Vedi sulla
   * mappa") with another day picked, say. */
  private readonly pinnedEvents = computed(() => {
    const events = this.filteredEvents();
    const selected = this.selectedEvent();
    if (!selected || !this.showEvents() || events.some((event) => event.id === selected.id)) return events;
    return [...events, selected];
  });

  /** The filtered events inside the view, live first — the sheet's cards. */
  protected readonly eventsInView = computed(() => {
    const view = this.viewBounds();
    if (!view) return [];
    const now = this.now();
    return this.filteredEvents()
      .filter((event) => pointInBounds(view, event.latitude, event.longitude))
      .sort((a, b) => compareByLiveThenStart(a, b, now));
  });

  /** The backend caps a search (MAP_LIMIT) and returns the earliest events
   * first, so a cap only matters if the picked days reach past the last
   * night it returned — "stasera" is complete even from a capped search. */
  private readonly truncatedForRange = computed(() => {
    if (!this.truncated() || !this.showEvents()) return false;
    const lastNight = rangeLastNight(this.filters.range(), this.now());
    if (lastNight === null) return true;
    const latestStart = Math.max(...this.events().map((event) => Date.parse(event.startAt)));
    return lastNight >= nightOf(latestStart);
  });
  protected readonly showTruncatedNotice = computed(() => this.truncatedForRange() && !this.loading());

  /** "Cerca in questa zona" is worth offering: the view left the area the
   * last search covered (or zoomed in on a capped one), or — with places on —
   * it's over a city whose venues aren't here yet. Never before the first
   * search, which runs by itself. */
  protected readonly areaStale = computed(() => {
    const searched = this.searchedBounds();
    const settled = this.settledBounds();
    const view = this.viewBounds();
    if (!searched || !settled || !view) return false;

    if (this.showEvents()) {
      if (!boundsContain(settled, view, SEARCH_TOLERANCE)) return true;
      // Zoomed in on a capped result: the closer view may hold what the cap left out.
      if (this.truncatedForRange() && !boundsEqual(searched, view)) return true;
    }
    const city = this.viewCity();
    return this.showVenues() && city !== null && !this.venuesByCity().has(city.id) && !this.venueRequests().has(city.id);
  });

  protected readonly showSearchButton = computed(() => this.areaStale() || (this.loading() && this.hasSearched()));

  protected readonly selectedGoing = computed(() => {
    const event = this.selectedEvent();
    return event ? this.engagement.isGoing(event.id) : false;
  });
  protected readonly selectedLiked = computed(() => {
    const event = this.selectedEvent();
    return event ? this.engagement.isLiked(event.id) : false;
  });

  /** For whichever card is open, event or venue. */
  protected readonly selectedDistanceKm = computed(() => {
    const place = this.selectedEvent() ?? this.selectedVenue();
    const position = this.userLocation.position();
    if (!place || !position) return null;
    return distanceKm(position, { lat: place.latitude, lng: place.longitude });
  });

  /** "Mostra N serate" in the filters dialog. */
  protected readonly dialogResultCount = computed(() =>
    this.showEvents() && this.hasSearched() ? this.eventsInView().length : null,
  );

  private map: LeafletMap | null = null;
  /** One marker per pinned event, by id — see drawMarkers(). `event` is
  refreshed on every sync, so a click never opens the card with a stale copy
  (e.g. the counts from before a like). */
  private markers = new Map<string, { marker: Marker; event: EventCardDto }>();
  /** One marker per visible venue, by id — see drawVenueMarkers(). */
  private venueMarkers = new Map<string, Marker>();
  /** The "you are here" dot plus its accuracy circle, replaced on each locate. */
  private userLocationLayer: Layer | null = null;
  private locateMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private leaflet: typeof import('leaflet') | null = null;
  private pinIcons: MapPinIcons | null = null;
  /** The basemap — see showBaseLayer(): normally the MapLibre layer, restyled
   * to basemapStyleUrl on each theme switch; the Voyager raster instead when
   * MapLibre can't run. */
  private glLayer: MaplibreGL | null = null;
  private rasterLayer: Layer | null = null;
  private basemapStyleUrl = MAP_STYLE_URLS.light;
  private basemapLoading = false;
  /** The in-flight getMapEvents call, cancelled when a newer one starts so a
   * slow response for an old area can't overwrite the current pins. */
  private eventsRequest: Subscription | null = null;
  /** False while the page sits detached on another route — see
   * onRouteDetached(). */
  private onScreen = true;

  constructor() {
    // Client-only: the HTTP transfer cache isn't picking these up, so
    // fetching them during SSR too just means fetching them twice (see
    // events/Leaflet below, which already avoid this the same way). Both are
    // cached for the visit, shared with /lista.
    if (this.isBrowser) {
      this.citiesService.getCities().subscribe({
        next: (cities) => this.cities.set(cities),
        error: () => this.cities.set([]),
      });
      this.danceStylesService.getDanceStyles().subscribe({
        next: (styles) => this.danceStyles.set(styles),
        error: () => this.danceStyles.set([]),
      });

      const desktopQuery = window.matchMedia('(min-width: 768px)');
      this.isDesktop.set(desktopQuery.matches);
      const handleDesktopChange = (event: MediaQueryListEvent) => this.isDesktop.set(event.matches);
      desktopQuery.addEventListener('change', handleDesktopChange);
      this.destroyRef.onDestroy(() => desktopQuery.removeEventListener('change', handleDesktopChange));

      interval(CLOCK_TICK_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.onScreen) this.now.set(Date.now());
        });
    }

    // Sync the markers whenever the filters, the fetched events, the clock
    // (a pin turning live, a night ending) or the selected pin (which needs
    // its own highlighted icon) change. Cheap: unchanged pins are left alone.
    effect(() => {
      this.pinnedEvents();
      this.selectedEvent();
      this.drawMarkers();
    });

    effect(() => {
      this.visibleVenues();
      this.selectedVenue();
      this.drawVenueMarkers();
    });

    // Swap the basemap when the visitor flips the theme in the sidebar. A
    // no-op until initMap() has built the map, which applies it itself.
    effect(() => {
      void this.showBaseLayer(this.themeService.theme());
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser) return;
    this.observeInsets();

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
    this.pinIcons = new MapPinIcons(this.leaflet);
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

  /** Back on screen: resync what may have changed meanwhile — the container's
   * size, and the view and open pin, which openOnMap on an event's page
   * rewrites in mapViewState. Plain returns ask the backend nothing: what's
   * on the map is still the last search. Only a view moved somewhere the
   * last search didn't cover is searched, or the pin sent here couldn't show
   * up. The theme needs nothing here: its effect runs as soon as the view is
   * checked again. */
  onRouteAttached(): void {
    const map = this.map;
    let moved = false;
    if (map) {
      // Still flagged off screen, so any moveend these fire is ignored —
      // viewBounds is set by hand right after.
      map.invalidateSize();
      const { center, zoom } = this.mapViewState;
      if (center && zoom !== null && (!map.getCenter().equals(center) || map.getZoom() !== zoom)) {
        map.setView(center, zoom, { animate: false });
        moved = true;
      }
      this.viewBounds.set(toMapBounds(map.getBounds()));
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
    if (moved && this.areaStale()) this.searchArea();
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

    // Minimal attribution: OpenStreetMap — the data behind every basemap
    // layer — credited once here, so each layer only adds its own short
    // "© CARTO" / "© OpenMapTiles" and nothing is repeated when two are on at
    // once. Leaflet's own prefix (with its flag) stays as it is.
    map.attributionControl.addAttribution(OSM_ATTRIBUTION);

    void this.showBaseLayer(this.themeService.theme());

    // Only bookkeeping on a pan or zoom — no request: the "Cerca in questa
    // zona" button (areaStale) is how a new area gets searched.
    map.on('moveend', () => {
      // Detached, the container is out of the DOM and a window resize makes
      // Leaflet measure it as 0×0 — neither that view nor its bounds are real.
      if (!this.onScreen) return;
      const center = map.getCenter();
      this.mapViewState.center = [center.lat, center.lng];
      this.mapViewState.zoom = map.getZoom();
      this.viewBounds.set(toMapBounds(map.getBounds()));
    });
    this.viewBounds.set(toMapBounds(map.getBounds()));

    // The one search nobody asks for: the first view.
    this.searchArea();
    // The layer may have been switched on while Leaflet was still loading.
    this.drawMarkers();
    this.drawVenueMarkers();
  }

  /** Measures how much of the map the floating UI covers — the toolbar at the
   * top and the sheet at the bottom on phones, the left-hand panel from md
   * up — into `insets`. They become the --map-inset-* variables on the host,
   * which keep "Intorno a me", "Cerca in questa zona" and Leaflet's
   * attribution clear of them, and they keep a centred pin in the part of
   * the map that's actually visible (centerOn, fitBounds). */
  private observeInsets(): void {
    const area = this.mapArea()?.nativeElement;
    const panel = this.panel()?.nativeElement;
    const toolbar = this.toolbar()?.nativeElement as HTMLElement | undefined;
    const sheet = this.sheet()?.nativeElement as HTMLElement | undefined;
    if (!area || !panel || !toolbar || !sheet) return;

    const measure = () => {
      const box = area.getBoundingClientRect();
      if (this.isDesktop()) {
        const { right } = panel.getBoundingClientRect();
        this.insets.set({ top: 0, bottom: 0, left: Math.max(0, Math.round(right - box.left)) });
      } else {
        const top = toolbar.getBoundingClientRect().bottom - box.top;
        const bottom = box.bottom - sheet.getBoundingClientRect().top;
        this.insets.set({ top: Math.max(0, Math.round(top)), bottom: Math.max(0, Math.round(bottom)), left: 0 });
      }
    };
    const observer = new ResizeObserver(measure);
    for (const element of [area, panel, toolbar, sheet]) observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
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
    this.basemapStyleUrl = MAP_STYLE_URLS[theme];

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

  /** "Cerca in questa zona": the events in the current view (when they're
   * showing) and, with places on, the venues of the city it's over. */
  protected searchArea(): void {
    const map = this.map;
    if (!map) return;
    if (this.showEvents()) this.fetchEvents(toMapBounds(map.getBounds()));
    if (this.showVenues()) this.loadVenuesInView();
  }

  /** Searches once the move just started has settled — after "Intorno a me"
   * or a jump to a city, which ask for that new area. */
  private searchAfterMove(): void {
    this.map?.once('moveend', () => this.searchArea());
  }

  private fetchEvents(bounds: MapBounds): void {
    this.loading.set(true);
    this.error.set(false);

    // No cityId: the box is the area. A city filter would hide whatever is
    // just across its border from a visitor who panned there.
    this.eventsRequest?.unsubscribe();
    this.eventsRequest = this.eventsService
      .getMapEvents(bounds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ events, truncated }) => {
          this.events.set(events);
          this.truncated.set(truncated);
          this.searchedBounds.set(bounds);
          this.settledBounds.set(bounds);
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
  gets wiped out when it's torn down. Only selectEvent()/closeEvent() ever
  change it after that (and openOnMap on an event's page, see
  onRouteAttached). Re-running this on every later search is cheap for a
  pin that's already open — it only swaps in the fresh copy (so the card's
  counts follow the server, e.g. after a like on the event's page) and skips
  re-fetching toggle state. */
  private restoreSelectedEvent(events: EventCardDto[]): void {
    const id = this.mapViewState.selectedEventId;
    if (!id) return;

    const match = events.find((event) => event.id === id);
    if (!match) return;

    const alreadyOpen = this.selectedEvent()?.id === id;
    this.selectedVenue.set(null);
    this.selectedEvent.set(match);
    if (!alreadyOpen) this.engagement.sync(match.id);
  }

  /** Syncs the markers with pinnedEvents(): pins already on the map stay put
  and only get a new icon when their live/selected state changed, and only
  events that appeared or went away are added/removed. Rebuilding every
  marker instead restarted every live pin's pulse animation on each
  selection, search or like. Icons come from MapPinIcons' cache, so an
  unchanged state is the very same object. */
  private drawMarkers(): void {
    const L = this.leaflet;
    const map = this.map;
    const icons = this.pinIcons;
    if (!L || !map || !icons) return;

    const selectedId = untracked(() => this.selectedEvent()?.id);
    const now = Date.now();
    const previous = this.markers;
    this.markers = new Map();
    for (const event of untracked(() => this.pinnedEvents())) {
      // Pins go live only once the event is actually underway — before that
      // (even "starting soon") the pin just sits there plain.
      const live = isLiveAt(event, now);
      const selected = event.id === selectedId;
      const icon = icons.event(event.eventType, live, selected);
      const zIndexOffset = selected ? SELECTED_PIN_Z_OFFSET : live ? LIVE_PIN_Z_OFFSET : 0;
      const existing = previous.get(event.id);
      if (existing) {
        previous.delete(event.id);
        existing.event = event;
        // Same icon, same live/selected state: the stacking hasn't changed either.
        if (existing.marker.options.icon !== icon) {
          existing.marker.setIcon(icon);
          existing.marker.setZIndexOffset(zIndexOffset);
        }
        const { lat, lng } = existing.marker.getLatLng();
        if (lat !== event.latitude || lng !== event.longitude) existing.marker.setLatLng([event.latitude, event.longitude]);
        this.markers.set(event.id, existing);
      } else {
        const marker = L.marker([event.latitude, event.longitude], { icon, zIndexOffset }).addTo(map);
        const entry = { marker, event };
        marker.on('click', () => this.selectEvent(entry.event, marker.getLatLng()));
        this.markers.set(event.id, entry);
      }
    }
    previous.forEach(({ marker }) => marker.remove());
  }

  private selectEvent(event: EventCardDto, position: LatLng): void {
    this.selectedVenue.set(null);
    this.selectedEvent.set(event);
    this.mapViewState.selectedEventId = event.id;
    this.centerOn(position);
    this.engagement.sync(event.id);
  }

  /** From a card in the sheet. */
  protected selectFromSheet(event: EventCardDto): void {
    const L = this.leaflet;
    if (!L) return;
    this.selectEvent(event, L.latLng(event.latitude, event.longitude));
  }

  /** Pans (doesn't zoom) the pin into the middle of the part of the map the
  toolbar, the sheet (or the desktop panel) leave visible — on phones
  assuming the sheet already grown to the full card it's about to show. */
  private centerOn(position: LatLng): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    const size = map.getSize();
    const { top, left } = this.insets();
    const bottom = this.isDesktop() ? 0 : Math.max(this.insets().bottom, SELECTED_CARD_MIN_PX);
    const target = L.point(left + (size.x - left) / 2, top + Math.max(0, size.y - top - bottom) / 2);
    map.once('moveend', () => {
      const view = toMapBounds(map.getBounds());
      this.settledBounds.update((settled) => settled && boundsUnion(settled, view));
    });
    map.panBy(map.latLngToContainerPoint(position).subtract(target), { animate: true });
  }

  /** Fetches the venues of each city in `cityIds` that isn't cached or
  already in flight. A failed city stays uncached, so asking again (the
  layer, "Cerca in questa zona") retries it. */
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
            this.venuesError.set(false);
            this.venuesByCity.update((byCity) => new Map(byCity).set(cityId, venues));
          },
          error: () => {
            done();
            this.venuesError.set(true);
          },
        });
    }
  }

  private loadVenuesInView(): void {
    const city = this.viewCity();
    if (city) this.loadVenues([city.id]);
  }

  /** Syncs the venue badges with visibleVenues(), same idea as drawMarkers():
  badges already on the map stay put, only venues that appeared or went away
  (layer toggled, a new city fetched) are added/removed, and only the badge
  whose selection changed gets a new icon. */
  private drawVenueMarkers(): void {
    const L = this.leaflet;
    const map = this.map;
    const icons = this.pinIcons;
    if (!L || !map || !icons) return;

    const selectedId = untracked(() => this.selectedVenue()?.id);
    const previous = this.venueMarkers;
    this.venueMarkers = new Map();
    for (const venue of untracked(() => this.visibleVenues())) {
      const selected = venue.id === selectedId;
      const icon = icons.venue(venue.type, selected);
      // The open one comes up over the event pins, or one sitting on it could hide it.
      const zIndexOffset = selected ? SELECTED_PIN_Z_OFFSET : VENUE_PIN_Z_OFFSET;
      const existing = previous.get(venue.id);
      if (existing) {
        previous.delete(venue.id);
        if (existing.options.icon !== icon) {
          existing.setIcon(icon);
          existing.setZIndexOffset(zIndexOffset);
        }
        this.venueMarkers.set(venue.id, existing);
        continue;
      }
      const marker = L.marker([venue.latitude, venue.longitude], { icon, zIndexOffset, title: venue.name }).addTo(map);
      marker.on('click', () => this.selectVenue(venue, marker.getLatLng()));
      this.venueMarkers.set(venue.id, marker);
    }
    previous.forEach((marker) => marker.remove());
  }

  /** Opens the venue's card in the sheet (in place of an open event's: one
  card at a time). Its page is one tap further, on the card. */
  private selectVenue(venue: VenueMapPinDto, position: LatLng): void {
    this.closeEvent();
    this.selectedVenue.set(venue);
    this.centerOn(position);
  }

  /** "Intorno a me". The position never leaves the browser — it only moves
  the map, and the events around the visitor come from searching that area,
  one request for the tap. */
  protected async locateMe(): Promise<void> {
    if (this.locating()) return;
    this.clearLocateMessage();
    const result = await this.userLocation.locate();
    if (result.ok) this.showUserPosition(result.position);
    else this.showLocateMessage(result.message);
  }

  /** Drops the "you are here" dot at `position` (plus its accuracy circle when
  the fix is precise enough to be worth drawing — see PRECISE_FIX_METERS),
  then moves the map there and searches it. */
  private showUserPosition(position: UserPosition): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    const point = L.latLng(position.lat, position.lng);
    // Outside MAP_BOUNDS the map couldn't pan there anyway (it would stop at
    // the edge with the dot off screen), so say why instead.
    if (!L.latLngBounds(MAP_BOUNDS).contains(point)) {
      this.userLocationLayer?.remove();
      this.userLocationLayer = null;
      this.showLocateMessage('Per ora la mappa copre solo l’Italia.');
      return;
    }

    const precise = position.accuracy <= PRECISE_FIX_METERS;
    const dot = L.marker(point, {
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
        L.circle(point, {
          radius: position.accuracy,
          stroke: false,
          fillColor: USER_LOCATION_COLOR,
          fillOpacity: 0.15,
          interactive: false,
        }),
      );
    }
    this.userLocationLayer?.remove();
    this.userLocationLayer = L.layerGroup(layers).addTo(map);

    this.searchAfterMove();
    if (precise) {
      // toBounds takes the square's side, so twice the radius: the whole
      // circle fits, inside the part of the map the floating UI leaves free.
      const { top, bottom, left } = this.insets();
      map.fitBounds(point.toBounds(position.accuracy * 2), {
        maxZoom: LOCATE_MAX_ZOOM,
        paddingTopLeft: [left, top],
        paddingBottomRight: [0, bottom],
      });
    } else {
      map.setView(point, LOCATE_APPROX_ZOOM);
      const km = Math.round(position.accuracy / 1000);
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

  /** Switching layers is the visitor asking for places: their city in view
  is fetched right away (once — see loadVenues). Events coming back just
  show what the last search found; if the view has moved on since,
  "Cerca in questa zona" is there for it. */
  protected selectLayer(layer: MapLayer): void {
    if (layer === this.mapLayer()) return;
    const hadVenues = this.showVenues();
    this.mapLayer.set(layer);

    if (!hadVenues && this.showVenues()) {
      this.venuesError.set(false);
      this.loadVenuesInView();
    }
    // Places hidden: their open card goes with them.
    if (!this.showVenues()) this.selectedVenue.set(null);
    if (!this.showEvents()) {
      // Events hidden: drop any in-flight fetch and the open event card.
      this.eventsRequest?.unsubscribe();
      this.loading.set(false);
      this.closeEvent();
    } else if (this.searchedBounds() === null && !this.loading()) {
      // Never searched for events yet (the page opened on places only).
      this.searchArea();
    }
  }

  /** "Città" in the filters: a jump, searched on arrival. */
  protected goToCity(city: CityDto): void {
    const map = this.map;
    if (!map) return;
    this.filtersOpen.set(false);
    this.searchAfterMove();
    map.setView([city.latitude, city.longitude], DEFAULT_ZOOM);
  }

  /** The sheet's close: whichever card is open, event or venue. */
  protected closeDetail(): void {
    this.closeEvent();
    this.selectedVenue.set(null);
  }

  private closeEvent(): void {
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
  a refetch — and to /lista's cached copy, so it agrees once there. The card
  is updated on its own, not from the list: after a search its event may no
  longer be among the fetched ones. Reversed by EventEngagementService's
  rollback on request failure. */
  private adjustCount(eventId: string, field: 'likesCount' | 'goingCount', delta: number): void {
    const bump = (event: EventCardDto): EventCardDto => ({
      ...event,
      [field]: Math.max(0, event[field] + delta),
    });

    this.events.update((events) =>
      events.map((event) => (event.id === eventId ? bump(event) : event)),
    );
    this.cityEvents.adjustCount(eventId, field, delta);

    const selected = this.selectedEvent();
    if (selected?.id === eventId) this.selectedEvent.set(bump(selected));
  }
}
