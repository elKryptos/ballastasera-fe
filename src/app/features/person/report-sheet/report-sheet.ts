import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { concat, tap } from 'rxjs';
import { REPORT_NOTE_MAX, REPORT_REASON_LABELS, REPORT_REASONS } from '../../../core/config/social';
import { ReportReason } from '../../../core/models/social.model';
import { FollowsService } from '../../../core/services/follows.service';
import { apiErrorMessage } from '../../../core/utils/api-errors';
import { PendingAction } from '../../../core/utils/pending-action';
import { Sheet } from '../../../shared/sheet/sheet';

/** What was done, for the page: reported, and blocked too or not. */
export interface ReportResult {
  blocked: boolean;
}

/**
 * "Segnala" (social phase 4): why (a fixed reason; with "Altro", a note is needed), and optionally
 * blocking them at the same time ("Segnala e blocca": two calls, the report first). The report
 * goes to the admin's queue and hides nothing by itself; they never know who reported them.
 */
@Component({
  selector: 'app-report-sheet',
  imports: [Sheet],
  templateUrl: './report-sheet.html',
  styleUrl: './report-sheet.css',
})
export class ReportSheet {
  private readonly follows = inject(FollowsService);

  readonly open = model(false);
  readonly userId = input.required<string>();
  readonly firstName = input.required<string>();
  /** Already blocked: no "Blocca anche". */
  readonly blocked = input(false);
  readonly reported = output<ReportResult>();

  protected readonly reasons = REPORT_REASONS.map((value) => ({ value, label: REPORT_REASON_LABELS[value] }));
  protected readonly noteMax = REPORT_NOTE_MAX;
  protected readonly reason = signal<ReportReason | null>(null);
  protected readonly note = signal('');
  protected readonly alsoBlock = signal(false);
  protected readonly sending = new PendingAction();
  /** The report went through in this opening: what's left (a failed block) is all a retry sends, as
   * the backend keeps one open report per pair. */
  protected readonly reportSent = signal(false);

  protected readonly noteRequired = computed(() => this.reason() === 'OTHER');
  protected readonly canSend = computed(
    () => this.reason() !== null && (!this.noteRequired() || this.note().trim().length > 0) && !this.sending.busy(),
  );

  /** Each opening starts blank. Closed after the report went and the block didn't: the page hears
   * of the report (sent, not blocked). */
  protected reset(open: boolean): void {
    this.open.set(open);
    if (open) return;
    if (this.reportSent()) this.reported.emit({ blocked: false });
    this.reportSent.set(false);
    this.reason.set(null);
    this.note.set('');
    this.alsoBlock.set(false);
    this.sending.error.set(null);
  }

  protected send(): void {
    const reason = this.reason();
    if (!reason || !this.canSend()) return;
    const userId = this.userId();
    const block = this.alsoBlock() && !this.blocked();
    const steps = [];
    if (!this.reportSent()) {
      const report = this.follows.report(userId, { reason, note: this.note().trim() || null });
      steps.push(report.pipe(tap({ complete: () => this.reportSent.set(true) })));
    }
    if (block) steps.push(this.follows.block(userId));
    this.sending.run(concat(...steps), {
      complete: () => {
        this.reportSent.set(false);
        this.reported.emit({ blocked: block });
        this.reset(false);
      },
      errorMessage: (error) =>
        this.reportSent()
          ? `La segnalazione è arrivata, il blocco no. Riprova a bloccare ${this.firstName()}.`
          : apiErrorMessage(
              error,
              { 400: 'Scrivi due parole su cosa non va.', 404: 'Questo profilo non esiste più.' },
              'Non siamo riusciti a inviare la segnalazione. Riprova tra poco.',
            ),
    });
  }
}
