import { Component, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocomplete, HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideImage } from '@ng-icons/lucide';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { AdminService } from '../../../core/services/admin.service';
import { CitiesService } from '../../../core/services/cities.service';
import { VenueCreateDto, VenueDetailDto, VenueType } from '../../../core/models/venue.model';
import { CityDto } from '../../../core/models/city.model';
import { instagramHandle } from '../../../core/utils/event-format';
import { injectAddressSearch, injectOrganizerPicker } from '../admin-pickers';
import { ADDRESS_SEARCH_DEBOUNCE_MS, CONTACT_FIELDS, optional, stripPhone, VENUE_TYPES, venueControls } from '../venue-form';
import { VenueLogoEditor } from '../venue-logo-editor/venue-logo-editor';

@Component({
  selector: 'app-create-venue',
  imports: [
    ReactiveFormsModule, SidebarPushDirective, HlmSelectImports, BrnSelectTrigger, BrnSelectValue,
    HlmAutocompleteImports, BrnAutocompleteInput, BrnAutocompleteAnchor, NgIcon, VenueLogoEditor,
  ],
  providers: [provideIcons({ lucideImage })],
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
  /** Once set, the form is locked and the logo can be uploaded (VenueLogoEditor). */
  protected readonly createdVenue = signal<VenueDetailDto | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    organizerId: [''],
    cityId: ['' as number | '', [Validators.required]],
    ...venueControls(),
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
