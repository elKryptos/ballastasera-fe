import { Component, computed, input } from '@angular/core';
import { nextMilestone } from '../../../core/utils/profile-view';

/** "marzo 2026". */
function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

/** "14 marzo 2026". */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * "Traguardi" (social phase 7). The nights counted are those over that the person said "Ci vado"
 * to, as the backend counts eventsCount; the venues, the ones of those nights. One's own profile
 * (tiles, canvas 4) also has the first night and the next goal, with how many are missing; someone
 * else's (chips, canvas 4c) only the counts and since when they're on ballastasera: the date of
 * their first night is theirs alone.
 */
@Component({
  selector: 'app-profile-milestones',
  templateUrl: './profile-milestones.html',
  styleUrl: './profile-milestones.css',
})
export class ProfileMilestones {
  readonly eventsCount = input.required<number>();
  readonly venuesCount = input.required<number>();
  readonly memberSince = input<string | null>(null);
  /** Only on one's own profile. */
  readonly firstEventAt = input<string | null>(null);
  readonly own = input(false);

  protected readonly nights = computed(() => (this.eventsCount() === 1 ? '1 serata' : `${this.eventsCount()} serate`));
  protected readonly venues = computed(() => (this.venuesCount() === 1 ? '1 locale' : `${this.venuesCount()} locali`));
  protected readonly since = computed(() => {
    const first = this.firstEventAt();
    return first ? `da ${monthYear(first)}` : 'ancora nessuna';
  });
  protected readonly firstNight = computed(() => {
    const first = this.firstEventAt();
    return first ? longDate(first) : null;
  });
  protected readonly member = computed(() => {
    const since = this.memberSince();
    return since ? `Su ballastasera da ${monthYear(since)}` : null;
  });
  protected readonly next = computed(() => nextMilestone(this.eventsCount()));
}
