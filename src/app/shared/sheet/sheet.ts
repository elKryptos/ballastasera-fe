import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, effect, inject, input, model, viewChild } from '@angular/core';
import { BackdropDismiss } from '../../core/utils/backdrop-dismiss';

/** Light dismiss without closedby (Safari): only a click on the backdrop itself. */
const NATIVE_LIGHT_DISMISS = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

let nextId = 0;

/**
 * A modal sheet with the app's .ev-dialog look (styles.css): from the bottom on phones, a card from
 * md up. Its title is its accessible name; ✕, Esc and a tap outside close it (closedby="any", with
 * a fallback where the browser lacks it), but not while `busy` (a request on its way). The content
 * is the body; [sheetFooter] stays pinned under it while the body scrolls. For the social features'
 * sheets: the profile's ⋯ menu, "Segnala", "Invita a ballare", the people blocked.
 */
@Component({
  selector: 'app-sheet',
  templateUrl: './sheet.html',
  styleUrl: './sheet.css',
})
export class Sheet {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly open = model(false);
  readonly title = input.required<string>();
  /** A line under the title. */
  readonly subtitle = input<string | null>(null);
  readonly busy = input(false);

  protected readonly titleId = `sheet-title-${++nextId}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly backdrop = new BackdropDismiss();

  constructor() {
    // showModal() puts it in the top layer, makes the page behind inert and traps the focus.
    effect(() => {
      if (!this.isBrowser) return;
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }

  protected close(): void {
    if (!this.busy()) this.open.set(false);
  }

  /** Esc and light dismiss arrive as a cancel: refused while busy. */
  protected onCancel(event: Event): void {
    if (this.busy()) event.preventDefault();
  }

  /** The fallback for light dismiss, where closedby isn't known: see BackdropDismiss. */
  protected pointerDown(event: PointerEvent): void {
    if (!NATIVE_LIGHT_DISMISS) this.backdrop.down(event, this.dialog().nativeElement);
  }

  protected pointerUp(event: PointerEvent): void {
    if (!NATIVE_LIGHT_DISMISS && this.backdrop.up(event, this.dialog().nativeElement)) this.close();
  }
}
