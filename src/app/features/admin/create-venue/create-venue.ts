import { Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocomplete, HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { VenueCreateDto, VenueDetailDto, VenueType } from '../../../core/models/venue.model';
import { OrganizerSummaryDto } from '../../../core/models/organizer.model';
import { CityDto } from '../../../core/models/city.model';
import { AddressSuggestion } from '../../../core/models/geocoding.model';

/** Photon needs at least this many characters before a search is worth firing. */
const ADDRESS_SEARCH_MIN_LENGTH = 3;
/** How long to wait after the last keystroke before querying Photon. */
const ADDRESS_SEARCH_DEBOUNCE_MS = 100;

// Contact patterns mirror the @URL/@Pattern on VenueCreateDto in the backend.
const WEBSITE_PATTERN = /^https?:\/\/\S+$/;
const WHATSAPP_PATTERN = /^\+?[0-9]{6,15}$/;
const FACEBOOK_PATTERN = /^https:\/\/(www\.|m\.)?facebook\.com\/.+/;
const INSTAGRAM_PATTERN = /^https:\/\/(www\.)?instagram\.com\/.+/;
const YOUTUBE_PATTERN = /^https:\/\/(www\.)?youtube\.com\/.+/;
const TIKTOK_PATTERN = /^https:\/\/(www\.)?tiktok\.com\/@.+/;

/** Spaces, dots, dashes and brackets are fine to type; the backend only takes "+" and digits. */
const stripPhone = (value: string): string => value.replace(/[\s().-]/g, '');

const whatsappValidator: ValidatorFn = (control) => {
  const phone = stripPhone(control.value ?? '');
  return !phone || WHATSAPP_PATTERN.test(phone) ? null : { whatsapp: true };
};

/** Optional text fields: empty (or only spaces) goes to the backend as null. */
const optional = (value: string): string | null => value.trim() || null;

type ContactControl = 'website' | 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'youtube' | 'tiktok';

/** The "Contatti" section, in display order — one template block for all of them. */
const CONTACT_FIELDS: {
  name: ContactControl;
  label: string;
  type: 'url' | 'tel' | 'email';
  placeholder: string;
  error: string;
  /** Spans both columns from md up. */
  wide?: boolean;
}[] = [
  {
    name: 'website',
    label: 'Sito web',
    type: 'url',
    placeholder: 'https://...',
    error: 'URL non valido: deve iniziare con http:// o https:// (max 100 caratteri).',
    wide: true,
  },
  {
    name: 'whatsapp',
    label: 'WhatsApp',
    type: 'tel',
    placeholder: '+39 333 123 4567',
    error: 'Numero con prefisso internazionale (6-15 cifre).',
  },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'info@...', error: 'Email non valida (max 100 caratteri).' },
  {
    name: 'instagram',
    label: 'Instagram',
    type: 'url',
    placeholder: 'https://instagram.com/...',
    error: 'Deve essere un URL https://instagram.com/... (max 100 caratteri).',
  },
  {
    name: 'facebook',
    label: 'Facebook',
    type: 'url',
    placeholder: 'https://facebook.com/...',
    error: 'Deve essere un URL https://facebook.com/... (max 100 caratteri).',
  },
  {
    name: 'youtube',
    label: 'YouTube',
    type: 'url',
    placeholder: 'https://youtube.com/...',
    error: 'Deve essere un URL https://youtube.com/... (max 100 caratteri).',
  },
  {
    name: 'tiktok',
    label: 'TikTok',
    type: 'url',
    placeholder: 'https://tiktok.com/@...',
    error: 'Deve essere un URL https://tiktok.com/@... (max 100 caratteri).',
  },
];

const VENUE_TYPES: { value: VenueType; label: string }[] = [
  { value: 'SCHOOL', label: 'Scuola' },
  { value: 'CLUB', label: 'Club' },
  { value: 'BAR', label: 'Bar' },
  { value: 'OTHER', label: 'Altro' },
];

