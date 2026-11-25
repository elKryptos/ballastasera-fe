import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventCardDto } from '../../../core/models/event.model';
import { nightTile } from '../../../core/utils/event-filters';
import { addressPrimary, formatClock } from '../../../core/utils/event-format';

/**
 * A night in a profile's list (canvas 4 and 4c, "Prossime serate"): its date card (rose tonight),
 * the title and "Città Studi · dalle 22:00", all of it a link to the night. Under the place, the
 * content marked [nightExtra] (friends going); at the end, the rest of the content (a "Ci vado").
 */
@Component({
  selector: 'app-night-row',
  imports: [RouterLink],
  templateUrl: './night-row.html',
  styleUrl: './night-row.css',
})
export class NightRow {
  readonly night = input.required<EventCardDto>();
  /** The page's clock (the app is zoneless: Date.now() in a template never refreshes). */
  readonly now = input.required<number>();

  protected readonly tile = computed(() => nightTile(this.night(), this.now()));
  protected readonly place = computed(() => {
    const night = this.night();
    const where = night.venueName ?? addressPrimary(night.address);
    return `${where} · dalle ${formatClock(night.startAt)}`;
  });
}
