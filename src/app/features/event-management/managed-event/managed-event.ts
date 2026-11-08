import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, exhaustMap, finalize, switchMap, take, timer } from 'rxjs';
import { isVenueBound } from '../../../core/config/organizer-types';
import { EventDetailDto } from '../../../core/models/event.model';
import { EventManagementService } from '../../../core/services/event-management.service';
import { EventsService } from '../../../core/services/events.service';
import { formatClock } from '../../../core/utils/event-format';
import { eventDayLabel } from '../../../core/utils/event-schedule';
import { FilePreview } from '../../../core/utils/file-preview';
import { PendingAction } from '../../../core/utils/pending-action';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { EVENT_MANAGEMENT_CONTEXT } from '../event-management.context';
import { EventStatusBadge } from '../event-status-badge/event-status-badge';
import { EventDangerZone } from './event-danger-zone/event-danger-zone';
import { EventDetailsSummary } from './event-details-summary/event-details-summary';
import { FlyerCover } from './flyer-cover/flyer-cover';

/** How often a flyer being converted is asked about, and for how long (20 × 3 s = one minute). */
const FLYER_POLL_MS = 3000;
const FLYER_POLL_TRIES = 20;
const FLYER_UPLOAD_FAILED = 'Il flyer non è stato caricato. Prova con un JPG o un PNG più leggero.';

/**
 * A night's page in its management, as on the canvas (SerataModifica): its flyer, which changes at
 * once, its status, how many are going and like it, its details with a "Modifica" each, and
 * cancelling or deleting it.
 */
@Component({
  selector: 'app-managed-event',
  imports: [RouterLink, SidebarPushDirective, FlyerCover, EventStatusBadge, EventDetailsSummary, EventDangerZone],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './managed-event.html',
})
export class ManagedEvent {
  protected readonly context = inject(EVENT_MANAGEMENT_CONTEXT);
  private readonly service = inject(EventManagementService);
  private readonly events = inject(EventsService);
  private readonly router = inject(Router);

  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  protected readonly editUrl = `${this.context.basePath}/${this.id}/modifica`;
  protected readonly event = signal<EventDetailDto | null>(null);
  protected readonly loaded = signal(false);
  protected readonly loadFailed = signal(false);
  /** When the page was opened: tells a night that's over. */
  private readonly now = Date.now();
  protected readonly ended = computed(() => {
    const event = this.event();
    return event !== null && new Date(event.endAt).getTime() <= this.now;
  });
  protected readonly when = computed(() => {
    const event = this.event();
    return event ? `${eventDayLabel(event.startAt)} · ${formatClock(event.startAt)}` : '';
  });

  /** D12, for a CLUB or a VENUE managing its own night: the form only offers its venues. */
  protected readonly placeNote = computed(() => {
    const organizer = this.event()?.organizer;
    return this.context.scope === 'organizer' && organizer && isVenueBound(organizer.type)
      ? 'Sei un club o un locale: puoi scegliere solo i tuoi locali'
      : null;
  });

  protected readonly flyerUpload = new PendingAction();
  /** The new flyer, shown while the backend converts it. */
  private readonly flyerPreview = new FilePreview();
  protected readonly flyerShown = computed(() => this.flyerPreview.url() ?? this.event()?.flyerUrl ?? null);
  protected readonly flyerProcessing = computed(() => this.event()?.flyerStatus === 'PROCESSING');
  protected readonly flyerConversionFailed = computed(() => this.event()?.flyerStatus === 'FAILED');
  /** The form saved the night but its flyer didn't go up: said here, where it can be picked again. */
  protected readonly flyerSkipped = signal(!!this.router.currentNavigation()?.extras.state?.['flyerFailed']);

  constructor() {
    // Another page's night, for the organizer, is null like a missing one: "Questa serata non esiste più".
    this.service
      .getManaged(this.context.scope, this.id)
      .pipe(finalize(() => this.loaded.set(true)))
      .subscribe({
        next: (event) => this.event.set(event),
        error: () => this.loadFailed.set(true),
      });

    // While the backend converts the flyer, ask again now and then: the page shows it once it's
    // ready, or says it failed. Only the flyer is taken from the answer, so a cancel made meanwhile
    // isn't undone by an older read. flyerProcessing is a computed: it only emits when it changes.
    toObservable(this.flyerProcessing)
      .pipe(
        switchMap((processing) =>
          processing
            ? timer(FLYER_POLL_MS, FLYER_POLL_MS).pipe(
                take(FLYER_POLL_TRIES),
                exhaustMap(() => this.events.getEventDetail(this.id).pipe(catchError(() => EMPTY))),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((fresh) => {
        if (fresh.flyerStatus === 'FAILED') this.flyerPreview.clear();
        this.event.update((event) =>
          event && { ...event, flyerStatus: fresh.flyerStatus, flyerUrl: fresh.flyerUrl },
        );
      });
  }

  protected changeFlyer(file: File): void {
    this.flyerSkipped.set(false);
    this.flyerUpload.run(this.service.uploadFlyer(this.context.scope, this.id, file), {
      next: (event) => {
        this.flyerPreview.show(file);
        this.event.set(event);
      },
      errorMessage: () => FLYER_UPLOAD_FAILED,
    });
  }

  protected onCancelled(event: EventDetailDto): void {
    this.event.set(event);
  }

  protected onDeleted(): void {
    this.router.navigateByUrl(this.context.basePath);
  }
}
