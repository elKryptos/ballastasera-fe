import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInstagram } from '@ng-icons/lucide';
import { WHATSAPP_PATH } from '../../../core/config/brand-icons';
import { DANCE_ROLE_LABELS, GENDER_LABELS } from '../../../core/config/dance-profile';
import { EventAttendeeDto } from '../../../core/models/event.model';
import { UserProfileDto } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { UsersService } from '../../../core/services/users.service';
import { instagramHandle, instagramUrl, waMeUrl } from '../../../core/utils/event-format';
import { firstNameOf, initialOf } from '../../../core/utils/initials';
import { personTone } from '../../../core/utils/person-tone';
import { LevelMeter } from '../../../shared/level-meter/level-meter';

type ProfileState = 'loading' | 'ready' | 'gone' | 'error';

/** Someone going to the night, opened from "Chi ci va" (attendees-sheet): their age, gender,
 * role, the styles they dance at their level and how to reach them. From the canvas' "Tocchi
 * una persona: il suo profilo". Their profile may have turned private since the list was
 * loaded: GET /users/{id} answers 404, and it says so ("Profilo non disponibile"). */
@Component({
  selector: 'app-attendee-profile',
  imports: [RouterLink, NgIcon, LevelMeter],
  providers: [provideIcons({ lucideInstagram })],
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

  protected readonly state = signal<ProfileState>('loading');
  protected readonly profile = signal<UserProfileDto | null>(null);

  protected readonly whatsappPath = WHATSAPP_PATH;
  protected readonly name = computed(() => this.attendee().displayName);
  protected readonly firstName = computed(() => firstNameOf(this.name()));
  protected readonly initial = computed(() => initialOf(this.name()));
  protected readonly tone = computed(() => personTone(this.attendee().userId));
  protected readonly isMe = computed(() => this.auth.currentUser()?.userId === this.attendee().userId);

  /** Age, gender and role, the ones given: the chips under the name. "Preferisco non dirlo" is
   * an answer for the form, not something to show. */
  protected readonly chips = computed(() => {
    const profile = this.profile();
    if (!profile) return [];
    const chips: { kind: 'age' | 'gender' | 'role'; label: string }[] = [];
    if (profile.age != null) chips.push({ kind: 'age', label: `${profile.age} anni` });
    if (profile.gender && profile.gender !== 'UNDISCLOSED') {
      chips.push({ kind: 'gender', label: GENDER_LABELS[profile.gender] });
    }
    if (profile.danceRole) chips.push({ kind: 'role', label: DANCE_ROLE_LABELS[profile.danceRole] });
    return chips;
  });

  protected readonly whatsappUrl = computed(() => waMeUrl(this.profile()?.whatsapp));
  protected readonly instagram = computed(() => {
    const handle = this.profile()?.instagram;
    return handle ? { handle: instagramHandle(handle), url: instagramUrl(handle) } : null;
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
