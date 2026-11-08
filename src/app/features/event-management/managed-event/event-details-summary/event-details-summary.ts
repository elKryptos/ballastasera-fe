import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventDetailDto } from '../../../../core/models/event.model';
import { addressLine, formatClock, formatPrice, instagramHandle } from '../../../../core/utils/event-format';
import { eventDayLabel } from '../../../../core/utils/event-schedule';
import { EVENT_TYPE_CHOICES } from '../../../../core/config/event-types';

interface SummaryRow {
  label: string;
  value: string;
  note?: string | null;
}

/** "Dettagli" on a night's page (SerataModifica.dc.html): the form's blocks in one line each, each
 * with its "Modifica", which opens the form. */
@Component({
  selector: 'app-event-details-summary',
  imports: [RouterLink],
  host: { class: 'flex flex-col rounded-[1.125rem] border border-line bg-(--ev-raised)' },
  template: `
    @for (row of rows(); track row.label) {
    <a [routerLink]="editUrl()"
      class="flex min-h-16 items-center gap-3 border-t border-bone/10 px-3.5 py-2.5 text-(--ev-text) no-underline first:border-t-0">
      <span class="flex min-w-0 grow flex-col gap-0.5">
        <span class="text-xs font-bold text-muted">{{ row.label }}</span>
        <span class="text-[0.9375rem] leading-[1.3] font-semibold">{{ row.value }}</span>
        @if (row.note; as note) {
        <span class="text-xs text-mint">{{ note }}</span>
        }
      </span>
      <span class="text-[0.8125rem] font-extrabold text-(--ev-like)">Modifica</span>
    </a>
    }
  `,
})
export class EventDetailsSummary {
  readonly event = input.required<EventDetailDto>();
  readonly editUrl = input.required<string>();
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
