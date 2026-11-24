import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { INVITE_HIDDEN_NIGHTS_TEXT, INVITE_PHRASES, INVITE_PHRASE_LABELS } from '../../../core/config/social';
import { EventCardDto } from '../../../core/models/event.model';
import { InvitePhrase } from '../../../core/models/social.model';
import { AuthService } from '../../../core/services/auth.service';
import { InvitesService } from '../../../core/services/invites.service';
import { UserActivityService } from '../../../core/services/user-activity.service';
import { nightShortLabel } from '../../../core/utils/event-filters';
import { addressPrimary, formatClock } from '../../../core/utils/event-format';
import { inviteErrorMessage } from '../../../core/utils/invite-errors';
import { PendingAction } from '../../../core/utils/pending-action';
import { Choice, ChoiceGroup } from '../../../shared/choice-group/choice-group';
import { Sheet } from '../../../shared/sheet/sheet';

/**
 * "Invita a ballare" from a friend's profile (canvas 4c, social phase 6): which of the viewer's next
 * nights (those they said "Ci vado" to and not over), and a phrase. The friend gets it in the bell,
 * and says "Ci vado" from the night's page. The backend's refusals (they already go, the limit of the
 * day…) are said here, in the sheet.
 */
@Component({
  selector: 'app-invite-to-night-sheet',
  imports: [ReactiveFormsModule, ChoiceGroup, Sheet],
  templateUrl: './invite-to-night-sheet.html',
  styleUrl: './invite-to-night-sheet.css',
})
export class InviteToNightSheet {
  private readonly activity = inject(UserActivityService);
  private readonly invites = inject(InvitesService);
  private readonly auth = inject(AuthService);

  readonly open = model(false);
  readonly userId = input.required<string>();
  readonly firstName = input.required<string>();
  /** The page's clock: a night over can't be picked. */
  readonly now = input.required<number>();
  readonly invited = output<void>();

  protected readonly nights = signal<EventCardDto[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly picked = signal<string | null>(null);
  protected readonly phrase = new FormControl<InvitePhrase>('CI_VIENI', { nonNullable: true });
  protected readonly phrases: Choice<InvitePhrase>[] = INVITE_PHRASES.map((value) => ({
    value,
    label: INVITE_PHRASE_LABELS[value],
  }));
  protected readonly sending = new PendingAction();
  protected readonly hiddenNightsText = INVITE_HIDDEN_NIGHTS_TEXT;
  protected readonly nightsHidden = computed(() => this.auth.currentUser()?.attendanceVisibility === 'NOBODY');
  protected readonly upcoming = computed(() =>
    (this.nights() ?? []).filter((night) => Date.parse(night.endAt) > this.now()),
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => this.load());
    });
  }

  protected whenWhere(night: EventCardDto): string {
    const where = night.venueName ?? addressPrimary(night.address);
    return `${nightShortLabel(night, this.now())} · ${formatClock(night.startAt)} · ${where}`;
  }

  protected send(): void {
    const eventId = this.picked();
    if (!eventId) return;
    this.sending.run(this.invites.invite(this.userId(), { eventId, phrase: this.phrase.value }), {
      complete: () => {
        this.open.set(false);
        this.invited.emit();
      },
      errorMessage: inviteErrorMessage,
    });
  }

  private load(): void {
    this.nights.set(null);
    this.failed.set(false);
    this.picked.set(null);
    this.sending.error.set(null);
    this.activity.getMyNights('going', false).subscribe({
      next: (page) => {
        this.nights.set(page.items);
        this.picked.set(this.upcoming()[0]?.id ?? null);
      },
      error: () => this.failed.set(true),
    });
  }
}
