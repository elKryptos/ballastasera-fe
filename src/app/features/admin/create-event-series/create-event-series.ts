import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarDays, lucideFileWarning, lucideImage } from '@ng-icons/lucide';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { AttachmentState } from '@spartan-ng/helm/attachment';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { Navbar } from '../../../shared/navbar/navbar';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { VenuesService } from '../../../core/services/venues.service';
import { DayOfWeek, EventCardDto, EventSeriesCreateDto, EventSeriesDetailDto } from '../../../core/models/event.model';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { AddressSuggestion } from '../../../core/models/geocoding.model';
import { VenuesSummaryDto } from '../../../core/models/venue.model';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';

registerLocaleData(localeIt);

/** Photon needs at least this many characters before a search is worth firing. */
const ADDRESS_SEARCH_MIN_LENGTH = 3;
/** How long to wait after the last keystroke before querying the venues or Photon. */
const SEARCH_DEBOUNCE_MS = 300;

/** Local (not UTC) yyyy-MM-dd, which is what `<input type="date">` expects. */
const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const toggled = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
};

@Component({
  imports: [
    ReactiveFormsModule, Navbar, HlmSelectImports, BrnSelectTrigger, BrnSelectValue, HlmAutocompleteImports,
    BrnAutocompleteInput, BrnAutocompleteAnchor, SidebarPushDirective, DatePipe, NgIcon, HlmSpinnerImports
  ],
  providers: [provideIcons({ lucideCalendarDays, lucideFileWarning, lucideImage })],
  templateUrl: './create-event-series.html',
  styleUrl: './create-event-series.css',
})
export class CreateEventSeries {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly geocodingService = inject(GeocodingService);
  private readonly venuesService = inject(VenuesService);
  private readonly router = inject(Router);

  /** Shared by the recurrence-day and dance-style chips. */
  protected readonly chipClass =
    'inline-flex cursor-pointer items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors select-none has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground not-has-checked:bg-transparent not-has-checked:text-muted-foreground not-has-checked:hover:border-primary/50 not-has-checked:hover:text-foreground';

  protected readonly organizers = toSignal(
    this.admin.getVerifiedOrganizers(0, 100).pipe(
      map((page) => page.content),
      catchError(() => of<OrganizerSummaryDto[]>([])),
    ),
    { initialValue: [] as OrganizerSummaryDto[] },
  );
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

  protected readonly cities = toSignal(
    this.citiesService.getCities().pipe(catchError(() => of<CityDto[]>([]))),
    { initialValue: [] as CityDto[] },
  );
  protected readonly cityItemToString = (id: number | ''): string =>
    this.cities().find((c) => c.id === id)?.name ?? '';
  protected readonly danceStyles = toSignal(
    this.danceStylesService.getDanceStyles().pipe(catchError(() => of<DanceStyleDto[]>([]))),
    { initialValue: [] as DanceStyleDto[] },
  );
  protected readonly selectedDanceStyleIds = signal<Set<number>>(new Set());

