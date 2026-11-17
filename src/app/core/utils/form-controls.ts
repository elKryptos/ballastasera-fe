import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl } from '@angular/forms';
import { startWith } from 'rxjs';

/** A form control's value as a signal. Components are OnPush by default: a template that
 * reads control.value doesn't see a change made from elsewhere (the form's reset() after
 * saving, or another component sharing the form); one that reads this signal does.
 * Call it in an injection context (a field initializer). */
export function controlValue<T>(control: AbstractControl<T>): Signal<T> {
  return toSignal(control.valueChanges.pipe(startWith(control.value)), { requireSync: true });
}

/** An on/off switch (app-toggle-switch) tapped: flips its control and marks it changed, as
 * typing in a field would. */
export function toggleControl(control: FormControl<boolean>): void {
  control.setValue(!control.value);
  control.markAsDirty();
}
