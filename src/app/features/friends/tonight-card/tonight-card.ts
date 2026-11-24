import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedTonightDto } from '../../../core/models/social.model';
import { EventEngagementService } from '../../../core/services/event-engagement.service';
import { formatClock } from '../../../core/utils/event-format';
import { firstNameOf } from '../../../core/utils/initials';
import { joinNames } from '../../../core/utils/profile-view';
import { PersonAvatar } from '../../../shared/person-avatar/person-avatar';

/** Faces drawn before the "+N". */
const FACES = 3;

/**
 * One night of "Stasera escono" (canvas 4d): the faces of the people the viewer follows who are going,
 * "Sara e Luca vanno a", the night and where, and the viewer's own "Vado anch'io" ("Ci vai anche tu"
 * once going, from EventEngagementService, which the feed has told who's already going).
 */
@Component({
  selector: 'app-tonight-card',
  imports: [RouterLink, PersonAvatar],
  templateUrl: './tonight-card.html',
  styleUrl: './tonight-card.css',
})
export class TonightCard {
  private readonly engagement = inject(EventEngagementService);

  readonly night = input.required<FeedTonightDto>();

  protected readonly faces = computed(() => this.night().people.slice(0, FACES));
  protected readonly more = computed(() => Math.max(0, this.night().people.length - FACES));
  protected readonly who = computed(() => {
    const names = this.night().people.map((person) => firstNameOf(person.displayName));
    const shown = names.length > FACES ? `${names.slice(0, 2).join(', ')} e altri ${names.length - 2}` : joinNames(names);
    return { names: shown, verb: names.length === 1 ? 'va a' : 'vanno a' };
  });
  protected readonly where = computed(() => {
    const night = this.night();
    const at = `dalle ${formatClock(night.eventStartAt)}`;
    return night.venueName ? `${night.venueName} · ${at}` : at;
  });
  protected readonly going = computed(() => this.engagement.isGoing(this.night().eventId));

  protected toggle(): void {
    this.engagement.toggleGoing(this.night().eventId);
  }
}
