import { Component, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocomplete, HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { VenueCreateDto, VenueDetailDto, VenueType } from '../../../core/models/venue.model';
import { CityDto } from '../../../core/models/city.model';
import { instagramHandle } from '../../../core/utils/event-format';
import { injectAddressSearch, injectOrganizerPicker } from '../admin-pickers';

/** Quicker than the other forms' Photon search (300 ms). */
const ADDRESS_SEARCH_DEBOUNCE_MS = 100;

// Contact patterns mirror the @URL/@Pattern on VenueCreateDto in the backend.
const WEBSITE_PATTERN = /^https?:\/\/\S+$/;
const WHATSAPP_PATTERN = /^\+?[0-9]{6,15}$/;
const FACEBOOK_PATTERN = /^https:\/\/(www\.|m\.)?facebook\.com\/.+/;
/** Instagram is stored as the bare handle, like organizers' and users'. */
const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const YOUTUBE_PATTERN = /^https:\/\/(www\.)?youtube\.com\/.+/;
const TIKTOK_PATTERN = /^https:\/\/(www\.)?tiktok\.com\/@.+/;

/** Spaces, dots, dashes and brackets are fine to type; the backend only takes "+" and digits. */
const stripPhone = (value: string): string => value.replace(/[\s().-]/g, '');

const whatsappValidator: ValidatorFn = (control) => {
  const phone = stripPhone(control.value ?? '');
  return !phone || WHATSAPP_PATTERN.test(phone) ? null : { whatsapp: true };
};

/** The handle, "@handle" or a pasted profile URL: what's checked (and saved) is the handle. */
const instagramValidator: ValidatorFn = (control) => {
  const handle = instagramHandle(control.value ?? '');
  return !handle || INSTAGRAM_HANDLE_PATTERN.test(handle) ? null : { instagram: true };
};

/** Optional text fields: empty (or only spaces) goes to the backend as null. */
const optional = (value: string): string | null => value.trim() || null;

type ContactControl = 'website' | 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'youtube' | 'tiktok';

/** The "Contatti" section, in display order — one template block for all of them. */
const CONTACT_FIELDS: {
  name: ContactControl;
  label: string;
  type: 'url' | 'tel' | 'email' | 'text';
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
    type: 'text',
    placeholder: 'nome_account',
    error: 'Solo il nome dell\'account: lettere, numeri, punti e _ (max 30).',
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
export class CreateVenue {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly citiesService = inject(CitiesService);
  private readonly router = inject(Router);

  readonly venueTypes = VENUE_TYPES;
  protected readonly contactFields = CONTACT_FIELDS;

  private readonly organizerAutocomplete = viewChild(HlmAutocomplete, { read: BrnAutocomplete });

  protected openOrganizerDropdown(): void {
    this.organizerAutocomplete()?.open();
  }

  protected clearOrganizer(): void {
    this.form.controls.organizerId.setValue('');
    this.organizer.search.set('');
  }

  protected readonly cities = toSignal(
    this.citiesService.getCities().pipe(catchError(() => of<CityDto[]>([]))),
    { initialValue: [] as CityDto[] },
  );
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
    description: ['', [Validators.maxLength(1000)]],
    // Contacts are all optional: empty is sent as null.
    website: ['', [Validators.pattern(WEBSITE_PATTERN), Validators.maxLength(100)]],
    whatsapp: ['', [whatsappValidator]],
    email: ['', [Validators.email, Validators.maxLength(100)]],
    facebook: ['', [Validators.pattern(FACEBOOK_PATTERN), Validators.maxLength(100)]],
    instagram: ['', [instagramValidator, Validators.maxLength(100)]],
    youtube: ['', [Validators.pattern(YOUTUBE_PATTERN), Validators.maxLength(100)]],
    tiktok: ['', [Validators.pattern(TIKTOK_PATTERN), Validators.maxLength(100)]],
  });

  // Organizer is optional: only venues with an organizer profile of their own get one.
  protected readonly organizer = injectOrganizerPicker(this.form.controls.organizerId);
  protected readonly address = injectAddressSearch(this.form.controls, ADDRESS_SEARCH_DEBOUNCE_MS);
  private readonly addressAutocomplete = viewChild(HlmAutocompleteSearch, { read: BrnAutocompleteSearch });

  protected openAddressDropdown(): void {
    this.addressAutocomplete()?.open();
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
      instagram: instagramHandle(value.instagram) || null,
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
    this.organizer.search.set('');
    this.address.search.set('');
    this.createdVenue.set(null);
  }

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}
