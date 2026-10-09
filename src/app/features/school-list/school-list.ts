import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { ALL_PLACES_QUERY, VENUE_TYPE_LABELS } from '../../core/config/map-pins';
import { CityDto } from '../../core/models/city.model';
import { VenueMapPinDto, VenueType } from '../../core/models/venue.model';
import { CitiesService } from '../../core/services/cities.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { MapViewStateService } from '../../core/services/map-view-state.service';
import { UserLocationService } from '../../core/services/user-location.service';
import { VenuesService } from '../../core/services/venues.service';
import { addressPrimary, withoutCountry } from '../../core/utils/event-format';
import { distanceKm, formatDistance, startingCity } from '../../core/utils/geo';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { VenuePinIcon } from '../../shared/event-filters/pin-icons';
import { ViewSwitch } from '../../shared/event-filters/view-switch';

/** Mappa opens on the whole city: further out than the map's own default
 * (MILAN_DEFAULT_ZOOM), so its places fit on screen together. */
const CITY_ZOOM = 12;

/** Where the closing card's "Scrivici" leads (a mailto: or WhatsApp link).
 * None decided yet: until then the card invites without it. */
const SCHOOLS_CONTACT: string | null = null;

/** What the page lists, in its own words: the schools, or every place. */
const WORDS = {
  schools: { title: 'Scuole di ballo', lead: 'Dove imparare salsa e bachata', one: 'scuola', many: 'scuole', the: 'le scuole' },
  places: { title: 'Scuole e locali', lead: 'Dove si balla', one: 'luogo', many: 'luoghi', the: 'i luoghi' },
};

/** One card, already formatted for the template. */
interface PlaceRow {
  id: string;
  name: string;
  logoUrl: string | null;
  type: VenueType;
  address: string;
  /** "Scuola", or "Scuola · 1,2 km" once the visitor's position is known. */
  meta: string;
}

/**
 * /scuole: the dance schools of a city, where the salsa and bachata lesson
 * sends its readers — "Lista scuole" on the Claude Design canvas "Pagina
 * luogo – mobile". The venues the map draws (VenuesService.getMapVenues,
 * public, one request per city), SCHOOL ones only; every one with
 * ?tipo=tutti, like the map's "Locali e scuole" next to its "Scuole". In
 * alphabetical order; nearest first once the visitor shares their position,
 * asked only when they tap "Vicino a me". A card opens the place's page
 * (/luogo/:id); Mappa opens the map on the city, on the layer of what's
 * listed (MapViewStateService).
 */
@Component({
  selector: 'app-school-list',
  imports: [RouterLink, SidebarPushDirective, VenuePinIcon, ViewSwitch],
  templateUrl: './school-list.html',
  host: { class: 'block min-h-dvh bg-(--color-ink) text-(--ev-text)' },
})
export class SchoolList {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly citiesService = inject(CitiesService);
  private readonly venuesService = inject(VenuesService);
  private readonly mapViewState = inject(MapViewStateService);
  private readonly userLocation = inject(UserLocationService);

  private readonly flags = inject(FeatureFlagService);
  /** Off, a card links nowhere: /luogo/:id wouldn't match. */
  protected readonly detailsOn = this.flags.isEnabled(FEATURE_FLAGS.venueDetailsPage);
  protected readonly mapOn = this.flags.isEnabled(FEATURE_FLAGS.mapPage);
  protected readonly contact = SCHOOLS_CONTACT;

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly cityId = signal<number | null>(null);
  protected readonly city = computed(() => this.cities().find((city) => city.id === this.cityId()) ?? null);

