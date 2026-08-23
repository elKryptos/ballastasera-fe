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
import { Subject, debounceTime } from 'rxjs';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { Navbar } from '../../shared/navbar/navbar';
import { EventsService, MapBounds } from '../../core/services/events.service';
import { CitiesService } from '../../core/services/cities.service';
import { DanceStylesService } from '../../core/services/dance-styles.service';
import { EventCardDto } from '../../core/models/event.model';
import { CityDto } from '../../core/models/city.model';
import { DanceStyleDto } from '../../core/models/dance-style.model';

/** Fallback view when there's no city yet to centre on: Milano, zoomed to city level. */
const DEFAULT_CENTER: [number, number] = [45.4642, 9.19];
const DEFAULT_ZOOM = 12;

/** Waits for panning/zooming to settle before hitting the API, so a burst of
 * scroll-wheel zoom steps triggers one request instead of one per step. */
const MOVE_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-map',
  imports: [Navbar],
  templateUrl: './map.html',
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

  /** Filters live in a bottom-sheet on mobile so the map keeps the full screen by default. */
  protected readonly filtersOpen = signal(false);

  protected readonly filteredEvents = computed(() => {
    const style = this.selectedStyleSlug();
    const list = this.events();
    if (!style) return list;
    return list.filter((event) => event.danceStyles.includes(style));
  });

  private map: LeafletMap | null = null;
  private markers: Marker[] = [];
  private leaflet: typeof import('leaflet') | null = null;
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

    // Vite/Angular bundles leaflet's marker images under a hashed path that
    // the default icon URLs can't find — point them at the CDN instead.
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    // Scroll-wheel and pinch zoom stay on; the on-screen +/- control is
    // redundant with those and was competing for corner space with our own UI.
    this.map = L.map(container, { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);

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

    this.markers.forEach((marker) => marker.remove());
    this.markers = this.filteredEvents().map((event) => {
      const marker = L.marker([event.latitude, event.longitude]).addTo(this.map!);
      marker.on('click', () => this.selectedEvent.set(event));
      return marker;
    });
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
}
