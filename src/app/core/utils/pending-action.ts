import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { Observable } from 'rxjs';

export interface PendingActionHandlers<T> {
  next?: (value: T) => void;
  /** After the request is over, when it went well: whatever reads the answer is done by then. */
  complete?: () => void;
  /** What to tell the user when it fails. */
  errorMessage: (error: unknown) => string;
}

/** One request a page sends on a tap: whether it's on its way, and what went wrong with
 * the last one. A tap while one is on its way is ignored. */
export class PendingAction {
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  run<T>(request: Observable<T>, handlers: PendingActionHandlers<T>): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => handlers.next?.(value),
      complete: () => {
        this.busy.set(false);
        handlers.complete?.();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(handlers.errorMessage(error));
      },
    });
  }
}

/** A form's "Salva": a PendingAction that also says "saved" until the form changes again.
 * Create it in an injection context (a field initializer), where it follows the form. */
export class FormSave extends PendingAction {
  readonly saved = signal(false);

  constructor(form: AbstractControl) {
    super();
    form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saved.set(false));
  }

  override run<T>(request: Observable<T>, handlers: PendingActionHandlers<T>): void {
    super.run(request, {
      ...handlers,
      next: (value) => {
        handlers.next?.(value);
        this.saved.set(true);
      },
    });
  }
}
