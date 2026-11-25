import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SocialRelation } from '../../../core/models/social.model';
import { personTone } from '../../../core/utils/person-tone';
import { ProfileView, profileChips } from '../../../core/utils/profile-view';
import { followsMe, isFriend } from '../../../core/utils/relation';
import { PersonAvatar } from '../../person-avatar/person-avatar';
import { ProfileChips } from '../profile-chips/profile-chips';

/**
 * The top of a profile page (canvas 4 and 4c): a band in the person's colour, their face over it
 * with role, age and country next to it, the name ("Ti segue" or "Amici" beside it), @username and
 * city, the bio, and the three numbers (serate, seguaci, seguiti). What's done from here (Segui,
 * Invita, Modifica profilo) is the page's: the content goes under the numbers; [avatarAction]
 * (one's own camera button) sits on the face.
 */
@Component({
  selector: 'app-profile-hero',
  imports: [RouterLink, PersonAvatar, ProfileChips],
  templateUrl: './profile-hero.html',
  styleUrl: './profile-hero.css',
  host: { '[style.--tone]': 'tone().bg' },
})
export class ProfileHero {
  readonly view = input.required<ProfileView>();
  /** The viewer's relation with them; null on one's own profile. */
  readonly relation = input<SocialRelation | null>(null);
  /** The mint dot: looking for someone to dance with tonight. */
  readonly lookingForPartner = input(false);
  /** One's own: followers and following lead to their lists in "Amici". */
  readonly linkStats = input(false);

  protected readonly tone = computed(() => personTone(this.view().userId));
  protected readonly chips = computed(() => profileChips(this.view()));
  protected readonly badge = computed(() => {
    const relation = this.relation();
    if (isFriend(relation)) return { label: 'Amici', friends: true };
    if (followsMe(relation)) return { label: 'Ti segue', friends: false };
    return null;
  });
}
