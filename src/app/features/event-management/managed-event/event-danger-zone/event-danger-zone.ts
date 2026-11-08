import { Component, computed, inject, input, output, signal } from '@angular/core';
import { EventDetailDto } from '../../../../core/models/event.model';
import { EventManagementService } from '../../../../core/services/event-management.service';
import { PendingAction } from '../../../../core/utils/pending-action';
import { EVENT_MANAGEMENT_CONTEXT } from '../../event-management.context';
import { eventErrorMessage } from '../../event-management-errors';
import { ConfirmSheet } from '../confirm-sheet/confirm-sheet';

/**
 * "Se qualcosa cambia", at the bottom of a night's page (SerataModifica.dc.html): cancelling it,
 * which keeps it online marked "Annullata" (for a night already announced), or deleting it, flyer
 * included (for a mistake). Each asks first in a bottom sheet, which says how many are going.
 * Cancelling can't be undone: there's no way back to PUBLISHED from here.
 */
@Component({
  selector: 'app-event-danger-zone',
  imports: [ConfirmSheet],
  host: { class: 'flex flex-col gap-2.5' },
  templateUrl: './event-danger-zone.html',
})
export class EventDangerZone {
  private readonly context = inject(EVENT_MANAGEMENT_CONTEXT);
  private readonly service = inject(EventManagementService);

  readonly event = input.required<EventDetailDto>();
  /** It's over: there's nothing left to cancel. */
  readonly ended = input(false);
  readonly cancelled = output<EventDetailDto>();
  readonly deleted = output<void>();

  protected readonly asking = signal<'cancel' | 'delete' | null>(null);
  protected readonly cancelling = new PendingAction();
  protected readonly deleting = new PendingAction();
  protected readonly canCancel = computed(() => this.event().status === 'PUBLISHED' && !this.ended());

  /** "23 persone hanno detto «ci vado»", or nothing when nobody has. */
  private readonly going = computed(() => {
    const count = this.event().goingCount;
    if (count === 0) return null;
    return count === 1 ? 'Una persona ha detto «ci vado»' : `${count} persone hanno detto «ci vado»`;
  });
  protected readonly cancelText = computed(() =>
    [this.going(), 'La serata resta online con la scritta «Annullata» e non si può riattivare.']
      .filter(Boolean)
      .join('. '),
  );
  protected readonly deleteText = computed(() => {
    const going = this.going();
    return going
      ? `${going} e la perderanno dalla loro lista senza avviso. Se l'hai già annunciata, meglio annullarla.`
      : 'Sparisce del tutto, flyer compreso. Non si può tornare indietro.';
  });

  protected ask(action: 'cancel' | 'delete' | null): void {
    this.asking.set(action);
  }

  protected cancel(): void {
    this.cancelling.run(this.service.updateStatus(this.context.scope, this.event().id, 'CANCELLED'), {
      next: (updated) => {
        this.asking.set(null);
        this.cancelled.emit(updated);
      },
      errorMessage: eventErrorMessage,
    });
  }

  protected delete(): void {
    this.deleting.run(this.service.delete(this.context.scope, this.event().id), {
      complete: () => {
        this.asking.set(null);
        this.deleted.emit();
      },
      errorMessage: eventErrorMessage,
    });
  }
}
