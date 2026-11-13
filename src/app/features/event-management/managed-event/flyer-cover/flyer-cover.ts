import { Component, input, output } from '@angular/core';

/** A night's flyer over its page (SerataModifica.dc.html): upright, the title written on a gradient
 * when there's none, the round camera button that changes it at once and, when there's a flyer
 * that can come off, the bin button above it that asks to take it off. */
@Component({
  selector: 'app-flyer-cover',
  host: { class: 'relative block h-35 w-28 shrink-0' },
  templateUrl: './flyer-cover.html',
})
export class FlyerCover {
  readonly flyerUrl = input<string | null>(null);
  /** Written on the gradient when there's no flyer. */
  readonly title = input.required<string>();
  readonly disabled = input(false);
  /** The bin shows only when the page says the flyer can come off (not while it's PROCESSING). */
  readonly removable = input(false);
  readonly fileSelected = output<File>();
  /** The bin was tapped: the page asks first, then takes it off. */
  readonly removeRequested = output<void>();

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileSelected.emit(file);
  }
}
