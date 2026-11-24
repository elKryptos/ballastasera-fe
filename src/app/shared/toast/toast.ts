import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  ViewEncapsulation,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Toast, ToastService } from '../../core/services/toast.service';

/** How long a toast stays when nobody's on it. */
const VISIBLE_MS = 5000;

type Announcer = HTMLElement & { ariaNotify?: (message: string) => void };

/**
 * Shows ToastService's toast, once for the whole app (app.html). The region is always the same
 * element, named "Notifiche", so screen readers find every toast in one place; it goes into the
 * top layer as a manual popover where the browser has them (no light dismiss, stays over the page),
 * else it's a fixed box. The message is read out with ariaNotify(), or through a live region that's
 * on the page from the start where that's missing. It closes by itself after VISIBLE_MS, not while
 * the pointer or the focus is on it; ✕ closes it at once and gives the focus back. A toast that
 * comes while a modal dialog is open waits for it to close: behind it, it would go unseen.
 */
@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  // Unscoped (its classes are all toast-*): the entry transition needs @starting-style, which has to
  // reach the built CSS as written, without the selectors Angular would rewrite inside it.
  encapsulation: ViewEncapsulation.None,
})
export class ToastHost {
  private readonly toasts = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly region = viewChild.required<ElementRef<HTMLElement>>('region');

  /** Only where the browser has popovers: elsewhere the region is a fixed box (toast.css). */
  protected readonly popover = this.isBrowser && Object.hasOwn(HTMLElement.prototype, 'popover') ? 'manual' : null;
  protected readonly shown = signal<Toast | null>(null);
  /** The fallback's live region, for browsers without ariaNotify(). */
  protected readonly liveText = signal('');

  private timer: ReturnType<typeof setTimeout> | undefined;
  private hovered = false;
  private focused = false;
  /** Where the focus was before it went into the toast: where ✕ gives it back. */
  private returnFocus: HTMLElement | null = null;
  /** Waiting for a modal dialog to close. */
  private waiting: AbortController | null = null;

  constructor() {
    effect(() => {
      const toast = this.toasts.current();
      untracked(() => this.present(toast));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.waiting?.abort();
    });
  }

  protected close(): void {
    const toast = this.shown();
    if (!toast) return;
    const hadFocus = this.focused;
    this.toasts.dismiss(toast.id);
    if (hadFocus) this.returnFocus?.focus();
  }

  protected pointerOn(on: boolean): void {
    this.hovered = on;
    this.restartTimer();
  }

  protected focusIn(event: FocusEvent): void {
    if (!this.focused && event.relatedTarget instanceof HTMLElement) this.returnFocus = event.relatedTarget;
    this.focused = true;
    this.restartTimer();
  }

  protected focusOut(event: FocusEvent): void {
    if (this.region().nativeElement.contains(event.relatedTarget as Node | null)) return;
    this.focused = false;
    this.restartTimer();
  }

  private present(toast: Toast | null): void {
    clearTimeout(this.timer);
    this.waiting?.abort();
    this.waiting = null;
    if (!toast) {
      this.shown.set(null);
      this.setOpen(false);
      return;
    }
    if (!this.isBrowser) return;

    const modal = this.document.querySelector<HTMLDialogElement>('dialog:modal');
    if (modal) {
      const waiting = new AbortController();
      this.waiting = waiting;
      modal.addEventListener('close', () => this.present(this.toasts.current()), { once: true, signal: waiting.signal });
      return;
    }

    this.shown.set(toast);
    this.setOpen(true);
    this.announce(toast.message);
    this.restartTimer();
  }

  private restartTimer(): void {
    clearTimeout(this.timer);
    const toast = this.shown();
    if (!toast || this.hovered || this.focused) return;
    this.timer = setTimeout(() => this.toasts.dismiss(toast.id), VISIBLE_MS);
  }

  private setOpen(open: boolean): void {
    if (!this.popover) return;
    const region = this.region().nativeElement;
    if (open && !region.matches(':popover-open')) region.showPopover();
    else if (!open && region.matches(':popover-open')) region.hidePopover();
  }

  private announce(message: string): void {
    const region = this.region().nativeElement as Announcer;
    if (typeof region.ariaNotify === 'function') {
      region.ariaNotify(message);
      return;
    }
    // Emptied first: the same words set again wouldn't be read again.
    this.liveText.set('');
    setTimeout(() => this.liveText.set(message), 50);
  }
}
