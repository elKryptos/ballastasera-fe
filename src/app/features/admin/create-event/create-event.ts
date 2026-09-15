import { Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocomplete, HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput } from '@spartan-ng/brain/autocomplete';
import { Navbar } from '../../../shared/navbar/navbar';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { EventCreateDto, EventDetailDto, EventType } from '../../../core/models/event.model';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';

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
  ],
  templateUrl: './create-event.html',
  styleUrl: './create-event.css',
})
export class CreateEvent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
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

  protected readonly form = this.fb.nonNullable.group({
    organizerId: ['', [Validators.required]],
    cityId: ['' as number | '', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    eventType: ['' as EventType | '', [Validators.required]],
    description: ['', [Validators.maxLength(2000)]],
    flyerUrl: [''],
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

  private readonly organizerAutofillEffect = effect(() => {
    const organizer = this.selectedOrganizer();
    if (!organizer) {
      return;
    }
    if (organizer.instagram) {
      this.form.controls.instagramUrl.setValue(`https://instagram.com/${organizer.instagram}`);
    }
    this.admin.getOrganizer(organizer.id).subscribe((detail) => {
      if (detail.phone) {
        const digits = detail.phone.replace(/[^\d+]/g, '');
        this.form.controls.whatsappUrl.setValue(`https://wa.me/${digits}`);
      }
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
      flyerUrl: value.flyerUrl || null,
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
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Si è verificato un errore durante la creazione dell\'evento.');
      },
    });

  }

  protected createAnother(): void {
    this.form.reset({ eventType: '', isFree: true, currency: 'EUR' });
    this.selectedDanceStyleIds.set(new Set());
    this.createdEvent.set(null);
  }

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  private toIsoString(localDateTime: string): string {
    return new Date(localDateTime).toISOString();
  }
}