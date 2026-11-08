import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Choice, ChoiceGroup } from '../choice-group/choice-group';
import { EditorSection } from '../editor-section/editor-section';
import { EventEditorFormStore } from '../event-editor-form.store';

const ENTRY_CHOICES: Choice<boolean>[] = [
  { value: true, label: 'Gratis' },
  { value: false, label: 'A pagamento' },
];

/** "4 · Ingresso": free, or its price in euro. */
@Component({
  selector: 'app-entry-section',
  host: { class: 'block' },
  imports: [ReactiveFormsModule, EditorSection, ChoiceGroup],
  template: `
    <app-editor-section title="Ingresso" sectionId="editor-entry" [step]="4">
      <app-choice-group label="Ingresso" appearance="segmented" [choices]="entryChoices" [formControl]="controls.free" />
      @if (!store.free()) {
      <div class="flex flex-col gap-1.5">
        <label for="editor-price" class="text-[0.8125rem] font-bold text-lead">Prezzo *</label>
        <div class="request-input request-input-group">
          <input id="editor-price" type="number" inputmode="decimal" min="0" step="0.5" [formControl]="controls.price" />
          <span class="text-muted" aria-hidden="true">€</span>
        </div>
        @if (store.form.hasError('priceRequired') && controls.price.touched) {
        <p class="text-[0.8125rem] text-(--ev-error)" role="alert">Inserisci il prezzo.</p>
        } @else if (controls.price.invalid && controls.price.touched) {
        <p class="text-[0.8125rem] text-(--ev-error)" role="alert">Il prezzo non può essere negativo.</p>
        }
      </div>
      }
    </app-editor-section>
  `,
})
export class EntrySection {
  protected readonly store = inject(EventEditorFormStore);
  protected readonly controls = this.store.form.controls;
  protected readonly entryChoices = ENTRY_CHOICES;
}
