import { Component, input } from '@angular/core';
import { ProfileChip } from '../../../core/utils/profile-view';

/** Role, age, gender and country of origin next to someone's face (profileChips), each in its own
 * colour: the profile in "Chi ci va" and the profile pages. The host is the list itself, named for
 * screen readers. */
@Component({
  selector: 'ul[appProfileChips]',
  templateUrl: './profile-chips.html',
  styleUrl: './profile-chips.css',
  host: { 'aria-label': 'Chi è' },
})
export class ProfileChips {
  readonly chips = input.required<ProfileChip[]>({ alias: 'appProfileChips' });
}
