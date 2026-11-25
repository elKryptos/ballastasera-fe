import { Component, input } from '@angular/core';
import { UserDanceStyleDto } from '../../../core/models/user.model';
import { LevelMeter } from '../../level-meter/level-meter';

/**
 * "Cosa balla": one row per style the person dances, with its level (app-level-meter) on the right
 * and "anche tu" next to the ones the viewer dances too. In someone's profile, in one's own and in
 * the profile inside "Chi ci va".
 */
@Component({
  selector: 'app-profile-styles',
  imports: [LevelMeter],
  templateUrl: './profile-styles.html',
  styleUrl: './profile-styles.css',
})
export class ProfileStyles {
  readonly styles = input.required<UserDanceStyleDto[]>();
  /** The styles the viewer dances too ("anche tu"); empty on one's own profile. */
  readonly shared = input<ReadonlySet<number>>(new Set());
  /** What to say when there are none. */
  readonly emptyText = input.required<string>();
}
