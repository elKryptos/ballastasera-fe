import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval, Subscription, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventDetailDto, FlyerStatus } from '@/core/models/event.model';
import { EventsService } from '@/core/services/events.service';
import { Navbar } from '@/shared/navbar/navbar';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButton } from '@spartan-ng/helm/button';

const ACCEPTED_FLYER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FLYER_SIZE = 10 * 1024 * 1024;
const FLYER_POLL_INTERVAL_MS = 3000;
const FLYER_POLL_MAX_ATTEMPTS = 20; // 20 × 3 s = 60 s, poi si passa al refresh manuale.

@Component({
  selector: 'app-publish-event',
  imports: [Navbar, HlmAlertDialogImports, BrnAlertDialogContent, HlmButton, RouterLink],
  templateUrl: './publish-event.html',
  styleUrl: './publish-event.css',
})
export class PublishEvent {
  private readonly events = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly flyerInput = viewChild<ElementRef<HTMLInputElement>>('flyerInput');

  protected readonly eventId = String(this.route.snapshot.paramMap.get('id') ?? '');

  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly event = signal<EventDetailDto | null>(null);

  protected readonly uploadingFlyer = signal(false);
  protected readonly flyerError = signal<string | null>(null);
  /** true dopo il timeout del polling: restano il refresco manuale e il retry. */
  protected readonly flyerPollExpired = signal(false);
  protected readonly refreshingFlyer = signal(false);

  protected readonly publishing = signal(false);
  protected readonly deleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly published = signal(false);

  private pollSub: Subscription | null = null;

  protected readonly flyerStatus = computed<FlyerStatus>(() => this.event()?.flyerStatus ?? 'NONE');
  protected readonly flyerUrl = computed(() => this.event()?.flyerUrl ?? null);
  protected readonly flyerReady = computed(() => this.flyerStatus() === 'READY' && !!this.flyerUrl());
  protected readonly startAtLabel = computed(() => this.formatDateTime(this.event()?.startAt));
  protected readonly endAtLabel = computed(() => this.formatDateTime(this.event()?.endAt));
  protected readonly priceLabel = computed(() => {
    const event = this.event();
    if (!event) return '';
    if (event.free) return 'Ingresso gratuito';
    return event.price != null ? `€ ${event.price}` : event.currency ?? '';
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopFlyerPolling());
    this.loadEvent();
  }

  protected loadEvent(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.events.getEventDetail(this.eventId).subscribe({
      next: (event) => {
        this.event.set(event);
        this.loading.set(false);
        // Tornando su questa pagina a metà elaborazione (ricarica, back),
        // il polling riparte da dove il backend l'ha lasciata.
        if (event.flyerStatus === 'PROCESSING') this.startFlyerPolling();
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected onFlyerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.flyerError.set(null);

    if (!ACCEPTED_FLYER_TYPES.includes(file.type)) {
      this.flyerError.set('Formato non supportato: usa un file JPEG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_FLYER_SIZE) {
      this.flyerError.set('Il file supera 10 MB: ridimensiona la foto e riprova.');
      return;
    }

    this.uploadFlyer(file);
  }

  /** Riallegare il flyer = solo un nuovo PATCH: mai un secondo POST /rest/events. */
  protected uploadFlyer(file: File): void {
    this.uploadingFlyer.set(true);
    this.events.updateFlyer(this.eventId, file).subscribe({
      next: (event) => {
        this.event.set(event);
        this.uploadingFlyer.set(false);
        this.startFlyerPolling();
      },
      error: (err) => {
        this.uploadingFlyer.set(false);
        this.flyerError.set(err?.error?.message ?? 'Caricamento del flyer non riuscito. Riprova.');
      },
    });
  }

  private startFlyerPolling(): void {
    this.stopFlyerPolling();
    this.flyerPollExpired.set(false);
    this.pollSub = interval(FLYER_POLL_INTERVAL_MS)
      .pipe(take(FLYER_POLL_MAX_ATTEMPTS), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.refreshFlyer(true);
        },
        complete: () => {
          // Timeout: se resta PROCESSING si mostra il bottone di refresco manuale.
          if (this.flyerStatus() === 'PROCESSING') this.flyerPollExpired.set(true);
        },
      });
  }

  private stopFlyerPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  /** Manualmente (o durante il polling) rilegge l'evento per aggiornare flyerStatus. */
  protected refreshFlyer(fromPolling = false): void {
    if (this.refreshingFlyer()) return;
    this.refreshingFlyer.set(true);
    this.events.getEventDetail(this.eventId).subscribe({
      next: (event) => {
        this.event.set(event);
        this.refreshingFlyer.set(false);
        if (event.flyerStatus === 'READY' || event.flyerStatus === 'FAILED') {
          this.flyerPollExpired.set(false);
          this.stopFlyerPolling();
        } else if (!fromPolling) {
          this.flyerError.set('Ancora in elaborazione: riprova tra qualche istante.');
        }
      },
      error: () => {
        this.refreshingFlyer.set(false);
        this.flyerError.set('Aggiornamento non riuscito: riprova.');
      },
    });
  }

  protected retryFlyer(): void {
    // FAILED / poll scaduto → si riparte dal file scelto dall'utente.
    this.flyerInput()?.nativeElement.click();
  }

  protected publish(): void {
    if (this.publishing()) return;
    this.publishing.set(true);
    this.errorMessage.set(null);
    this.events.updateEventStatus(this.eventId, 'PUBLISHED').subscribe({
      next: () => {
        this.publishing.set(false);
        this.published.set(true);
      },
      error: (err) => {
        this.publishing.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'Pubblicazione non riuscita: riprova.',
        );
      },
    });
  }

  protected cancelEvent(): void {
    if (this.deleting()) return;
    this.deleting.set(true);
    this.stopFlyerPolling();
    this.events.deleteEvent(this.eventId).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/organizer/events/new']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.errorMessage.set(
          err?.error?.message ?? "Impossibile eliminare l'evento. Riprova.",
        );
      },
    });
  }

  protected createAnother(): void {
    this.router.navigate(['/organizer/events/new']);
  }

  private formatDateTime(iso: string | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
