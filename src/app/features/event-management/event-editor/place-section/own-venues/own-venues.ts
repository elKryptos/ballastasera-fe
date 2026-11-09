import { Component, effect, inject, input } from '@angular/core';
import { VenuesSummaryDto } from '../../../../../core/models/venue.model';
import { EventEditorFormStore } from '../../event-editor-form.store';

/** The organizer's own venues, the ones the admin linked to their page, to pick with a tap. The only
 * choice for a CLUB or a VENUE (D12), picked on its own when there's just one. PlaceSection loads them. */
@Component({
  selector: 'app-own-venues',
  host: { class: 'flex flex-col gap-2' },
  template: `
    @if (venues(); as venues) {
    @for (venue of venues; track venue.id) {
    <button type="button" class="flex cursor-pointer items-start gap-2.5 rounded-[0.875rem] border border-line bg-(--ev-surface) p-3 text-left"
      (click)="pick(venue)">
      <svg viewBox="0 0 24 24" class="mt-px size-4.5 shrink-0 text-muted" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      <span class="text-sm leading-[1.4] text-lead">
        <b class="text-(--ev-text)">{{ venue.name }}</b><br />{{ venue.address }}
      </span>
    </button>
    } @empty {
    @if (required()) {
    <p class="text-[0.8125rem] leading-[1.4] text-muted">
      Non hai ancora un locale collegato alla tua pagina: scrivici e lo colleghiamo noi.
    </p>
    }
    }
    } @else {
    <p class="text-[0.8125rem] text-muted" role="status">Carico i tuoi locali…</p>
    }
  `,
})
export class OwnVenues {
  private readonly store = inject(EventEditorFormStore);

  /** Undefined while loading. */
  readonly venues = input<VenuesSummaryDto[] | undefined>();
  /** Only these can be picked (D12): an empty list is worth saying. */
  readonly required = input(false);

  constructor() {
    // A new night with just the one venue to choose: it's that one. Only while no venue has been
    // picked or dropped yet, so "Cambia" really leaves the choice open.
    effect(() => {
      const venues = this.venues();
      const untouched = this.store.mode() === 'create' && this.store.form.controls.venueId.pristine;
      if (this.required() && venues?.length === 1 && untouched) this.pick(venues[0]);
    });
  }

  protected pick(venue: VenuesSummaryDto): void {
    this.store.pickVenue(venue);
  }
}
