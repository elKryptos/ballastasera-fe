import { Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap, timer } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { AttachmentState } from '@spartan-ng/helm/attachment';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileWarning, lucideImage, lucideRefreshCw, lucideUpload } from '@ng-icons/lucide';
import { AdminService } from '../../../core/services/admin.service';
import { EventsService } from '../../../core/services/events.service';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { VenuesService } from '../../../core/services/venues.service';
import { EventCreateDto, EventDetailDto, EventType } from '../../../core/models/event.model';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { instagramUrl as toInstagramUrl, waMeUrl } from '../../../core/utils/event-format';
import { toggled } from '../../../core/utils/sets';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { injectAddressSearch, injectOrganizerPicker, injectVenuePicker } from '../admin-pickers';

/** The event's links, as the form takes them; null where the source has none. */
interface Contacts {
  instagramUrl: string | null;
  whatsappUrl: string | null;
}
const NO_CONTACTS: Contacts = { instagramUrl: null, whatsappUrl: null };

/** The end must come after the start. datetime-local values share one
 * format (yyyy-MM-ddTHH:mm), so comparing them as strings keeps their order. */
const endAfterStart = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('startAt')?.value;
  const end = group.get('endAt')?.value;
  return start && end && end <= start ? { endBeforeStart: true } : null;
};

/** Minimum time the flyer widget stays in the "processing" state, so the backend's conversion work is visible even when the response is fast. */
const FLYER_PROCESSING_MIN_MS = 5000;

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'EVENT', label: 'Evento' },
  { value: 'SCHOOL', label: 'Scuola' },
  { value: 'CLUB', label: 'Club' },
  { value: 'BAR', label: 'Bar' },
];

@Component({
  selector: 'app-create-event',
  imports: [
    ReactiveFormsModule, HlmSelectImports, BrnSelectTrigger, BrnSelectValue, HlmAutocompleteImports,
    BrnAutocompleteInput, BrnAutocompleteAnchor, HlmSpinnerImports, NgIcon, SidebarPushDirective
  ],
  providers: [provideIcons({ lucideImage, lucideUpload, lucideRefreshCw, lucideFileWarning })],
  templateUrl: './create-event.html',
  styleUrl: './create-event.css',
})
export class CreateEvent {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly eventsService = inject(EventsService);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly venuesService = inject(VenuesService);
  private readonly router = inject(Router);

  readonly eventTypes = EVENT_TYPES;
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

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createdEvent = signal<EventDetailDto | null>(null);

  protected readonly flyerState = signal<AttachmentState>('idle');
  protected readonly flyerError = signal<string | null>(null);
  protected readonly flyerFile = signal<File | null>(null);
  protected readonly flyerPreviewUrl = signal<string | null>(null);
  /** The local staged preview takes priority; otherwise fall back to the flyer already persisted on the event. */
  protected readonly flyerImageUrl = computed(() => this.flyerPreviewUrl() ?? this.createdEvent()?.flyerUrl ?? null);
  protected readonly flyerBusy = computed(() => {
    const state = this.flyerState();
    return state === 'uploading' || state === 'processing';
  });
  private readonly flyerFileInput = viewChild<ElementRef<HTMLInputElement>>('flyerFileInput');

