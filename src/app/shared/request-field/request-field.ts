import { Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { map, startWith, switchMap } from 'rxjs';

/** A form field's label and what goes under it: its hint, its error once
 * touched, its character count. The input itself is projected, with the
 * .request-input look (styles.css). */
@Component({
  selector: 'app-request-field',
  host: { class: 'flex flex-col gap-1.5' },
  template: `
    <label [for]="fieldId()" class="text-[0.8125rem] font-bold text-(--ev-soft)">
      {{ label() }}
      @if (optional()) {
      <span class="font-medium text-muted">· facoltativo</span>
      }
    </label>
    <ng-content />
    @if (state().showError) {
    <p class="text-[0.8125rem] leading-snug text-(--ev-error)" role="alert">{{ error() }}</p>
    } @else if (hint(); as hint) {
    <p class="text-[0.8125rem] leading-snug text-muted">{{ hint }}</p>
    }
    @if (maxLength(); as max) {
    <p class="self-end font-mono text-xs text-muted">{{ state().length }}/{{ max }}</p>
    }
  `,
})
export class RequestField {
  readonly label = input.required<string>();
  /** The projected input's id. */
  readonly fieldId = input.required<string>();
  readonly control = input.required<AbstractControl>();
  readonly error = input('Campo obbligatorio.');
  readonly hint = input<string>();
  readonly optional = input(false);
  /** Shows a counter. The limit itself is the control's validator. */
  readonly maxLength = input<number>();

  protected readonly state = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) =>
        control.events.pipe(
          startWith(null),
          map(() => ({
            showError: control.invalid && control.touched,
            length: String(control.value ?? '').length,
          })),
        ),
      ),
    ),
    { initialValue: { showError: false, length: 0 } },
  );
}
