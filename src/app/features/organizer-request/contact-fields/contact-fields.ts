import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { OrganizerRequestFormStore } from '../organizer-request-form.store';
import { RequestField } from '../../../shared/request-field/request-field';

/** Instagram and email: how both kinds of request prove they're theirs. */
@Component({
  selector: 'app-request-contact-fields',
  imports: [ReactiveFormsModule, RequestField],
  host: { class: 'flex flex-col gap-4.5' },
  template: `
    <ng-container [formGroup]="store.contact">
      <app-request-field label="Instagram" fieldId="request-instagram" [control]="store.contact.controls.instagram"
        [hint]="instagramHint()" error="Inserisci il nome del profilo Instagram, senza spazi.">
        <div class="request-input request-input-group">
          <span class="text-muted" aria-hidden="true">&#64;</span>
          <input id="request-instagram" type="text" formControlName="instagram" autocomplete="off" autocapitalize="none" />
        </div>
      </app-request-field>

      <app-request-field label="Email di contatto" fieldId="request-email" [control]="store.contact.controls.contactEmail"
        error="Inserisci un'email valida.">
        <input id="request-email" type="email" formControlName="contactEmail" autocomplete="email" class="request-input" />
      </app-request-field>
    </ng-container>
  `,
})
export class ContactFields {
  protected readonly store = inject(OrganizerRequestFormStore);
  readonly instagramHint = input.required<string>();
}