  protected readonly recurrenceDayOptions: { value: DayOfWeek; label: string }[] = [
    { value: 'MONDAY', label: 'Lunedì' },
    { value: 'TUESDAY', label: 'Martedì' },
    { value: 'WEDNESDAY', label: 'Mercoledì' },
    { value: 'THURSDAY', label: 'Giovedì' },
    { value: 'FRIDAY', label: 'Venerdì' },
    { value: 'SATURDAY', label: 'Sabato' },
    { value: 'SUNDAY', label: 'Domenica' },
  ];
  protected readonly selectedRecurrenceDays = signal<Set<DayOfWeek>>(new Set());
  protected readonly recurrenceDaysTouched = signal(false);
  protected readonly recurrenceDaysInvalid = computed(
    () => this.recurrenceDaysTouched() && this.selectedRecurrenceDays().size === 0,
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createdSeries = signal<EventSeriesDetailDto | null>(null);

  protected readonly occurrencesForm = this.fb.nonNullable.group({
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
  });
  protected readonly generatingOccurrences = signal(false);
  protected readonly occurrencesError = signal<string | null>(null);
  protected readonly generatedOccurrences = signal<EventCardDto[] | null>(null);

  protected readonly todayIso = toIsoDate(new Date());
  private readonly occStartDateValue = toSignal(this.occurrencesForm.controls.startDate.valueChanges, {
    initialValue: this.occurrencesForm.controls.startDate.value,
  });
  /** The end date can never precede the start date. */
  protected readonly minEndDate = computed(() => this.occStartDateValue() || this.todayIso);

  /** Uploaded once to the series; the backend copies its URL onto every occurrence generated afterwards. */
  protected readonly flyerState = signal<AttachmentState>('idle');
  protected readonly flyerError = signal<string | null>(null);
  protected readonly flyerFile = signal<File | null>(null);
  protected readonly flyerPreviewUrl = signal<string | null>(null);
  protected readonly flyerBusy = computed(() => this.flyerState() === 'uploading');
  /** Occurrences inherit the flyer when they are generated, so it can't change afterwards. */
  protected readonly flyerLocked = computed(() => this.generatedOccurrences() !== null);
  private readonly flyerFileInput = viewChild<ElementRef<HTMLInputElement>>('flyerFileInput');

  protected readonly form = this.fb.nonNullable.group({
    organizerId: ['', [Validators.required]],
    venueId: [''],
    cityId: ['' as number | '', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
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
  /** Compared by id: the organizers list is loaded once, but this must never re-trigger the contact autofill. */
  protected readonly selectedOrganizer = computed(
    () => this.organizers().find((o) => o.id === this.selectedOrganizerId()) ?? null,
    { equal: (a, b) => a?.id === b?.id },
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
        debounceTime(SEARCH_DEBOUNCE_MS),
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
      debounceTime(SEARCH_DEBOUNCE_MS),
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

  constructor() {
    // A venue belongs to one city, so changing the city invalidates the selected venue and its search.
    this.form.controls.cityId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.controls.venueId.setValue('');
      this.venueSearch.set('');
    });

    // The organizer's socials prefill the series' links; switchMap drops a stale phone lookup on re-selection.
    toObservable(this.selectedOrganizer)
      .pipe(
        tap((organizer) =>
          this.form.controls.instagramUrl.setValue(
            organizer?.instagram ? `https://instagram.com/${organizer.instagram}` : '',
          ),
        ),
        switchMap((organizer) =>
          organizer
            ? this.admin.getOrganizer(organizer.id).pipe(
                map((detail) => detail.phone),
                catchError(() => of(null)),
              )
            : of(null),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((phone) => {
        const digits = phone?.replace(/[^\d+]/g, '');
        this.form.controls.whatsappUrl.setValue(digits ? `https://wa.me/${digits}` : '');
      });

    this.occurrencesForm.controls.startDate.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
      const endControl = this.occurrencesForm.controls.endDate;
      if (start && endControl.value && endControl.value < start) {
        endControl.setValue(start);
      }
    });

    inject(DestroyRef).onDestroy(() => this.clearStagedFlyer());
  }

  protected toggleDanceStyle(id: number): void {
    this.selectedDanceStyleIds.update((current) => toggled(current, id));
  }

  protected toggleRecurrenceDay(day: DayOfWeek): void {
    this.selectedRecurrenceDays.update((current) => toggled(current, day));
  }

  protected submit(): void {
    this.recurrenceDaysTouched.set(true);
    if (this.form.invalid || this.selectedRecurrenceDays().size === 0) {
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
      recurrenceDays: Array.from(this.selectedRecurrenceDays()),
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

  /** Segundo paso: materializa los Events concretos de la serie recién creada
   * para el rango elegido. Se puede repetir (ej. "generar próximo mes") sin
   * duplicar nada: el backend arranca desde generatedUntil + 1 día. */
  protected generateOccurrences(): void {
    const series = this.createdSeries();
    if (!series || this.occurrencesForm.invalid) {
      this.occurrencesForm.markAllAsTouched();
      return;
    }

    this.generatingOccurrences.set(true);
    this.occurrencesError.set(null);

    const { startDate, endDate } = this.occurrencesForm.getRawValue();
    this.admin.generateEventSeriesOccurrences(series.id, { startDate, endDate }).subscribe({
      next: (events) => {
        this.generatingOccurrences.set(false);
        this.generatedOccurrences.set(events);
      },
      error: (err) => {
        this.generatingOccurrences.set(false);
        this.occurrencesError.set(err?.error?.message ?? 'Si è verificato un errore durante la generazione delle occorrenze.');
      },
    });
  }

  protected openFlyerPicker(): void {
    if (this.flyerBusy() || this.flyerLocked()) {
      return;
    }
    this.flyerFileInput()?.nativeElement.click();
  }

  protected onFlyerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    this.clearStagedFlyer();
    this.flyerFile.set(file);
    this.flyerPreviewUrl.set(URL.createObjectURL(file));
    this.uploadFlyer();
  }

  /** Uploads the staged flyer to the series; a failed upload can be retried without picking the file again. */
  protected uploadFlyer(): void {
    const series = this.createdSeries();
    const file = this.flyerFile();
    if (!series || !file || this.flyerBusy() || this.flyerLocked()) {
      return;
    }

    this.flyerState.set('uploading');
    this.flyerError.set(null);

    this.admin.uploadEventSeriesFlyer(series.id, file).subscribe({
      next: (updated) => {
        this.createdSeries.set(updated);
        this.flyerState.set('done');
      },
      error: (err) => {
        this.flyerState.set('error');
        this.flyerError.set(err?.error?.message ?? 'Caricamento del flyer non riuscito. Riprova.');
      },
    });
  }

  private clearStagedFlyer(): void {
    const previewUrl = this.flyerPreviewUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    this.flyerFile.set(null);
    this.flyerPreviewUrl.set(null);
  }

  protected createAnother(): void {
    this.form.enable();
    this.form.reset({ isFree: true, currency: 'EUR' });
    this.selectedDanceStyleIds.set(new Set());
    this.selectedRecurrenceDays.set(new Set());
    this.recurrenceDaysTouched.set(false);
    this.addressSearch.set('');
    this.createdSeries.set(null);
    this.occurrencesForm.reset();
    this.generatedOccurrences.set(null);
    this.occurrencesError.set(null);
    this.flyerState.set('idle');
    this.flyerError.set(null);
    this.clearStagedFlyer();
  }

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}
