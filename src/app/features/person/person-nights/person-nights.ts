import { Component, effect, inject, input, untracked } from '@angular/core';
import { EventCardDto } from '../../../core/models/event.model';
import { EventEngagementService } from '../../../core/services/event-engagement.service';
import { UserActivityService } from '../../../core/services/user-activity.service';
import { UsersService } from '../../../core/services/users.service';
import { CursorList } from '../../../core/utils/cursor-list';
import { NightRow } from '../../../shared/profile/night-row/night-row';

/**
 * "Le sue prossime serate" (canvas 4c, social phase 3): the nights the person said "Ci vado" to,
 * if they show them to the viewer (the backend answers an empty list otherwise, which reads the
 * same as none), each with the viewer's own "Ci vado" ("Ci andate" when both go). The viewer's
 * own upcoming nights are asked once, so those buttons start in the right state.
 */
@Component({
  selector: 'app-person-nights',
  imports: [NightRow],
  templateUrl: './person-nights.html',
  styleUrl: './person-nights.css',
})
export class PersonNights {
  private readonly users = inject(UsersService);
  private readonly engagement = inject(EventEngagementService);
  private readonly activity = inject(UserActivityService);

  readonly userId = input.required<string>();
  readonly firstName = input.required<string>();
  /** The page's clock, for "OGGI". */
  readonly now = input.required<number>();

  protected readonly nights = new CursorList<EventCardDto>((cursor) =>
    this.users.getAttendance(this.userId(), false, cursor),
  );

  constructor() {
    effect(() => {
      this.userId();
      untracked(() => this.nights.reload());
    });
    this.activity.getMyNights('going', false).subscribe({
      next: (page) => this.engagement.markActive('going', page.items.map((night) => night.id)),
      // Without it the buttons start as "Ci vado": a tap still works, it just adds again.
      error: () => undefined,
    });
  }

  protected isGoing(night: EventCardDto): boolean {
    return this.engagement.isGoing(night.id);
  }

  protected toggle(night: EventCardDto): void {
    this.engagement.toggleGoing(night.id);
  }
}