  /** Every place, not just the schools (ALL_PLACES_QUERY). From the URL, so
   * a reload or a shared link keeps it. */
  protected readonly allPlaces = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('tipo') === ALL_PLACES_QUERY.tipo)),
    { requireSync: true },
  );
  protected readonly words = computed(() => (this.allPlaces() ? WORDS.places : WORDS.schools));
  /** For the switch's Lista: this very list, as it is. */
  protected readonly listQueryParams = computed(() => (this.allPlaces() ? ALL_PLACES_QUERY : null));

  /** The places of each city fetched so far, of every type: they're fixed, so
   * going back to a city never asks again. */
  private readonly venuesByCity = signal<ReadonlyMap<number, VenueMapPinDto[]>>(new Map());
  private readonly venues = computed(() => {
    const id = this.cityId();
    const venues = id === null ? undefined : this.venuesByCity().get(id);
    return this.allPlaces() ? venues : venues?.filter((venue) => venue.type === 'SCHOOL');
  });
  protected readonly hasData = computed(() => this.venues() !== undefined);
  protected readonly error = signal(false);

  protected readonly query = signal('');
  /** Nearest first: on once the visitor's position is known. */
  protected readonly nearMe = signal(this.userLocation.position() !== null);
  protected readonly locating = this.userLocation.locating;
  protected readonly locateMessage = signal<string | null>(null);

  protected readonly rows = computed<PlaceRow[]>(() => {
    const words = normalize(this.query()).split(/\s+/).filter(Boolean);
    const position = this.nearMe() ? this.userLocation.position() : null;
    return (this.venues() ?? [])
      .filter((venue) => {
        const text = normalize(`${venue.name} ${venue.address}`);
        return words.every((word) => text.includes(word));
      })
      .map((venue) => ({
        venue,
        km: position ? distanceKm(position, { lat: venue.latitude, lng: venue.longitude }) : null,
      }))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.venue.name.localeCompare(b.venue.name, 'it'))
      .map(({ venue, km }) => {
        const kind = VENUE_TYPE_LABELS[venue.type];
        return {
          id: venue.id,
          name: venue.name,
          logoUrl: venue.logoUrl,
          type: venue.type,
          address: addressPrimary(withoutCountry(venue.address)),
          meta: km !== null ? `${kind} · ${formatDistance(km)}` : kind,
        };
      });
  });

  protected readonly lead = computed(() => {
    const name = this.city()?.name;
    const { lead } = this.words();
    return name ? `${lead} a ${name}.` : `${lead}.`;
  });

  protected readonly countLabel = computed(() => {
    const count = this.rows().length;
    if (count === 0) return 'Nessun risultato';
    if (this.query().trim()) return count === 1 ? '1 risultato' : `${count} risultati`;
    const { one, many } = this.words();
    const where = this.city()?.name ?? 'questa città';
    return `${count} ${count === 1 ? one : many} a ${where}`;
  });

  constructor() {
    if (this.isBrowser) {
      // The city starts as the one the map was last looking at, else the
      // visitor's, else Milano — as on /lista.
      this.citiesService
        .getCities()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (cities) => {
            this.cities.set(cities);
            if (this.cityId() === null && cities.length) this.cityId.set(startingCity(cities, this.mapViewState.center, this.userLocation.position()).id);
          },
          error: () => this.error.set(true),
        });
    }

    // A new city: its places, unless they're already here.
    effect(() => {
      const city = this.city();
      if (city) untracked(() => this.load(city));
    });
  }

  protected selectCity(event: Event): void {
    this.cityId.set(Number((event.target as HTMLSelectElement).value));
  }

  protected search(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.query.set('');
  }

  protected retry(): void {
    const city = this.city();
    if (city) this.load(city);
  }

  /** The position is asked on this tap, the first time. Refused or failed,
   * the list stays in alphabetical order and the reason shows. */
  protected async toggleNearMe(): Promise<void> {
    this.locateMessage.set(null);
    if (this.nearMe()) {
      this.nearMe.set(false);
      return;
    }
    const { ok, notice } = await this.userLocation.ensure();
    this.locateMessage.set(notice);
    if (ok) this.nearMe.set(true);
  }

  /** Mappa tapped (the switch's link does the navigating): the map is to
   * open on this city, showing what's listed — the schools, or every place. */
  protected prepareMap(): void {
    const city = this.city();
    if (city) {
      this.mapViewState.center = [city.latitude, city.longitude];
      this.mapViewState.zoom = CITY_ZOOM;
    }
    this.mapViewState.selectedEventId = null;
    this.mapViewState.venueLayer = this.allPlaces() ? 'venues' : 'schools';
  }

  private load(city: CityDto): void {
    if (this.venuesByCity().has(city.id)) return;
    this.error.set(false);
    this.venuesService
      .getMapVenues(city.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (venues) => this.venuesByCity.update((byCity) => new Map(byCity).set(city.id, venues)),
        error: () => this.error.set(true),
      });
  }

}

/** Lower case, without accents: "Città" is found typing "citta". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
