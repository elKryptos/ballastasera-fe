import { Component, computed, inject, input, output, signal } from '@angular/core';
import { REPORT_REASON_LABELS } from '../../../../core/config/social';
import { UserReportAdminDto } from '../../../../core/models/moderation.model';
import { ModerationService } from '../../../../core/services/moderation.service';
import { apiErrorCode, apiErrorMessage } from '../../../../core/utils/api-errors';
import { ConfirmSheet } from '../../../../shared/confirm-sheet/confirm-sheet';
import { PersonAvatar } from '../../../../shared/person-avatar/person-avatar';

/** "24 nov, 21:30". */
function shortDateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * One report in the admin's queue (social phase 4): who was reported (with how many reports against
 * them are open), why, the note, who reported and when; open, "Ignora" closes this one and "Banna"
 * (asked first) bans the person and closes all their open reports. Reviewed, who did it and when.
 * Someone else reviewing it at the same time is said, and the queue reloads (alreadyReviewed).
 */
@Component({
  selector: 'app-report-card',
  imports: [ConfirmSheet, PersonAvatar],
  templateUrl: './report-card.html',
  styleUrl: './report-card.css',
})
export class ReportCard {
  private readonly moderation = inject(ModerationService);

  readonly report = input.required<UserReportAdminDto>();
  /** Done: what to tell the admin. */
  readonly reviewed = output<string>();
  readonly alreadyReviewed = output<void>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmBan = signal(false);

  protected readonly reason = computed(() => REPORT_REASON_LABELS[this.report().reason]);
  protected readonly createdAt = computed(() => shortDateTime(this.report().createdAt));
  protected readonly reviewedAt = computed(() => {
    const at = this.report().reviewedAt;
    return at ? shortDateTime(at) : null;
  });
  protected readonly banText = computed(() => {
    const report = this.report();
    const others = report.openReportsAgainst - 1;
    const closes = others > 0 ? ` Si chiudono anche le altre ${others} segnalazioni aperte su questo profilo.` : '';
    return `${report.reportedName} non potrà più entrare e sparirà da profili, liste e «Chi ci va». I follow restano, se poi lo sbanni.${closes}`;
  });

  protected dismiss(): void {
    this.review('DISMISSED', 'Segnalazione ignorata.');
  }

  protected ban(): void {
    this.review('BANNED', `Account di ${this.report().reportedName} bannato.`);
  }

  private review(status: 'DISMISSED' | 'BANNED', done: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.moderation.review(this.report().id, status).subscribe({
      next: () => {
        this.busy.set(false);
        this.confirmBan.set(false);
        this.reviewed.emit(done);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const code = apiErrorCode(error);
        if (code === 'REPORT_NOT_OPEN' || code === 'CONCURRENT_UPDATE') {
          this.confirmBan.set(false);
          this.alreadyReviewed.emit();
          return;
        }
        this.error.set(
          apiErrorMessage(
            error,
            { CANNOT_BAN_ADMIN: 'Un admin non si può bannare.' },
            'Non siamo riusciti a salvarlo. Riprova tra poco.',
          ),
        );
      },
    });
  }
}
