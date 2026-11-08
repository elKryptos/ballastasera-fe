import { Component, input, output } from '@angular/core';

/** A night's flyer over its page (SerataModifica.dc.html): upright, the title written on a gradient
 * when there's none, and the round camera button that changes it at once. */
@Component({
  selector: 'app-flyer-cover',
  host: { class: 'relative block h-35 w-28 shrink-0' },
  template: `
    @if (flyerUrl(); as flyer) {
    <img [src]="flyer" alt="Flyer della serata" class="size-full rounded-2xl object-cover" />
    } @else {
    <span role="img" aria-label="Flyer della serata"
      class="flex size-full items-end rounded-2xl bg-linear-160 from-rose via-rose/30 to-(--ev-tag-bg) p-2.5 font-display text-[0.9375rem] leading-[1.05] font-extrabold uppercase">
      {{ title() }}
    </span>
    }
    <label
      class="absolute -right-1.5 -bottom-1.5 flex size-10 cursor-pointer items-center justify-center rounded-full border-3 border-ground bg-bone text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-amber"
      [class.opacity-60]="disabled()">
      <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" [disabled]="disabled()"
        (change)="onFileChange($event)" />
      <span class="sr-only">Cambia flyer</span>
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    </label>
  `,
})
export class FlyerCover {
  readonly flyerUrl = input<string | null>(null);
  /** Written on the gradient when there's no flyer. */
  readonly title = input.required<string>();
  readonly disabled = input(false);
  readonly fileSelected = output<File>();

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileSelected.emit(file);
  }
}
