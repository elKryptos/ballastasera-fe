import { Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { map, startWith, switchMap } from 'rxjs';
import { timeSlots } from '../../../../../core/utils/event-schedule';

/** The trigger's button, looking like the form's other fields; Spartan marks it invalid itself
 * (data-matches-spartan-invalid, from the select's form control). Bound with [class], never as a
 * plain class attribute: the trigger has a `class` input, and a static attribute would also land on
 * its inline host, painting stray rounded patches around the button. */
const TRIGGER_CLASS =
  'h-12 w-full rounded-[0.875rem] border-(--ev-edge) bg-(--ev-surface) px-3.5 text-base text-(--ev-text) data-placeholder:text-muted data-[matches-spartan-invalid=true]:border-(--ev-error)';

/** "Inizia alle" / "Finisce alle" in "2 · Quando": Spartan's select over the quarters of an hour,
 * from the evening on (timeSlots), the picked one in view when it opens. */
@Component({
  selector: 'app-time-select',
  imports: [ReactiveFormsModule, HlmSelectImports],
  host: { class: 'block' },
  template: `
    <hlm-select class="block" [formControl]="control()">
      <hlm-select-trigger [buttonId]="fieldId()" [class]="triggerClass">
        <hlm-select-value placeholder="--:--" />
      </hlm-select-trigger>
      <hlm-select-content *hlmSelectPortal class="max-h-72">
        @for (slot of slots(); track slot) {
        <hlm-select-item [value]="slot" class="font-mono">{{ slot }}</hlm-select-item>
        }
      </hlm-select-content>
    </hlm-select>
  `,
})
export class TimeSelect {
  readonly control = input.required<FormControl<string>>();
  /** The button's id, for the label's "for". */
  readonly fieldId = input.required<string>();
  protected readonly triggerClass = TRIGGER_CLASS;

  /** The quarters, plus the saved time when it's off them. */
  protected readonly slots = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
      map((time) => timeSlots(time)),
    ),
    { initialValue: timeSlots() },
  );
}
