import { Component, input, output } from '@angular/core';

/** The form's "Flyer" block (SerataNuova.dc.html): the dashed "Carica" box, the flyer in it once
 * picked, what it should be and «Rimuovi». Uploads and deletes nothing: the form does both after
 * saving the night. A saved flyer marked to come off shows «Ripristina» until then. */
@Component({
  selector: 'app-flyer-picker',
  host: { class: 'flex items-center gap-3.5 rounded-[1.125rem] border border-line bg-(--ev-raised) p-4' },
  templateUrl: './flyer-picker.html',
})
export class FlyerPicker {
  readonly previewUrl = input<string | null>(null);
  readonly disabled = input(false);
  /** A picked file, or a saved flyer that's done converting: «Rimuovi» is offered. */
  readonly removable = input(false);
  /** The saved flyer is marked to come off on save: «Ripristina» instead. */
  readonly removalPending = input(false);
  /** The saved flyer is still being converted: said instead of «Rimuovi», with the box disabled. */
  readonly processing = input(false);
  readonly fileSelected = output<File>();
  readonly removed = output<void>();
  readonly restored = output<void>();

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.fileSelected.emit(file);
  }
}
