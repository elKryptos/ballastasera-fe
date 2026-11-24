import { Component, input, model, output } from '@angular/core';
import { Sheet } from '../../../shared/sheet/sheet';

/** What the profile's ⋯ does (canvas 4c). */
export type PersonAction = 'copy-link' | 'mute' | 'report' | 'block';

/**
 * The ⋯ of someone's profile (social phase 4), as a sheet: copy the link to the profile, mute or
 * unmute them (only someone followed: a stranger who bothers is blocked instead), report, block.
 * It only says what was picked and closes: the page does it.
 */
@Component({
  selector: 'app-person-menu',
  imports: [Sheet],
  templateUrl: './person-menu.html',
  styleUrl: './person-menu.css',
})
export class PersonMenu {
  readonly open = model(false);
  readonly firstName = input.required<string>();
  /** Only someone the viewer follows can be muted. */
  readonly canMute = input(false);
  readonly muted = input(false);
  readonly picked = output<PersonAction>();

  protected pick(action: PersonAction): void {
    this.open.set(false);
    this.picked.emit(action);
  }
}
