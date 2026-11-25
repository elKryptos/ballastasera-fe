import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { INVITE_PRIVATE_TEXT } from '../../../core/config/social';
import { UserSummaryDto } from '../../../core/models/social.model';
import { AuthService } from '../../../core/services/auth.service';
import { EventsService } from '../../../core/services/events.service';
import { firstNameOf } from '../../../core/utils/initials';
import { joinNames } from '../../../core/utils/profile-view';
import { PersonAvatar } from '../../../shared/person-avatar/person-avatar';
import { ToggleSwitch } from '../../../shared/toggle-switch/toggle-switch';
import { InviteSheet } from '../invite-sheet/invite-sheet';

/** Friends' faces before the names say the rest. */
const FACES = 3;

/**
 * A night's page with friends (social phases 3 and 6): the viewer's friends going ("Sara e Luca ci
 * vanno"), and once the viewer says "Ci vado" to a night not over, "Cerco qualcuno con cui ballare"
 * (for this night, saved at a tap) and "Invita a ballare". A private profile can't invite: the
 * button shows disabled, saying why and where to change it. Signed out, or with nothing to show,
 * nothing is drawn. Per viewer, so asked apart from the night's (cached) detail.
 */
@Component({
  selector: 'app-night-social',
  imports: [RouterLink, PersonAvatar, ToggleSwitch, InviteSheet],
  templateUrl: './night-social.html',
  styleUrl: './night-social.css',
})
export class NightSocial {
  private readonly auth = inject(AuthService);
  private readonly events = inject(EventsService);

  readonly eventId = input.required<string>();
  readonly eventTitle = input.required<string>();
  readonly endAt = input.required<string>();
  /** The viewer said "Ci vado" (the page's own state, which its button changes). */
  readonly going = input.required<boolean>();
  /** The page's clock: a night over has no invites. */
  readonly now = input.required<number>();

  protected readonly signedIn = this.auth.isAuthenticated;
  protected readonly friends = signal<UserSummaryDto[]>([]);
  protected readonly lookingForPartner = signal(false);
  protected readonly savingPartner = signal(false);
  protected readonly inviteOpen = signal(false);
  protected readonly privateText = INVITE_PRIVATE_TEXT;

  protected readonly over = computed(() => Date.parse(this.endAt()) <= this.now());
  protected readonly canAct = computed(() => this.signedIn() && this.going() && !this.over());
  protected readonly isPrivate = computed(() => this.auth.currentUser()?.showProfilePublic === false);
  protected readonly visible = computed(() => this.friends().length > 0 || this.canAct());
  protected readonly faces = computed(() => this.friends().slice(0, FACES));
  protected readonly friendsText = computed(() => {
    const names = this.friends().map((friend) => firstNameOf(friend.displayName));
    const who = names.length > FACES ? `${names.slice(0, 2).join(', ')} e altri ${names.length - 2}` : joinNames(names);
    return `${who} ${names.length === 1 ? 'ci va' : 'ci vanno'}`;
  });

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      if (!this.signedIn()) {
        this.friends.set([]);
        return;
      }
      untracked(() =>
        this.events.getFriendsGoing(eventId).subscribe({
          next: (friends) => this.friends.set(friends),
          error: () => this.friends.set([]),
        }),
      );
    });

    // The mark is per night: asked once the viewer is going, dropped when they no longer are.
    effect(() => {
      const eventId = this.eventId();
      if (!this.signedIn() || !this.going()) {
        this.lookingForPartner.set(false);
        return;
      }
      untracked(() =>
        this.events.getMyAttendance(eventId).subscribe({
          next: (attendance) => this.lookingForPartner.set(attendance.lookingForPartner),
          error: () => undefined,
        }),
      );
    });
  }

  protected togglePartner(): void {
    if (this.savingPartner()) return;
    const value = !this.lookingForPartner();
    this.lookingForPartner.set(value);
    this.savingPartner.set(true);
    this.events.addAttendance(this.eventId(), value).subscribe({
      complete: () => this.savingPartner.set(false),
      error: () => {
        this.savingPartner.set(false);
        this.lookingForPartner.set(!value);
      },
    });
  }
}
