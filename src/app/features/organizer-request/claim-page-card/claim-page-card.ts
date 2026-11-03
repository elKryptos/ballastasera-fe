import { Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMapPin } from '@ng-icons/lucide';
import { OrganizerAvatar } from '../../../shared/organizer-avatar/organizer-avatar';
import { OrganizerRequestFormStore } from '../organizer-request-form.store';
import { OrganizerTypeBadge } from '../../../shared/organizer-type-badge/organizer-type-badge';

/** The page being claimed, read-only with its venue: what's edited later,
 * after the approval, not in the request. */
@Component({
  selector: 'app-claim-page-card',
  imports: [NgIcon, OrganizerAvatar, OrganizerTypeBadge],
  providers: [provideIcons({ lucideMapPin })],
  host: { class: 'flex flex-col gap-2.5 rounded-2xl border border-(--ev-zone-on-text)/40 bg-(--ev-zone-on-bg) p-3.5' },
  templateUrl: './claim-page-card.html',
})
export class ClaimPageCard {
  protected readonly store = inject(OrganizerRequestFormStore);
  protected readonly logoUrl = computed(
    () => this.store.claimDetails()?.detail.logoUrl ?? this.store.claimTarget()?.logoUrl ?? null,
  );
}
