import { Component, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { BrnSelectTrigger, BrnSelectValue } from '@spartan-ng/brain/select';
import { HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideImage } from '@ng-icons/lucide';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { AdminService } from '../../../core/services/admin.service';
import { VenuesService } from '../../../core/services/venues.service';
import { VenueDetailDto, VenueType } from '../../../core/models/venue.model';
import { instagramHandle } from '../../../core/utils/event-format';
import { injectAddressSearch } from '../admin-pickers';
import { ADDRESS_SEARCH_DEBOUNCE_MS, CONTACT_FIELDS, stripPhone, VENUE_TYPES, venueControls } from '../venue-form';
import { VenueLogoEditor } from '../venue-logo-editor/venue-logo-editor';

@Component({
  selector: 'app-update-venue',
  imports: [
    ReactiveFormsModule, SidebarPushDirective, HlmSelectImports, BrnSelectTrigger, BrnSelectValue,
    HlmAutocompleteImports, BrnAutocompleteInput, BrnAutocompleteAnchor, NgIcon, VenueLogoEditor,
  ],
  providers: [provideIcons({ lucideImage })],
  templateUrl: './update-venue.html',
})
export class UpdateVenue {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(AdminService);
  private readonly venuesService = inject(VenuesService);
  private readonly router = inject(Router);

  private readonly venueId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  readonly venueTypes = VENUE_TYPES;
  protected readonly contactFields = CONTACT_FIELDS;

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);
  /** As last loaded or saved: the logo editor works on it, and it's what
   * tells whether the address was changed. */
  protected readonly venue = signal<VenueDetailDto | null>(null);

  // City and organizer aren't here: the backend doesn't let an update change them.
  protected readonly form = this.fb.nonNullable.group(venueControls());

  protected readonly address = injectAddressSearch(this.form.controls, ADDRESS_SEARCH_DEBOUNCE_MS);
  private readonly addressAutocomplete = viewChild(HlmAutocompleteSearch, { read: BrnAutocompleteSearch });

  protected openAddressDropdown(): void {
    this.addressAutocomplete()?.open();
  }

  constructor() {
    this.venuesService.getVenueDetail(this.venueId).subscribe({
      next: (venue) => {
        this.venue.set(venue);
        this.form.patchValue({
          name: venue.name,
          type: venue.type,
          address: venue.address,
          latitude: venue.latitude,
          longitude: venue.longitude,
          description: venue.description ?? '',
          website: venue.website ?? '',
          whatsapp: venue.whatsapp ?? '',
          email: venue.email ?? '',
          facebook: venue.facebook ?? '',
          instagram: venue.instagram ?? '',
          youtube: venue.youtube ?? '',
          tiktok: venue.tiktok ?? '',
        });
        this.address.search.set(venue.address);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Impossibile caricare i dati del luogo.');
      },
    });
  }

  protected submit(): void {
    const venue = this.venue();
    if (!venue) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.saved.set(false);

    const value = this.form.getRawValue();
    // A new address typed by hand (not picked) keeps the old coordinates: sent
    // as null, the backend geocodes the new address instead.
    const staleCoords = value.address !== venue.address
      && value.latitude === venue.latitude && value.longitude === venue.longitude;

    // Contacts go as "" when emptied: on this PATCH, "" clears the saved value.
    this.adminService.updateVenue(venue.id, {
      name: value.name.trim(),
      type: value.type as VenueType,
      address: value.address,
      latitude: staleCoords ? null : value.latitude,
      longitude: staleCoords ? null : value.longitude,
      description: value.description.trim(),
      website: value.website.trim(),
      whatsapp: stripPhone(value.whatsapp),
      email: value.email.trim(),
      facebook: value.facebook.trim(),
      instagram: instagramHandle(value.instagram),
      youtube: value.youtube.trim(),
      tiktok: value.tiktok.trim(),
    }).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.saved.set(true);
        this.venue.set(updated);
        // The geocoded coordinates, when the backend worked them out.
        this.form.patchValue({ latitude: updated.latitude, longitude: updated.longitude });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 409) {
          this.errorMessage.set('Esiste già un luogo con questo nome in questa città.');
        } else if (err.error?.details === 'Address not found') {
          this.errorMessage.set('Indirizzo non trovato. Correggilo o inserisci latitudine e longitudine a mano.');
        } else {
          this.errorMessage.set(err.error?.message ?? 'Si è verificato un errore durante l\'aggiornamento del luogo.');
        }
      },
    });
  }

  protected backToList(): void {
    const cityId = this.venue()?.cityId;
    this.router.navigate(['/admin/venues-list'], { queryParams: cityId ? { city: cityId } : {} });
  }
}
