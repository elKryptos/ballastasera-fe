import { Service, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
}

/**
 * A short message on how something went that needs no answer: "Troppe richieste", "Link copiato",
 * "Ora siete amici". One at a time: a new one takes the place of the one on screen. app-toast
 * (mounted once, in app.html) shows it, says it to screen readers and closes it after a while.
 * What must not be missed goes in the page itself, next to what it's about, not here.
 */
@Service()
export class ToastService {
  private readonly currentSignal = signal<Toast | null>(null);
  readonly current = this.currentSignal.asReadonly();
  private lastId = 0;

  /** The same message already on screen isn't shown (nor read out) again: a burst of refused
   * requests is one toast. */
  show(message: string): void {
    if (this.currentSignal()?.message === message) return;
    this.currentSignal.set({ id: ++this.lastId, message });
  }

  /** Closes the toast. With an id, only if that one is still the toast: a timer that outlived
   * its toast mustn't close the next one. */
  dismiss(id?: number): void {
    if (id !== undefined && this.currentSignal()?.id !== id) return;
    this.currentSignal.set(null);
  }
}
