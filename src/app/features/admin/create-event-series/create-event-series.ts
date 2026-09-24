import { Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, Subscription, switchMap, tap } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { Navbar } from '../../../shared/navbar/navbar';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { VenuesService } from '../../../core/services/venues.service';
import { EventSeriesCreateDto, EventSeriesDetailDto } from '../../../core/models/event.model';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { AddressSuggestion } from '../../../core/models/geocoding.model';
import { VenuesSummaryDto } from '../../../core/models/venue.model';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';

/** Photon needs at least this many characters before a search is worth firing. */
const ADDRESS_SEARCH_MIN_LENGTH = 3;
/** How long to wait after the last keystroke before querying Photon. */
const ADDRESS_SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-create-event-series',
  imports: [
    ReactiveFormsModule, Navbar, HlmSelectImports, BrnSelectTrigger, BrnSelectValue, HlmAutocompleteImports,
    BrnAutocompleteInput, BrnAutocompleteAnchor, SidebarPushDirective
  ],
  templateUrl: './create-event-series.html',
  styleUrl: './create-event-series.css',
})
export class CreateEventSeries implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly geocodingService = inject(GeocodingService);
  private readonly venuesService = inject(VenuesService);
  private readonly router = inject(Router);

  protected readonly organizers = signal<OrganizerSummaryDto[]>([]);
  protected readonly organizerSearch = signal('');
  protected readonly filteredOrganizers = computed(() => {
    const term = this.organizerSearch().trim().toLowerCase();
    const list = this.organizers();
    if (!term) {
      return list;
    }
    return list.filter((o) => o.name.toLowerCase().includes(term));
  });
  protected readonly organizerItemToString = (id: string): string =>
    this.organizers().find((o) => o.id === id)?.name ?? '';
  private readonly organizerAutocomplete = viewChild('organizerAutocomplete', { read: BrnAutocomplete });

  protected openOrganizerDropdown(): void {
    this.organizerAutocomplete()?.open();
  }

  protected readonly venueSearch = signal('');
  protected readonly venueItemToString = (id: string): string =>
    this.venues().find((v) => v.id === id)?.name ?? '';
  private readonly venueAutocomplete = viewChild('venueAutocomplete', { read: BrnAutocomplete });

  protected openVenueDropdown(): void {
    this.venueAutocomplete()?.open();
  }

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly cityItemToString = (id: number | ''): string =>
    this.cities().find((c) => c.id === id)?.name ?? '';
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);
  protected readonly selectedDanceStyleIds = signal<Set<number>>(new Set());

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createdSeries = signal<EventSeriesDetailDto | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    organizerId: ['', [Validators.required]],
    venueId: [''],
    cityId: ['' as number | '', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    // Filled by the recurrence selector once the backend supports it.
    rrule: [''],
    description: ['', [Validators.maxLength(2000)]],
    instagramUrl: [''],
    whatsappUrl: [''],
    startTime: ['', [Validators.required]],
    endTime: [''],
    isFree: [true],
    price: [null as number | null, [Validators.min(0)]],
    currency: ['EUR'],
    address: ['', [Validators.required]],
    latitude: [null as number | null],
    longitude: [null as number | null],
  });

  private readonly selectedOrganizerId = toSignal(this.form.controls.organizerId.valueChanges, {
    initialValue: this.form.controls.organizerId.value,
  });
  protected readonly selectedOrganizer = computed(
    () => this.organizers().find((o) => o.id === this.selectedOrganizerId()) ?? null,
  );

  private readonly selectedVenueId = toSignal(this.form.controls.venueId.valueChanges, {
    initialValue: this.form.controls.venueId.value,
  });
  private readonly selectedCityId = toSignal(this.form.controls.cityId.valueChanges, {
    initialValue: this.form.controls.cityId.value,
  });
  /** Venues of the selected city, filtered server-side by the search term. */
  protected readonly venues = toSignal(
    combineLatest([
      toObservable(this.selectedCityId),
      toObservable(this.venueSearch).pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
      ),
    ]).pipe(
      switchMap(([cityId, search]) =>
        cityId === ''
          ? of<VenuesSummaryDto[]>([])
          : this.venuesService.getVenues(cityId, search || undefined).pipe(
              catchError(() => of<VenuesSummaryDto[]>([])),
            ),
      ),
    ),
    { initialValue: [] as VenuesSummaryDto[] },
  );
  /** Compared by id: refetching venues returns fresh objects, which must not re-trigger the autofill. */
  protected readonly selectedVenue = computed(
    () => this.venues().find((v) => v.id === this.selectedVenueId()) ?? null,
    { equal: (a, b) => a?.id === b?.id },
  );

  private organizerPhoneSubscription?: Subscription;

  private readonly organizerAutofillEffect = effect(() => {
    const organizer = this.selectedOrganizer();
    this.organizerPhoneSubscription?.unsubscribe();

    this.form.controls.instagramUrl.setValue(
      organizer?.instagram ? `https://instagram.com/${organizer.instagram}` : '',
    );

    if (!organizer) {
      this.form.controls.whatsappUrl.setValue('');
      return;
    }

    this.organizerPhoneSubscription = this.admin.getOrganizer(organizer.id).subscribe((detail) => {
      const digits = detail.phone?.replace(/[^\d+]/g, '');
      this.form.controls.whatsappUrl.setValue(digits ? `https://wa.me/${digits}` : '');
    });
  });

  /** Picking a venue prefills its location; clearing it leaves whatever is already in the form. */
  private readonly venueAutofillEffect = effect(() => {
    const venue = this.selectedVenue();
    if (!venue) {
      return;
    }
    this.form.controls.address.setValue(venue.address);
    this.form.controls.latitude.setValue(venue.latitude);
    this.form.controls.longitude.setValue(venue.longitude);
    this.addressSearch.set(venue.address);
  });

  protected readonly addressSearch = signal('');
  protected readonly addressSearching = signal(false);
  protected readonly addressSuggestions = toSignal(
    toObservable(this.addressSearch).pipe(
      map((term) => term.trim()),
      debounceTime(ADDRESS_SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.length < ADDRESS_SEARCH_MIN_LENGTH) {
          this.addressSearching.set(false);
          return of<AddressSuggestion[]>([]);
        }
        this.addressSearching.set(true);
        return this.geocodingService.searchAddress(term).pipe(
          catchError(() => of<AddressSuggestion[]>([])),
          tap(() => this.addressSearching.set(false)),
        );
      }),
    ),
    { initialValue: [] as AddressSuggestion[] },
  );
  protected readonly addressItemToString = (suggestion: AddressSuggestion): string => suggestion.label;
  private readonly addressAutocomplete = viewChild(HlmAutocompleteSearch, { read: BrnAutocompleteSearch });

  protected openAddressDropdown(): void {
    this.addressAutocomplete()?.open();
  }

  /** Fills in lat/lng only when the address matches a fetched suggestion; free typing never clears them. */
  private readonly addressAutofillEffect = effect(() => {
    if (this.addressSearching()) {
      return;
    }
    const address = this.addressSearch();
    const suggestion = this.addressSuggestions().find((s) => s.label === address);
    if (suggestion) {
      this.form.controls.latitude.setValue(suggestion.latitude);
      this.form.controls.longitude.setValue(suggestion.longitude);
    }
  });

  ngOnInit(): void {
    this.admin.getVerifiedOrganizers(0, 100).subscribe((page) => this.organizers.set(page.content));
    // A venue belongs to one city, so changing the city invalidates the selected venue.
    this.form.controls.cityId.valueChanges.subscribe(() => this.form.controls.venueId.setValue(''));
    this.citiesService.getCities().subscribe((cities) => this.cities.set(cities));
    this.danceStylesService.getDanceStyles().subscribe((styles) => this.danceStyles.set(styles));
  }

  protected toggleDanceStyle(id: number): void {
    const current = new Set(this.selectedDanceStyleIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedDanceStyleIds.set(current);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const body: EventSeriesCreateDto = {
      organizerId: value.organizerId,
      venueId: value.venueId || null,
      cityId: value.cityId as number,
      title: value.title,
      rrule: value.rrule,
      description: value.description || null,
      flyerUrl: null,
      instagramUrl: value.instagramUrl || null,
      whatsappUrl: value.whatsappUrl || null,
      isFree: value.isFree,
      price: value.isFree ? null : value.price,
      currency: value.currency || 'EUR',
      address: value.address,
      latitude: value.latitude,
      longitude: value.longitude,
      startTime: value.startTime,
      endTime: value.endTime || null,
      danceStyleIds: Array.from(this.selectedDanceStyleIds()),
    };

    this.admin.createEventSeries(body).subscribe({
      next: (series) => {
        this.submitting.set(false);
        this.createdSeries.set(series);
        this.form.disable();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Si è verificato un errore durante la creazione della serie.');
      },
    });
  }

  protected createAnother(): void {
    this.form.enable();
    this.form.reset({ isFree: true, currency: 'EUR' });
    this.selectedDanceStyleIds.set(new Set());
    this.addressSearch.set('');
    this.createdSeries.set(null);
  }

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}
