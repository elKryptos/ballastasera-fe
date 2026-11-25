import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';
import { BackdropDismiss } from '../../core/utils/backdrop-dismiss';

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
  private readonly backdrop = new BackdropDismiss();

  constructor() {
    // showModal() rather than the open attribute: that's what puts it in the top layer, with Esc
    // and the focus trap.
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected pointerDown(event: PointerEvent): void {
    this.backdrop.down(event, this.dialog().nativeElement);
  }

  /** A tap on the backdrop closes it, as "Torna indietro" does: not while the action is on its way. */
  protected pointerUp(event: PointerEvent): void {
    if (this.backdrop.up(event, this.dialog().nativeElement) && !this.busy()) this.open.set(false);
  }

  /** Esc, the same: refused while busy. */
  protected onCancel(event: Event): void {
    if (this.busy()) event.preventDefault();
  }
}