  protected readonly form = this.fb.nonNullable.group({
    organizerId: ['', [Validators.required]],
    venueId: [''],
    cityId: ['' as number | '', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    eventType: ['' as EventType | '', [Validators.required]],
    description: ['', [Validators.maxLength(2000)]],
    instagramUrl: [''],
    whatsappUrl: [''],
    startAt: ['', [Validators.required]],
    endAt: ['', [Validators.required]],
    free: [true],
    price: [null as number | null, [Validators.min(0)]],
    currency: ['EUR'],
    address: ['', [Validators.required]],
    latitude: [null as number | null],
    longitude: [null as number | null],
  }, { validators: endAfterStart });

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
    // The event's links: field by field, the venue's when it has one, the organizer's otherwise.
    // switchMap drops a stale lookup when the organizer or the venue changes again.
    const organizerContacts$ = toObservable(this.organizer.selected).pipe(
      switchMap((organizer) => {
        if (!organizer) {
          return of(NO_CONTACTS);
        }
        // The summary has the Instagram handle; the phone needs the detail.
        const instagramUrl = organizer.instagram ? toInstagramUrl(organizer.instagram) : null;
        return this.admin.getOrganizer(organizer.id).pipe(
          map((detail): Contacts => ({ instagramUrl, whatsappUrl: waMeUrl(detail.phone) })),
          catchError(() => of<Contacts>({ instagramUrl, whatsappUrl: null })),
        );
      }),
    );
    // By the form's venueId, not venue.selected: that one goes null when a new search leaves
    // the venue out of the list, while the venue still stays picked (and gets saved).
    const venueContacts$ = toObservable(this.venue.id).pipe(
      switchMap((venueId) =>
        venueId
          ? this.venuesService.getVenueDetail(venueId).pipe(
              // Empty counts as none, so the organizer's still fills in.
              map((venue): Contacts => ({
                instagramUrl: venue.instagram ? toInstagramUrl(venue.instagram) : null,
                whatsappUrl: waMeUrl(venue.whatsapp),
              })),
              catchError(() => of(NO_CONTACTS)),
            )
          : of(NO_CONTACTS),
      ),
    );
    combineLatest([organizerContacts$, venueContacts$])
      .pipe(takeUntilDestroyed())
      .subscribe(([organizer, venue]) => {
        this.form.controls.instagramUrl.setValue(venue.instagramUrl ?? organizer.instagramUrl ?? '');
        this.form.controls.whatsappUrl.setValue(venue.whatsappUrl ?? organizer.whatsappUrl ?? '');
      });

    inject(DestroyRef).onDestroy(() => this.clearStagedFlyer());
  }

  protected toggleDanceStyle(id: number): void {
    this.selectedDanceStyleIds.update((current) => toggled(current, id));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const body: EventCreateDto = {
      organizerId: value.organizerId,
      // Clearing the venue's autocomplete writes null, despite the nonNullable form.
      venueId: value.venueId || null,
      seriesId: null,
      cityId: value.cityId as number,
      title: value.title,
      eventType: value.eventType as EventType,
      description: value.description || null,
      flyerUrl: null,
      instagramUrl: value.instagramUrl || null,
      whatsappUrl: value.whatsappUrl || null,
      startAt: this.toIsoString(value.startAt),
      endAt: this.toIsoString(value.endAt),
      free: value.free,
      price: value.free ? null : value.price,
      currency: value.currency || 'EUR',
      address: value.address,
      latitude: value.latitude,
      longitude: value.longitude,
      danceStyleIds: Array.from(this.selectedDanceStyleIds()),
    };

    this.admin.createEvent(body).subscribe({
      next: (event) => {
        this.submitting.set(false);
        this.createdEvent.set(event);
        this.form.disable();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Si è verificato un errore durante la creazione dell\'evento.');
      },
    });
  }

  protected createAnother(): void {
    this.form.enable();
    this.form.reset({ eventType: '', free: true, currency: 'EUR' });
    this.selectedDanceStyleIds.set(new Set());
    // reset() empties the inputs but not the autocompletes' search terms,
    // which would keep filtering the next lists.
    this.organizer.search.set('');
    this.venue.search.set('');
    this.address.search.set('');
    this.createdEvent.set(null);
    this.flyerState.set('idle');
    this.flyerError.set(null);
    this.clearStagedFlyer();
  }

  protected openFlyerPicker(): void {
    if (this.flyerBusy()) {
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
    this.flyerState.set('idle');
    this.flyerError.set(null);
    this.flyerFile.set(file);
    this.flyerPreviewUrl.set(URL.createObjectURL(file));
  }

  protected uploadFlyer(): void {
    const file = this.flyerFile();
    const event_ = this.createdEvent();
    if (!file || !event_) {
      return;
    }

    this.flyerError.set(null);
    this.flyerState.set('uploading');

    this.admin
      .uploadEventFlyer(event_.id, file)
      .pipe(
        switchMap(() => {
          this.flyerState.set('processing');
          return timer(FLYER_PROCESSING_MIN_MS);
        }),
        switchMap(() => this.eventsService.getEventDetail(event_.id)),
      )
      .subscribe({
        next: (updated) => {
          this.createdEvent.set(updated);
          this.flyerState.set(updated.flyerStatus === 'FAILED' ? 'error' : 'done');
          this.clearStagedFlyer();
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

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  private toIsoString(localDateTime: string): string {
    return new Date(localDateTime).toISOString();
  }
}