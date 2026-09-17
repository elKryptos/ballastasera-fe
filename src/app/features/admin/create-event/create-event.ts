import { Component, computed, effect, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, switchMap, timer } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocomplete, HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput } from '@spartan-ng/brain/autocomplete';
import { AttachmentState } from '@spartan-ng/helm/attachment';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileWarning, lucideImage, lucideRefreshCw, lucideUpload } from '@ng-icons/lucide';
import { Navbar } from '../../../shared/navbar/navbar';
import { AdminService } from '../../../core/services/admin.service';
import { EventsService } from '../../../core/services/events.service';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { EventCreateDto, EventDetailDto, EventType } from '../../../core/models/event.model';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';

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
    ReactiveFormsModule,
    Navbar,
    HlmSelectImports,
    BrnSelectTrigger,
    BrnSelectValue,
    HlmAutocompleteImports,
    BrnAutocompleteInput,
    BrnAutocompleteAnchor,
    HlmSpinnerImports,
    NgIcon,
    SidebarPushDirective
  ],
  providers: [provideIcons({ lucideImage, lucideUpload, lucideRefreshCw, lucideFileWarning })],
  templateUrl: './create-event.html',
  styleUrl: './create-event.css',
})
export class CreateEvent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly eventsService = inject(EventsService);
  private readonly citiesService = inject(CitiesService);
  private readonly danceStylesService = inject(DanceStylesService);
  private readonly router = inject(Router);

  readonly eventTypes = EVENT_TYPES;
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
  private readonly organizerAutocomplete = viewChild(HlmAutocomplete, { read: BrnAutocomplete });

  protected openOrganizerDropdown(): void {
    this.organizerAutocomplete()?.open();
  }

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly cityItemToString = (id: number | ''): string =>
    this.cities().find((c) => c.id === id)?.name ?? '';
  protected readonly danceStyles = signal<DanceStyleDto[]>([]);
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
    cityId: ['' as number | '', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    eventType: ['' as EventType | '', [Validators.required]],
    description: ['', [Validators.maxLength(2000)]],
    instagramUrl: [''],
    whatsappUrl: [''],
    startAt: ['', [Validators.required]],
    endAt: ['', [Validators.required]],
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

  ngOnInit(): void {
    this.admin.getVerifiedOrganizers(0, 100).subscribe((page) => this.organizers.set(page.content));
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
    const body: EventCreateDto = {
      organizerId: value.organizerId,
      venueId: null,
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
      isFree: value.isFree,
      price: value.isFree ? null : value.price,
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
    this.form.reset({ eventType: '', isFree: true, currency: 'EUR' });
    this.selectedDanceStyleIds.set(new Set());
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