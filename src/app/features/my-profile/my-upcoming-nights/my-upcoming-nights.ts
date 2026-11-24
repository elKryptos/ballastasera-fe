import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { EventCardDto } from '../../../core/models/event.model';
import { UserSummaryDto } from '../../../core/models/social.model';
import { EventsService } from '../../../core/services/events.service';
import { UserActivityService } from '../../../core/services/user-activity.service';
import { firstNameOf } from '../../../core/utils/initials';
import { joinNames } from '../../../core/utils/profile-view';
import { PersonAvatar } from '../../../shared/person-avatar/person-avatar';
import { NightRow } from '../../../shared/profile/night-row/night-row';

/** Nights shown on the profile: the rest are in "Le tue serate". */
const SHOWN = 3;
/** Friends' faces under a night. */
const FACES = 3;

interface UpcomingNight {
  night: EventCardDto;
  friends: UserSummaryDto[];
}

/**
 * "Prossime serate" on one's own profile (canvas 4): the next nights the user said "Ci vado" to, each
 * with the friends going too ("Sara e Luca ci vanno"; one request per night, for the few shown), and
 * the way to all of them in "Le tue serate".
 */
@Component({
  selector: 'app-my-upcoming-nights',
  imports: [RouterLink, NightRow, PersonAvatar],
  templateUrl: './my-upcoming-nights.html',
  styleUrl: './my-upcoming-nights.css',
})
export class MyUpcomingNights {
  private readonly activity = inject(UserActivityService);
  private readonly events = inject(EventsService);

  readonly now = input.required<number>();

  protected readonly nights = signal<UpcomingNight[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly faces = FACES;

  constructor() {
    this.activity.getMyNights('going', false).subscribe({
      next: (page) => {
        const shown = page.items.slice(0, SHOWN);
        this.nights.set(shown.map((night) => ({ night, friends: [] })));
        for (const night of shown) {
          this.events
            .getFriendsGoing(night.id)
            .pipe(catchError(() => of([])))
            .subscribe((friends) =>
              this.nights.update((list) => list?.map((item) => (item.night.id === night.id ? { ...item, friends } : item)) ?? null),
            );
        }
      },
      error: () => this.failed.set(true),
    });
  }

  /** "Sara e Luca ci vanno", "Sara, Marco e altri 3". */
  protected friendsText(friends: UserSummaryDto[]): string {
    const names = friends.map((friend) => firstNameOf(friend.displayName));
    if (names.length > FACES) return `${names.slice(0, 2).join(', ')} e altri ${names.length - 2}`;
    return `${joinNames(names)} ${names.length === 1 ? 'ci va' : 'ci vanno'}`;
  }
}
