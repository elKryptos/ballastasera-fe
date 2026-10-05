import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarDays, lucideFileWarning, lucideImage } from '@ng-icons/lucide';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { AttachmentState } from '@spartan-ng/helm/attachment';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { DayOfWeek, EventCardDto, EventSeriesCreateDto, EventSeriesDetailDto } from '../../../core/models/event.model';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { instagramUrl, waMeUrl } from '../../../core/utils/event-format';
import { toggled } from '../../../core/utils/sets';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { injectAddressSearch, injectOrganizerPicker, injectVenuePicker } from '../admin-pickers';

registerLocaleData(localeIt);

/** Local (not UTC) yyyy-MM-dd, which is what `<input type="date">` expects. */
const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

@Component({
  imports: [
    ReactiveFormsModule, HlmSelectImports, BrnSelectTrigger, BrnSelectValue, HlmAutocompleteImports,
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
  private readonly router = inject(Router);

  /** Shared by the recurrence-day and dance-style chips. */
  protected readonly chipClass =
    'inline-flex cursor-pointer items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors select-none has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground not-has-checked:bg-transparent not-has-checked:text-muted-foreground not-has-checked:hover:border-primary/50 not-has-checked:hover:text-foreground';

  private readonly organizerAutocomplete = viewChild('organizerAutocomplete', { read: BrnAutocomplete });
  private readonly venueAutocomplete = viewChild('venueAutocomplete', { read: BrnAutocomplete });
  private readonly addressAutocomplete = viewChild(HlmAutocompleteSearch, { read: BrnAutocompleteSearch });

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
    free: [true],
    price: [null as number | null, [Validators.min(0)]],
    currency: ['EUR'],
    address: ['', [Validators.required]],
    latitude: [null as number | null],
    longitude: [null as number | null],
  });

  protected readonly organizer = injectOrganizerPicker(this.form.controls.organizerId);
  protected readonly address = injectAddressSearch(this.form.controls);
  protected readonly venue = injectVenuePicker(this.form.controls, this.address.search);

  protected openOrganizerDropdown(): void {
    this.organizerAutocomplete()?.open();
  }

  protected openVenueDropdown(): void {
    this.venueAutocomplete()?.open();
  }

  protected openAddressDropdown(): void {
    this.addressAutocomplete()?.open();
  }

  constructor() {
    // The organizer's socials prefill the series' links; switchMap drops a stale phone lookup on re-selection.
    toObservable(this.organizer.selected)
      .pipe(
        tap((organizer) =>
          this.form.controls.instagramUrl.setValue(organizer?.instagram ? instagramUrl(organizer.instagram) : ''),
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
      .subscribe((phone) => this.form.controls.whatsappUrl.setValue(waMeUrl(phone) ?? ''));

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
      free: value.free,
      price: value.free ? null : value.price,
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
    this.form.reset({ free: true, currency: 'EUR' });
    this.selectedDanceStyleIds.set(new Set());
    this.selectedRecurrenceDays.set(new Set());
    this.recurrenceDaysTouched.set(false);
    // reset() empties the inputs but not the autocompletes' search terms,
    // which would keep filtering the next lists.
    this.organizer.search.set('');
    this.venue.search.set('');
    this.address.search.set('');
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
