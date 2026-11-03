import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LogoPicker } from '../../../shared/logo-picker/logo-picker';
import { ContactFields } from '../contact-fields/contact-fields';
import { OrganizerRequestFormStore } from '../organizer-request-form.store';
import { OrganizerTypeBadge } from '../../../shared/organizer-type-badge/organizer-type-badge';
import { RequestField } from '../../../shared/request-field/request-field';

/** The whole proposed profile of a NEW request. */
@Component({
  selector: 'app-new-profile-fields',
  imports: [ReactiveFormsModule, LogoPicker, ContactFields, OrganizerTypeBadge, RequestField],
  host: { class: 'flex flex-col gap-4.5' },
  templateUrl: './new-profile-fields.html',
})
export class NewProfileFields {
  protected readonly store = inject(OrganizerRequestFormStore);
  protected readonly controls = this.store.profile.controls;
  /** A rejected request's logo was deleted with the rejection. */
  protected readonly logoLabel = computed(() =>
    this.store.resubmittedFromId() ? 'Carica di nuovo il logo' : 'Carica il logo',
  );
}
