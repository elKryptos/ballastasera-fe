import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideInstagram, lucideMail, lucideMapPin, lucidePhone } from '@ng-icons/lucide';
import { OrganizerRequestsService } from '../../../../core/services/organizer-requests.service';
import { instagramHandle } from '../../../../core/utils/event-format';
import { requestErrorCode, requestErrorMessage } from '../../../../core/utils/organizer-request-errors';
import { OrganizerAvatar } from '../../../../shared/organizer-avatar/organizer-avatar';
import { OrganizerRequestFormStore, requestStepUrl } from '../../organizer-request-form.store';
import { OrganizerTypeBadge } from '../../../../shared/organizer-type-badge/organizer-type-badge';
import { RequestStepShell } from '../../request-step/request-step';

/** One line of the summary. */
interface SummaryRow {
  icon: string;
  /** In bold, above the text: a venue's name. */
  title?: string;
  text: string;
}

const WHAT_HAPPENS_NEXT = [
  { title: 'Controlliamo i dati', text: 'Di solito entro 48 ore.' },
  { title: 'Verifichiamo che sia tuo', text: 'Potremmo scriverti su Instagram da @ballastasera.' },
  { title: 'Ti avvisiamo', text: 'Per email e qui nel menu. Da lì pubblichi le tue serate.' },
];

/** Last step: the summary, and sending. */
@Component({
  selector: 'app-request-conferma',
  imports: [ReactiveFormsModule, RouterLink, NgIcon, OrganizerAvatar, OrganizerTypeBadge, RequestStepShell],
  providers: [provideIcons({ lucideGlobe, lucideInstagram, lucideMail, lucideMapPin, lucidePhone })],
  host: { class: 'block' },
  templateUrl: './conferma.html',
})
export class Conferma {
  protected readonly store = inject(OrganizerRequestFormStore);
  private readonly requests = inject(OrganizerRequestsService);
  private readonly router = inject(Router);

  protected readonly whatHappensNext = WHAT_HAPPENS_NEXT;
  protected readonly profileUrl = requestStepUrl('profilo');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly name = computed(
    () => this.store.claimTarget()?.name ?? this.store.profile.controls.name.value,
  );
  protected readonly type = computed(() => this.store.claimTarget()?.type ?? this.store.organizerType());
  protected readonly logoUrl = computed(() =>
    this.store.mode() === 'CLAIM'
      ? (this.store.claimDetails()?.detail.logoUrl ?? this.store.claimTarget()?.logoUrl ?? null)
      : this.store.logoPreviewUrl(),
  );

  protected readonly rows = computed<SummaryRow[]>(() => {
    const { instagram, contactEmail } = this.store.contact.getRawValue();
    const { phone, website } = this.store.profile.getRawValue();
    const rows: SummaryRow[] = [
      { icon: 'lucideInstagram', text: `@${instagramHandle(instagram)}` },
      { icon: 'lucideMail', text: contactEmail },
    ];

    if (this.store.mode() === 'CLAIM') {
      for (const venue of this.store.claimDetails()?.venues ?? []) {
        rows.push({ icon: 'lucideMapPin', title: venue.name, text: `${venue.address}, ${venue.cityName}` });
      }
      return rows;
    }

    if (phone) rows.push({ icon: 'lucidePhone', text: phone });
    if (website) rows.push({ icon: 'lucideGlobe', text: website });
    if (this.store.needsLocale()) {
      rows.push({ icon: 'lucideMapPin', text: `${this.store.venueAddress()}, ${this.store.venueCityName()}` });
    }
    return rows;
  });

  protected submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.requests.submit(this.store.toCreateDto(), this.store.logoFile()).subscribe({
      next: ({ logoUploaded }) => this.leave(!logoUploaded),
      error: (error) => {
        this.submitting.set(false);
        // Sent from another tab, or twice: show the one that's already in review.
        if (requestErrorCode(error) === 'PENDING_REQUEST_EXISTS') {
          this.requests.load().subscribe({
            next: () => this.leave(false),
            error: () => this.errorMessage.set(requestErrorMessage(error)),
          });
          return;
        }
        this.errorMessage.set(requestErrorMessage(error));
      },
    });
  }

  /** The draft has done its job only once the page is left. */
  private leave(logoFailed: boolean): void {
    this.router
      .navigateByUrl(requestStepUrl('richiesta-inviata'), { state: { logoFailed } })
      .then(() => this.store.reset());
  }
}
