/**
 * A tap on a modal <dialog>'s backdrop, where closedby="any" doesn't do it by itself (Safari) or isn't
 * used. By the pointer's position, not the event's target: the dialog is also the target of its own
 * padding and of the gaps between its children. And only when the press and the release are both
 * outside: a text selection dragged out of the sheet onto the backdrop doesn't close it.
 */
export class BackdropDismiss {
  private pressedOutside = false;

  /** From the dialog's (pointerdown). */
  down(event: PointerEvent, dialog: HTMLDialogElement): void {
    this.pressedOutside = isOutside(event, dialog);
  }

  /** From the dialog's (pointerup): whether this was a tap on the backdrop. */
  up(event: PointerEvent, dialog: HTMLDialogElement): boolean {
    const tapped = this.pressedOutside && isOutside(event, dialog);
    this.pressedOutside = false;
    return tapped;
  }
}

function isOutside(event: PointerEvent, dialog: HTMLDialogElement): boolean {
  const box = dialog.getBoundingClientRect();
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
}
