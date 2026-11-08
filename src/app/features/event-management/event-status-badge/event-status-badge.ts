import { Component, computed, input } from '@angular/core';
import { EventStatus } from '../../../core/models/event.model';

interface Badge {
  label: string;
  classes: string;
}

const PAST: Badge = { label: 'Passata', classes: 'bg-bone/12 text-lead' };
const BY_STATUS: Record<EventStatus, Badge> = {
  PUBLISHED: { label: 'Pubblicata', classes: 'bg-mint/16 text-mint' },
  CANCELLED: { label: 'Annullata', classes: 'bg-rose-lit/16 text-(--ev-like)' },
  DRAFT: { label: 'Bozza', classes: 'bg-bone/12 text-lead' },
  PENDING: { label: 'In revisione', classes: 'bg-bone/12 text-lead' },
};

/** Where a night stands, as the canvas marks it: "Pubblicata", "Annullata", or "Passata" once it's
 * over and wasn't cancelled. Small on the lists' cards, bigger over a night's title. */
@Component({
  selector: 'app-event-status-badge',
  host: { class: 'inline-flex' },
  template: `
    <span class="font-extrabold" [class]="badge().classes + (size() === 'md' ? ' rounded-[0.5625rem] px-2.5 py-0.75 text-xs' : ' rounded-lg px-2 py-0.5 text-[0.6875rem]')">
      {{ badge().label }}
    </span>
  `,
})
export class EventStatusBadge {
  readonly status = input.required<EventStatus>();
  /** It's over: a cancelled night still reads "Annullata". */
  readonly ended = input(false);
  readonly size = input<'sm' | 'md'>('sm');

  protected readonly badge = computed(() =>
    this.ended() && this.status() !== 'CANCELLED' ? PAST : BY_STATUS[this.status()],
  );
}
