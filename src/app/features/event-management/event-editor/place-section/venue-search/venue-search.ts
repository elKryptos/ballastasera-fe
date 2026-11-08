import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput } from '@spartan-ng/brain/autocomplete';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { injectVenuePicker } from '../../../../admin/admin-pickers';
import { EventEditorFormStore } from '../../event-editor-form.store';

/** Any venue of the chosen city, searched by name with the admin forms' picker. Picking one hands
 * it to the form, which then shows it instead of this. */
@Component({
  selector: 'app-venue-search',
  imports: [ReactiveFormsModule, HlmAutocompleteImports, BrnAutocompleteInput, BrnAutocompleteAnchor],
  host: { class: 'flex flex-col gap-1.5' },
  template: `
    <label for="editor-venue-search" class="text-[0.8125rem] font-bold text-lead">Locale *</label>
    <hlm-autocomplete class="block" [formControl]="store.form.controls.venueId" [itemToString]="picker.itemToString"
      [search]="picker.search()" (searchChange)="picker.search.set($event)">
      <input id="editor-venue-search" brnAutocompleteInput brnAutocompleteAnchor placeholder="Cerca il locale per nome"
        class="request-input" (click)="openDropdown()" />
      <ng-template hlmAutocompletePortal>
        <hlm-autocomplete-content>
          <div hlmAutocompleteList>
            @for (venue of picker.venues(); track venue.id) {
            <hlm-autocomplete-item [value]="venue.id">{{ venue.name }}</hlm-autocomplete-item>
            }
            <hlm-autocomplete-empty>Nessun locale trovato in questa città</hlm-autocomplete-empty>
          </div>
        </hlm-autocomplete-content>
      </ng-template>
    </hlm-autocomplete>
  `,
})
export class VenueSearch {
  protected readonly store = inject(EventEditorFormStore);
  /** The picker shows the venue's address in an address search: here there's none, the form shows
   * the venue itself. */
  protected readonly picker = injectVenuePicker(this.store.form.controls, signal(''));
  private readonly autocomplete = viewChild(BrnAutocomplete);

  constructor() {
    effect(() => {
      const venue = this.picker.selected();
      if (venue) this.store.pickVenue(venue);
    });
  }

  protected openDropdown(): void {
    this.autocomplete()?.open();
  }
}
