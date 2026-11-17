import { Component, input, output } from '@angular/core';

/** An on/off switch, the account's "Profilo visibile" look: rose when on. It only shows
 * `checked` and tells when it's tapped; the page changes the value. Its name is the text
 * whose id is `labelledBy`, next to it. */
@Component({
  selector: 'app-toggle-switch',
  templateUrl: './toggle-switch.html',
  styleUrl: './toggle-switch.css',
})
export class ToggleSwitch {
  readonly checked = input.required<boolean>();
  readonly labelledBy = input.required<string>();
  readonly toggled = output<void>();
}
