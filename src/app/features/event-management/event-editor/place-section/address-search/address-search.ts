import { Component, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { BrnAutocompleteAnchor, BrnAutocompleteInput, BrnAutocompleteSearch } from '@spartan-ng/brain/autocomplete';
import { HlmAutocompleteImports, HlmAutocompleteSearch } from '@spartan-ng/helm/autocomplete';
import { map, merge, startWith } from 'rxjs';
import { MapPreview } from '../../../../../shared/map-preview/map-preview';
import { injectAddressSearch } from '../../../../admin/admin-pickers';
import { EventEditorFormStore } from '../../event-editor-form.store';
import { SpotField } from '../spot-field/spot-field';

/** "Altro indirizzo" (SerataNuova.dc.html): an address of its own, searched with Photon like the
 * admin forms, and the spot on a small map once a suggestion is picked. An address typed by hand
 * drops the old spot: the backend finds it from the address. */
@Component({
  selector: 'app-address-search',
  imports: [ReactiveFormsModule, HlmAutocompleteImports, BrnAutocompleteInput, BrnAutocompleteAnchor, MapPreview, SpotField],
  host: { class: 'flex flex-col gap-2.5' },
  templateUrl: './address-search.html',
})
export class AddressSearch {
  protected readonly controls = inject(EventEditorFormStore).form.controls;
  protected readonly address = injectAddressSearch(this.controls);
  private readonly autocomplete = viewChild(HlmAutocompleteSearch, { read: BrnAutocompleteSearch });

  /** The picked spot, [lat, lng] like the rest of the app; null until there's one. */
  protected readonly spot = toSignal(
    merge(this.controls.latitude.valueChanges, this.controls.longitude.valueChanges).pipe(
      startWith(null),
      map((): [number, number] | null => {
        const { latitude, longitude } = this.controls;
        return latitude.value !== null && longitude.value !== null ? [latitude.value, longitude.value] : null;
      }),
    ),
    { initialValue: null },
  );

  constructor() {
    // A suggestion sets the spot (injectAddressSearch); anything else typed is a new address
    // without one yet.
    this.controls.address.valueChanges.pipe(takeUntilDestroyed()).subscribe((typed) => {
      if (!this.address.suggestions().some((suggestion) => suggestion.label === typed)) {
        this.controls.latitude.setValue(null);
        this.controls.longitude.setValue(null);
      }
    });
  }

  protected openDropdown(): void {
    this.autocomplete()?.open();
  }
}