@Component({
  selector: 'app-create-venue',
  imports: [
    ReactiveFormsModule, SidebarPushDirective, HlmSelectImports, BrnSelectTrigger, BrnSelectValue,
    HlmAutocompleteImports, BrnAutocompleteInput, BrnAutocompleteAnchor,
  ],
  templateUrl: './create-venue.html',
  styleUrl: './create-venue.css',
})
export class CreateVenue implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly citiesService = inject(CitiesService);
  private readonly geocodingService = inject(GeocodingService);
  private readonly router = inject(Router);

  readonly venueTypes = VENUE_TYPES;
  protected readonly contactFields = CONTACT_FIELDS;

  // Organizer is optional: only venues with an organizer profile of their own get one.
  protected readonly organizers = signal<OrganizerSummaryDto[]>([]);
  protected readonly organizerSearch = signal('');
  protected readonly filteredOrganizers = computed(() => {
    const term = this.organizerSearch().trim().toLowerCase();
    const list = this.organizers();
    return term ? list.filter((o) => o.name.toLowerCase().includes(term)) : list;
  });
  protected readonly organizerItemToString = (id: string): string =>
    this.organizers().find((o) => o.id === id)?.name ?? '';
  private readonly organizerAutocomplete = viewChild(HlmAutocomplete, { read: BrnAutocomplete });

  protected openOrganizerDropdown(): void {
    this.organizerAutocomplete()?.open();
  }

  protected clearOrganizer(): void {
    this.form.controls.organizerId.setValue('');
    this.organizerSearch.set('');
  }

  protected readonly cities = signal<CityDto[]>([]);
  protected readonly cityItemToString = (id: number | ''): string =>
    this.cities().find((c) => c.id === id)?.name ?? '';

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createdVenue = signal<VenueDetailDto | null>(null);

  // Limits mirror the @Size/@DecimalMin/@DecimalMax on VenueCreateDto in the backend.
  protected readonly form = this.fb.nonNullable.group({
    organizerId: [''],
    cityId: ['' as number | '', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['' as VenueType | '', [Validators.required]],
    address: ['', [Validators.required, Validators.maxLength(150)]],
    // Optional: left empty, the backend geocodes the address.
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
    description: ['', [Validators.maxLength(500)]],
    // Contacts are all optional: empty is sent as null.
    website: ['', [Validators.pattern(WEBSITE_PATTERN), Validators.maxLength(100)]],
    whatsapp: ['', [whatsappValidator]],
    email: ['', [Validators.email, Validators.maxLength(100)]],
    facebook: ['', [Validators.pattern(FACEBOOK_PATTERN), Validators.maxLength(100)]],
    instagram: ['', [Validators.pattern(INSTAGRAM_PATTERN), Validators.maxLength(100)]],
    youtube: ['', [Validators.pattern(YOUTUBE_PATTERN), Validators.maxLength(100)]],
    tiktok: ['', [Validators.pattern(TIKTOK_PATTERN), Validators.maxLength(100)]],
  });

  private readonly selectedOrganizerId = toSignal(this.form.controls.organizerId.valueChanges, {
    initialValue: this.form.controls.organizerId.value,
  });
  protected readonly selectedOrganizer = computed(
    () => this.organizers().find((o) => o.id === this.selectedOrganizerId()) ?? null,
  );

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
    this.adminService.getVerifiedOrganizers(0, 100).subscribe((page) => this.organizers.set(page.content));
    this.citiesService.getCities().subscribe((cities) => this.cities.set(cities));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const body: VenueCreateDto = {
      organizerId: value.organizerId || null,
      cityId: value.cityId as number,
      name: value.name.trim(),
      type: value.type as VenueType,
      address: value.address,
      latitude: value.latitude,
      longitude: value.longitude,
      description: optional(value.description),
      website: optional(value.website),
      whatsapp: stripPhone(value.whatsapp) || null,
      email: optional(value.email),
      facebook: optional(value.facebook),
      instagram: optional(value.instagram),
      youtube: optional(value.youtube),
      tiktok: optional(value.tiktok),
    };

    this.adminService.createVenue(body).subscribe({
      next: (venue) => {
        this.submitting.set(false);
        this.createdVenue.set(venue);
        this.form.disable();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        // 409 = DuplicateVenueException: same name already in this city.
        // "Address not found" = AddressNotFoundException: no coordinates sent and the backend couldn't geocode.
        if (err.status === 409) {
          this.errorMessage.set('Esiste già un luogo con questo nome in questa città.');
        } else if (err.error?.details === 'Address not found') {
          this.errorMessage.set('Indirizzo non trovato. Correggilo o inserisci latitudine e longitudine a mano.');
        } else {
          this.errorMessage.set(err.error?.message ?? 'Si è verificato un errore durante la creazione del luogo.');
        }
      },
    });
  }

  protected createAnother(): void {
    this.form.enable();
    this.form.reset();
    this.organizerSearch.set('');
    this.addressSearch.set('');
    this.createdVenue.set(null);
  }

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}
