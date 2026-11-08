import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventCardDto } from '../../../../core/models/event.model';
import { addressPrimary, formatClock } from '../../../../core/utils/event-format';
import { dateBadge } from '../../../../core/utils/event-schedule';
import { EventStatusBadge } from '../../event-status-badge/event-status-badge';

/** One night of the management lists, as on the canvas: the date block, the title, the time and the
 * place. The admin's card (AdminSerate) says whose night it is and where it stands; the organizer's
 * (SeratePubblicate) marks the series and the cancelled ones, and counts the likes too. Opens the
 * night's page. Presentational: the list owns the nights. */
@Component({
  selector: 'app-managed-event-card',
  imports: [RouterLink, EventStatusBadge],
  templateUrl: './managed-event-card.html',
  host: { class: 'block' },
})
export class ManagedEventCard {
  readonly event = input.required<EventCardDto>();
  /** The night's page. */
  readonly link = input.required<string>();
  readonly variant = input<'admin' | 'organizer'>('organizer');
  /** Clock tick from the list, to tell a night that's over. */
  readonly now = input.required<number>();

  protected readonly date = computed(() => dateBadge(this.event().startAt));
  protected readonly time = computed(() => formatClock(this.event().startAt));
  protected readonly place = computed(() => this.event().venueName ?? addressPrimary(this.event().address));
  protected readonly ended = computed(() => new Date(this.event().endAt).getTime() <= this.now());
  /** "Ogni venerdì": a series repeats on its night's weekday. */
  protected readonly series = computed(() => {
    const event = this.event();
    if (!event.seriesId) return null;
    return `Ogni ${new Date(event.startAt).toLocaleDateString('it-IT', { weekday: 'long' })}`;
  });
}
