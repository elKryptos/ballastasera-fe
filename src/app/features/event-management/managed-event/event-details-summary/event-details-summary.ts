import { Component, computed, input } from '@angular/core';
import { EventDetailDto } from '../../../../core/models/event.model';
import { addressLine, formatClock, formatPrice, instagramHandle } from '../../../../core/utils/event-format';
import { eventDayLabel } from '../../../../core/utils/event-schedule';
import { EVENT_TYPE_CHOICES } from '../../../../core/config/event-types';

interface SummaryRow {
  label: string;
  value: string;
  note?: string | null;
}

/** "Dettagli" on a night's page (SerataModifica.dc.html): the form's blocks in one line each, to
 * read. The one «Modifica» that opens the form is the page's, next to the heading. */
@Component({
  selector: 'app-event-details-summary',
  host: { class: 'block' },
  templateUrl: './event-details-summary.html',
})
export class EventDetailsSummary {
  readonly event = input.required<EventDetailDto>();
  /** Under "Dove": "Sei un club: puoi scegliere solo i tuoi locali" (D12). */
  readonly placeNote = input<string | null>(null);

  protected readonly rows = computed((): SummaryRow[] => {
    const event = this.event();
    const type = EVENT_TYPE_CHOICES.find((choice) => choice.value === event.eventType)?.label ?? event.eventType;
    const contacts = [
      event.instagramUrl ? `@${instagramHandle(event.instagramUrl)}` : null,
      event.whatsappUrl ? 'WhatsApp' : null,
    ].filter(Boolean);
    return [
      { label: 'La serata', value: [type, event.danceStyles.join(', ')].filter(Boolean).join(' · ') },
      {
        label: 'Quando',
        value: `${eventDayLabel(event.startAt)}, ${formatClock(event.startAt)} – ${formatClock(event.endAt)}`,
      },
      {
        label: 'Dove',
        value: event.venue ? `${event.venue.name} · ${addressLine(event.address)}` : addressLine(event.address),
        note: this.placeNote(),
      },
      { label: 'Ingresso', value: formatPrice(event) },
      { label: 'Contatti', value: contacts.length ? contacts.join(' · ') : 'Nessuno' },
    ];
  });
}
