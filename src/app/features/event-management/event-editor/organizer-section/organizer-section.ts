import { Component, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { BrnAutocomplete, BrnAutocompleteAnchor, BrnAutocompleteInput } from '@spartan-ng/brain/autocomplete';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { catchError, of, switchMap } from 'rxjs';
import { ORGANIZER_TYPE_LABELS, isVenueBound } from '../../../../core/config/organizer-types';
import { AdminService } from '../../../../core/services/admin.service';
import { OrganizerAvatar } from '../../../../shared/organizer-avatar/organizer-avatar';
import { injectOrganizerPicker } from '../../../admin/admin-pickers';
import { EditorSection } from '../editor-section/editor-section';
import { EventEditorFormStore } from '../event-editor-form.store';

/** "Chi la organizza", the admin's only (the organizer publishes as their page). Picked from the
 * verified organizers with the admin forms' picker; fixed once the night exists. */
@Component({
  selector: 'app-organizer-section',
  host: { class: 'block' },
  imports: [
    ReactiveFormsModule,
    HlmAutocompleteImports,
    BrnAutocompleteInput,
    BrnAutocompleteAnchor,
    EditorSection,
    OrganizerAvatar,
  ],
  templateUrl: './organizer-section.html',
})
export class OrganizerSection {
  protected readonly store = inject(EventEditorFormStore);
  private readonly admin = inject(AdminService);

  protected readonly control = this.store.form.controls.organizerId;
  protected readonly picker = injectOrganizerPicker(this.control);
  protected readonly organizer = this.store.organizer;
  protected readonly editing = computed(() => this.store.mode() === 'edit');
  protected readonly typeLabel = computed(() => {
    const organizer = this.organizer();
    return organizer ? ORGANIZER_TYPE_LABELS[organizer.type] : '';
  });
  protected readonly venueBound = computed(() => {
    const organizer = this.organizer();
    return organizer !== null && isVenueBound(organizer.type);
  });
  private readonly autocomplete = viewChild(BrnAutocomplete);

  constructor() {
    // The picked organizer's detail: its type and its contacts, which the night starts from.
    toObservable(this.picker.selected)
      .pipe(
        switchMap((picked) =>
          picked ? this.admin.getOrganizer(picked.id).pipe(catchError(() => of(null))) : of(null),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((organizer) => {
        if (!this.editing()) this.store.setOrganizer(organizer);
      });
  }

  protected openDropdown(): void {
    this.autocomplete()?.open();
  }

  protected change(): void {
    this.control.setValue('');
    this.control.markAsTouched();
    this.picker.search.set('');
  }
}
