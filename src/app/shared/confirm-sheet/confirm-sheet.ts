import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';

/** The canvas's confirmation (SerataModifica.dc.html): a bottom sheet with the question, what
 * happens, the colored "yes" and "Torna indietro". A native modal <dialog> with the app's
 * .ev-dialog look (styles.css), like the map's filters: a sheet on phones, a card from md up.
 * Shared: a night's management (cancel, delete) and the social features (block, unfollow someone
 * private) ask the same way. */
@Component({
  selector: 'app-confirm-sheet',
  templateUrl: './confirm-sheet.html',
})
export class ConfirmSheet {
  readonly open = model(false);
  readonly titleId = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input('Torna indietro');
  readonly tone = input<'amber' | 'rose'>('rose');
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // showModal() rather than the open attribute: that's what puts it in the top layer, with Esc
    // and the focus trap.
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }

  /** A tap on the backdrop is a tap on the dialog itself, outside its content. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.busy()) this.open.set(false);
  }
}
