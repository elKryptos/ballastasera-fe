import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

/** An Instagram handle in the .request-input look (styles.css), with the @ in front of it.
 * Goes inside an app-request-field, which gives it its label and its error. */
@Component({
  selector: 'app-instagram-input',
  imports: [ReactiveFormsModule],
  host: { class: 'request-input request-input-group' },
  template: `
    <span class="text-muted" aria-hidden="true">&#64;</span>
    <input [id]="fieldId()" type="text" [formControl]="control()" autocomplete="off" autocapitalize="none" />
  `,
})
export class InstagramInput {
  readonly fieldId = input.required<string>();
  readonly control = input.required<FormControl<string>>();
}
