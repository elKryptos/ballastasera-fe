import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMapPin } from '@ng-icons/lucide';
import { BrnAlertDialogContent } from '@spartan-ng/brain/alert-dialog';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { REJECT_REASON_LABELS, requiresVenue } from '../../../../core/config/organizer-types';
import { OrganizerRequestAdminDto, OrganizerRequestRejectDto } from '../../../../core/models/organizer-request.model';
import { OrganizerType } from '../../../../core/models/organizer.model';
import { VenueType, VenuesSummaryDto } from '../../../../core/models/venue.model';
import { AdminService } from '../../../../core/services/admin.service';
import { instagramHandle, instagramUrl } from '../../../../core/utils/event-format';
import { isAlreadyReviewed, requestErrorMessage } from '../../../../core/utils/organizer-request-errors';
import { requestDateLabel } from '../../../../core/utils/request-dates';
import { OrganizerAvatar } from '../../../../shared/organizer-avatar/organizer-avatar';
import { OrganizerTypeBadge } from '../../../../shared/organizer-type-badge/organizer-type-badge';
import { ExistingVenuePicker } from '../existing-venue-picker/existing-venue-picker';
import { RejectForm } from '../reject-form/reject-form';
import { RequestVenueBox } from '../request-venue-box/request-venue-box';

/** One line of the request's details. */
interface DetailRow {
  label: string;
  text: string;
  /** Opens beside the text, in a new tab. */
  href?: string;
}

/** The venue type create-venue starts from for each organizer type with a venue. */
const VENUE_TYPE_FOR: Partial<Record<OrganizerType, VenueType>> = { CLUB: 'CLUB', SCHOOL: 'SCHOOL', VENUE: 'BAR' };

/** One request: what the admin decides with, and the decision. A type with a
 * venue can't be approved without one, so "Approva" waits for one to be created
 * or picked. */
@Component({
  selector: 'app-organizer-request-card',
  imports: [
    RouterLink, NgIcon, BrnAlertDialogContent, HlmAlertDialogImports, OrganizerAvatar, OrganizerTypeBadge,
    ExistingVenuePicker, RejectForm, RequestVenueBox,
  ],
  providers: [provideIcons({ lucideMapPin })],
  host: { class: 'request-card flex flex-col gap-3.5 p-4' },
  templateUrl: './organizer-request-card.html',
})
export class OrganizerRequestCard {
  private readonly admin = inject(AdminService);

  readonly request = input.required<OrganizerRequestAdminDto>();
  /** The venue just created for this request, to link when approving. */
  readonly createdVenueId = input<string | null>(null);

  /** The decision went through, with a line saying so. */
  readonly reviewed = output<string>();
  /** Someone else got there first. */
  readonly alreadyReviewed = output<void>();

  protected readonly rejecting = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pickingVenue = signal(false);
  protected readonly pickedVenue = signal<VenuesSummaryDto | null>(null);

  protected readonly isPending = computed(() => this.request().status === 'PENDING');
  protected readonly logoUrl = computed(() => this.request().logoUrl ?? this.request().targetOrganizer?.logoUrl ?? null);
  /** With the first attempt being 1: "2º intento" after one rejection. */
  protected readonly attempt = computed(() => this.request().previousRejections + 1);

  protected readonly rows = computed<DetailRow[]>(() => {
    const { requester, instagram, contactEmail, phone, website, submittedAt } = this.request();
    return [
      { label: 'Richiesta da', text: requester.displayName },
      { label: 'Instagram', text: `@${instagramHandle(instagram)}`, href: instagramUrl(instagram) },
      { label: 'Email', text: contactEmail },
      ...(phone ? [{ label: 'Telefono', text: phone }] : []),
      ...(website ? [{ label: 'Sito web', text: website, href: website }] : []),
      { label: 'Inviata', text: requestDateLabel(submittedAt) },
    ];
  });

  /** What was decided, for a request that's no longer pending. */
  protected readonly outcome = computed(() => {
    const { status, reviewedByName, reviewedAt, rejectionReason, rejectionMessage, venueName } = this.request();
    const when = [reviewedByName, requestDateLabel(reviewedAt)].filter(Boolean).join(' · ');
    if (status === 'APPROVED') return { title: 'Approvata', when, detail: venueName ? `Locale: ${venueName}` : null };
    if (status === 'REJECTED') {
      const reason = rejectionReason ? REJECT_REASON_LABELS[rejectionReason] : 'Rifiutata';
      return { title: reason, when, detail: rejectionMessage };
    }
    return null;
  });

  private readonly needsVenue = computed(() => {
    const type = this.request().organizerType;
    return type !== null && requiresVenue(type);
  });

  /** The venue to link when approving: the one picked here wins over the one created. */
  private readonly venueToLink = computed(() => this.pickedVenue()?.id ?? this.createdVenueId());

  /** A venue is still missing: the backend would answer VENUE_REQUIRED. */
  protected readonly missingVenue = computed(
    () => this.needsVenue() && !this.venueToLink() && this.request().targetOrganizerVenues.length === 0,
  );

  protected readonly proposedAddress = computed(() => {
    const { venueAddress, venueCityName } = this.request();
    return venueAddress ? [venueAddress, venueCityName].filter(Boolean).join(', ') : null;
  });

  /** create-venue, filled in with what the request knows, coming back here with the new venue. */
  protected readonly createVenueQuery = computed(() => {
    const { id, organizerName, organizerType, venueAddress, venueCityName } = this.request();
    return {
      richiesta: id,
      nome: organizerName,
      tipo: organizerType ? VENUE_TYPE_FOR[organizerType] : undefined,
      indirizzo: venueAddress ?? undefined,
      citta: venueCityName ?? undefined,
    };
  });

  protected pickVenue(venue: VenuesSummaryDto): void {
    this.pickedVenue.set(venue);
    this.pickingVenue.set(false);
    this.errorMessage.set(null);
  }

  protected approve(): void {
    const venueId = this.venueToLink() ?? undefined;
    this.decide(this.admin.approveOrganizerRequest(this.request().id, { venueId }), 'approvata');
  }

  protected reject(body: OrganizerRequestRejectDto): void {
    this.decide(this.admin.rejectOrganizerRequest(this.request().id, body), 'rifiutata');
  }

  private decide(decision: ReturnType<AdminService['approveOrganizerRequest']>, outcome: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorMessage.set(null);

    decision.subscribe({
      next: (request) => this.reviewed.emit(`${request.organizerName}: ${outcome}.`),
      error: (error) => {
        this.busy.set(false);
        if (isAlreadyReviewed(error)) {
          this.alreadyReviewed.emit();
          return;
        }
        this.errorMessage.set(requestErrorMessage(error, {
          403: 'Questo utente è bloccato: non può diventare organizzatore. Rifiuta la richiesta.',
          ORGANIZER_LIMIT_REACHED: 'Questo utente ha già una pagina da organizzatore.',
        }));
      },
    });
  }
}
