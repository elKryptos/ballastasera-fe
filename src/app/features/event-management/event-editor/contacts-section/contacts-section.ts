import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { InstagramInput } from '../../../../shared/instagram-input/instagram-input';
import { RequestField } from '../../../../shared/request-field/request-field';
import { EditorSection } from '../editor-section/editor-section';
import { EventEditorFormStore } from '../event-editor-form.store';

/** "5 · Contatti": the night's Instagram and the WhatsApp to book. A new night starts from the
 * venue's, else the organizer's (EventEditorFormStore). */
@Component({
  selector: 'app-contacts-section',
  host: { class: 'block' },
  imports: [ReactiveFormsModule, EditorSection, RequestField, InstagramInput],
  template: `
    <app-editor-section title="Contatti" sectionId="editor-contacts" [step]="5" note="facoltativi">
      <app-request-field label="Post o profilo Instagram" fieldId="editor-instagram" [control]="controls.instagram"
        error="Inserisci il nome del profilo Instagram, senza spazi." [hint]="hint()">
        <app-instagram-input fieldId="editor-instagram" [control]="controls.instagram" />
      </app-request-field>

      <app-request-field label="WhatsApp per prenotare" fieldId="editor-whatsapp" [control]="controls.whatsapp"
        error="Inserisci un numero di telefono, con il prefisso: +39 …">
        <input id="editor-whatsapp" type="tel" [formControl]="controls.whatsapp" placeholder="+39 …" autocomplete="tel"
          class="request-input" />
      </app-request-field>
    </app-editor-section>
  `,
})
export class ContactsSection {
  private readonly store = inject(EventEditorFormStore);
  protected readonly controls = this.store.form.controls;
  protected readonly hint = computed(() =>
    this.store.mode() === 'create'
      ? "Già compilato dal locale o dall'organizzatore: cambialo solo se la serata ha un post suo."
      : undefined,
  );
}
