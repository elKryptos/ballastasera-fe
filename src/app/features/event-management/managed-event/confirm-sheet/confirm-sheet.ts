import { Component, ElementRef, effect, input, model, output, viewChild } from '@angular/core';

/** The canvas's confirmation (SerataModifica.dc.html): a bottom sheet with the question, what
 * happens, the colored "yes" and "Torna indietro". A native modal <dialog> with the app's
 * .ev-dialog look (styles.css), like the map's filters: a sheet on phones, a card from md up. */
@Component({
  selector: 'app-confirm-sheet',
  template: `
    <dialog #dialog class="ev-dialog" [attr.aria-labelledby]="titleId()" (close)="open.set(false)"
      (click)="closeOnBackdrop($event)">
      <div class="flex flex-col gap-3 px-4 pt-5 pb-7">
        <span class="h-1 w-10 self-center rounded-full bg-bone/24 md:hidden" aria-hidden="true"></span>
        <h2 [id]="titleId()" class="font-display text-[1.375rem] font-extrabold">{{ title() }}</h2>
        <p class="text-sm leading-[1.45] text-lead">{{ text() }}</p>
        @if (error(); as message) {
        <p class="text-[0.8125rem] text-(--ev-error)" role="alert">{{ message }}</p>
        }
        <button type="button" [disabled]="busy()" (click)="confirmed.emit()"
          class="h-13 cursor-pointer rounded-2xl text-base font-extrabold text-ink disabled:cursor-default disabled:opacity-60"
          [class]="tone() === 'amber' ? 'bg-amber' : 'bg-rose-lit'">
          {{ busy() ? 'Un momento…' : confirmLabel() }}
        </button>
        <button type="button" [disabled]="busy()" (click)="open.set(false)"
          class="h-12 cursor-pointer rounded-2xl border border-bone/20 text-[0.9375rem] font-bold text-(--ev-text)">
          Torna indietro
        </button>
      </div>
    </dialog>
  `,
})
export class ConfirmSheet {
  readonly open = model(false);
  readonly titleId = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly confirmLabel = input.required<string>();
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
