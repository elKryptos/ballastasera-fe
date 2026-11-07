import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCamera } from '@ng-icons/lucide';

/** Picks an image and shows it round, without uploading anything: whoever uses
 * it holds the file and its preview, and decides when it goes up. */
@Component({
  selector: 'app-logo-picker',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCamera })],
  host: { class: 'block' },
  template: `
    <label class="flex cursor-pointer items-center gap-3.5">
      <input type="file" accept="image/png,image/jpeg,image/webp" class="peer sr-only" (change)="onFileChange($event)" />
      <span
        class="flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-(--ev-edge) bg-(--ev-surface) text-(--ev-soft) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-amber">
        @if (previewUrl(); as preview) {
        <img [src]="preview" alt="" class="size-full object-cover" />
        } @else {
        <ng-icon name="lucideCamera" size="1.5rem" aria-hidden="true" />
        }
      </span>
      <span>
        <span class="block text-[0.9375rem] font-extrabold">
          {{ label() }}
          @if (optional()) {
          <span class="font-medium text-muted">· facoltativo</span>
          }
        </span>
        <span class="mt-0.5 block text-[0.8125rem] leading-snug text-muted">{{ hint() }}</span>
      </span>
    </label>
  `,
})
export class LogoPicker {
  readonly previewUrl = input<string | null>(null);
  readonly label = input('Carica il logo');
  readonly hint = input('Quadrato, PNG o JPG.');
  /** A request's logo is optional; changing the one a page has isn't a field to skip. */
  readonly optional = input(true);
  readonly fileSelected = output<File>();

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileSelected.emit(file);
  }
}
