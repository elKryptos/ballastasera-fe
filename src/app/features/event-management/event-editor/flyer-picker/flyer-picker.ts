import { Component, input, output } from '@angular/core';

/** The form's "Flyer" block (SerataNuova.dc.html): the dashed "Carica" box, the flyer in it once
 * picked, and what it should be. Uploads nothing: the form sends it after saving the night. */
@Component({
  selector: 'app-flyer-picker',
  host: { class: 'flex items-center gap-3.5 rounded-[1.125rem] border border-line bg-(--ev-raised) p-4' },
  template: `
    <label
      class="relative flex h-30 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[0.875rem] border-2 border-dashed border-rose-lit/50 bg-rose-lit/6 text-xs font-extrabold text-(--ev-like) has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-amber">
      <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" [disabled]="disabled()"
        (change)="onFileChange($event)" />
      @if (previewUrl(); as preview) {
      <img [src]="preview" alt="" class="absolute inset-0 size-full object-cover" />
      <span class="sr-only">Cambia il flyer</span>
      } @else {
      <svg viewBox="0 0 24 24" class="size-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      Carica
      }
    </label>
    <div class="flex min-w-0 flex-col gap-1">
      <h2 class="text-[0.9375rem] font-extrabold">Flyer</h2>
      <p class="text-[0.8125rem] leading-snug text-lead">
        Verticale, JPG o PNG. Si carica insieme alla serata: non serve salvare prima.
      </p>
      <p class="text-xs text-muted">Facoltativo · senza flyer usiamo il logo</p>
    </div>
  `,
})
export class FlyerPicker {
  readonly previewUrl = input<string | null>(null);
  readonly disabled = input(false);
  readonly fileSelected = output<File>();

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileSelected.emit(file);
  }
}
