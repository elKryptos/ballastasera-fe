import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEATURE_FLAGS } from '../../../core/config/feature-flags';
import { EventAttendeeDto } from '../../../core/models/event.model';
import { UserProfileDto } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { FeatureFlagService } from '../../../core/services/feature-flag.service';
import { UsersService } from '../../../core/services/users.service';
import { firstNameOf, initialOf } from '../../../core/utils/initials';
import { personPath } from '../../../core/utils/person-links';
import { personTone } from '../../../core/utils/person-tone';
import { profileChips } from '../../../core/utils/profile-view';
import { FollowButton, FollowTarget } from '../../../shared/follow-button/follow-button';
import { ProfileChips } from '../../../shared/profile/profile-chips/profile-chips';
import { ProfileContacts } from '../../../shared/profile/profile-contacts/profile-contacts';
import { ProfileStyles } from '../../../shared/profile/profile-styles/profile-styles';

type ProfileState = 'loading' | 'ready' | 'gone' | 'error';

/** Someone going to the night, opened from "Chi ci va" (attendees-sheet): their age, gender,
 * role, the styles they dance at their level and how to reach them. From the canvas' "Tocchi
 * una persona: il suo profilo". Their profile may have turned private since the list was
 * loaded: GET /users/{id} answers 404, and it says so ("Profilo non disponibile"). With the
 * social flag, "Segui" and the way to their whole page (/persona/{id}) too. */
@Component({
  selector: 'app-attendee-profile',
  imports: [RouterLink, FollowButton, ProfileChips, ProfileContacts, ProfileStyles],
  templateUrl: './attendee-profile.html',
  styleUrl: './attendee-profile.css',
})
export class AttendeeProfile {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);

  /** Who was tapped in the list: their name and photo show while the profile loads. */
  readonly attendee = input.required<EventAttendeeDto>();
  /** "‹ Chi ci va" (in the sheet's header) is the way back; "Profilo non disponibile" has its own. */
  readonly back = output<void>();

  protected readonly socialEnabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.social);
  protected readonly state = signal<ProfileState>('loading');
  protected readonly profile = signal<UserProfileDto | null>(null);

  protected readonly name = computed(() => this.attendee().displayName);
  protected readonly firstName = computed(() => firstNameOf(this.name()));
  protected readonly initial = computed(() => initialOf(this.name()));
  protected readonly tone = computed(() => personTone(this.attendee().userId));
  protected readonly isMe = computed(() => this.auth.currentUser()?.userId === this.attendee().userId);
  protected readonly profilePath = computed(() => personPath(this.attendee().userId));

  /** Role, age, gender and country of origin, the ones given: the chips under the name. */
  protected readonly chips = computed(() => {
    const profile = this.profile();
    return profile ? profileChips(profile) : [];
  });

  /** One's own WhatsApp shows to its owner even when hidden from the others: say which. */
  protected readonly whatsappHint = computed(() => {
    if (!this.isMe()) return 'Si apre la chat';
    return this.auth.currentUser()?.whatsappVisibility === 'NOBODY' ? 'Lo vedi solo tu' : 'Lo vede chi apre il tuo profilo';
  });

  constructor() {
    // A new person tapped: their profile, from the start.
    effect(() => {
      const userId = this.attendee().userId;
      untracked(() => this.load(userId));
    });
  }

  /** The profile loaded is public (it answered): the button can follow them. */
  protected followTarget(profile: UserProfileDto): FollowTarget {
    return { ...profile, profilePublic: true };
  }

  protected retry(): void {
    this.load(this.attendee().userId);
  }

  private load(userId: string): void {
    this.state.set('loading');
    this.profile.set(null);
    // An answer for someone tapped before the current one is dropped.
    const stillCurrent = () => this.attendee().userId === userId;
    this.users.getProfile(userId).subscribe({
      next: (profile) => {
        if (!stillCurrent()) return;
        this.profile.set(profile);
        this.state.set('ready');
      },
      error: (error: unknown) => {
        if (!stillCurrent()) return;
        this.state.set(error instanceof HttpErrorResponse && error.status === 404 ? 'gone' : 'error');
      },
    });
  }
}
