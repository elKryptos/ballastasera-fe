import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { FEATURE_FLAGS } from '../../../core/config/feature-flags';
import { REJECT_REASON_LABELS } from '../../../core/config/organizer-types';
import { OrganizerRequestDto } from '../../../core/models/organizer-request.model';
import { FeatureFlagService } from '../../../core/services/feature-flag.service';
import { OrganizerRequestsService } from '../../../core/services/organizer-requests.service';
import { requestDayLabel } from '../../../core/utils/request-dates';
import { RailTooltip } from '../../directives/rail-tooltip.directive';

const REQUEST_URL = '/diventa-organizzatore';

/** What the card says about a request that's in review or was turned down. */
interface RequestStatus {
  tone: 'drawer-promo-pending' | 'drawer-promo-rejected';
  title: string;
  text: string;
  /** Why it was turned down. */
  reason?: string;
  reasonMessage?: string | null;
  action: { label: string; url: string; queryParams?: Record<string, string>; primary: boolean };
  /** The three steps of the request, how many are done: in review only. */
  progress?: boolean[];
}

function statusOf(request: OrganizerRequestDto | null): RequestStatus | null {
  if (request?.status === 'PENDING') {
    return {
      tone: 'drawer-promo-pending',
      title: 'Richiesta in revisione',
      text: `${request.organizerName} · inviata ${requestDayLabel(request.submittedAt)}. Ti avvisiamo appena è approvata.`,
      progress: [true, true, false],
      action: { label: 'Vedi la richiesta', url: `${REQUEST_URL}/richiesta-inviata`, primary: false },
    };
  }
  if (request?.status === 'REJECTED') {
    return {
      tone: 'drawer-promo-rejected',
      title: 'Richiesta non approvata',
      text: request.organizerName,
      reason: request.rejectionReason ? REJECT_REASON_LABELS[request.rejectionReason] : undefined,
      reasonMessage: request.rejectionMessage,
      action: { label: 'Modifica e reinvia', url: `${REQUEST_URL}/chi-sei`, queryParams: { da: request.id }, primary: true },
    };
  }
  return null;
}

/** The admin deleted the page a request was asking for: the request was
 * cancelled with a message, and no email tells the user. */
function removedPageMessage(request: OrganizerRequestDto | null): string | null {
  return request?.status === 'CANCELLED' && request.rejectionMessage && !request.acknowledgedAt
    ? request.rejectionMessage
    : null;
}

/**
 * The menu's "Organizza" card, for users: the invitation to become an
 * organizer or, with a request sent, how that's going. Approved or cancelled
 * reads as the invitation: an approved user who still has the USER role has
 * since given the page up. Until organizerRequestPage is on, the invitation
 * is shown but not linked.
 */
@Component({
  selector: 'app-organizer-menu-card',
  imports: [NgTemplateOutlet, RouterLink, RailTooltip],
  templateUrl: './organizer-menu-card.html',
})
export class OrganizerMenuCard {
  private readonly requests = inject(OrganizerRequestsService);

  /** A link was followed: the mobile drawer closes. */
  readonly navigated = output<void>();

  protected readonly requestUrl = REQUEST_URL;
  protected readonly enabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage);
  protected readonly status = computed(() => statusOf(this.requests.myRequest()));
  /** Told once: it's acknowledged as soon as it shows, and stays until the menu goes. */
  protected readonly notice = signal<string | null>(null);

  /** Nothing shows until there's an answer, so the invitation doesn't flash at someone in review. */
  protected readonly ready = computed(() => !this.enabled || this.requests.isLoaded() || this.requests.loadFailed());

  constructor() {
    // Loading it and keeping it fresh: watchOrganizerRequest, from the navbar.
    effect(() => {
      const request = this.requests.myRequest();
      const message = removedPageMessage(request);
      if (!request || !message) return;
      untracked(() => {
        this.notice.set(message);
        // Not worth bothering anyone over: at worst it's told once more.
        this.requests.acknowledge(request.id).pipe(catchError(() => of(null))).subscribe();
      });
    });
  }
}
