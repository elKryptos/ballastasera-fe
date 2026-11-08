import { Component, inject, signal } from '@angular/core';
import { parseCoordinates } from '../../../../../core/utils/geo';
import { EventEditorFormStore } from '../../event-editor-form.store';

/** "Il punto non è giusto? Correggilo": the point pasted by hand, as Google Maps copies it, for an
 * address Photon places wrong or doesn't know yet. Under "Altro indirizzo". */
@Component({
  selector: 'app-spot-field',
  host: { class: 'flex flex-col gap-1.5' },
  template: `
    @if (!open()) {
    <button type="button" class="cursor-pointer self-start text-[0.8125rem] font-bold text-(--ev-link)" (click)="show()">
      Il punto non è giusto? Correggilo
    </button>
    } @else {
    <label for="editor-spot" class="text-[0.8125rem] font-bold text-lead">Coordinate</label>
    <input id="editor-spot" type="text" inputmode="decimal" autocomplete="off" placeholder="45.48812, 9.18923"
      class="request-input" [value]="typed()" (input)="onInput($any($event.target).value)" />
    @if (invalid()) {
    <p class="text-[0.8125rem] text-(--ev-error)" role="alert">Incolla latitudine e longitudine, separate da una virgola.</p>
    } @else {
    <p class="text-[0.8125rem] leading-[1.4] text-muted">
      Su Google Maps tieni premuto sul punto (dal computer: clic destro) e copia i due numeri.
    </p>
    }
    }
  `,
})
export class SpotField {
  private readonly store = inject(EventEditorFormStore);

  protected readonly open = signal(false);
  protected readonly typed = signal('');
  protected readonly invalid = signal(false);

  /** Opens on the point there is, so it's corrected rather than typed again. */
  protected show(): void {
    const { latitude, longitude } = this.store.form.controls;
    if (latitude.value !== null && longitude.value !== null) this.typed.set(`${latitude.value}, ${longitude.value}`);
    this.open.set(true);
  }

  protected onInput(text: string): void {
    this.typed.set(text);
    const spot = parseCoordinates(text);
    this.invalid.set(text.trim() !== '' && spot === null);
    if (spot) this.store.setSpot(spot);
  }
}
