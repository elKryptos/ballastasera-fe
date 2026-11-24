import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { ReportStatus } from '../../../core/models/moderation.model';
import { ModerationService } from '../../../core/services/moderation.service';
import { SpringPageList } from '../../../core/utils/spring-page-list';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { PageNav } from '../../../shared/page-nav/page-nav';
import { ReportCard } from './report-card/report-card';

const TABS: { status: ReportStatus; label: string }[] = [
  { status: 'OPEN', label: 'Da rivedere' },
  { status: 'DISMISSED', label: 'Ignorate' },
  { status: 'BANNED', label: 'Bannate' },
];

/**
 * "Segnalazioni" (social phase 4): the reported profiles, by status, like the organizer requests'
 * queue. Each card decides its own report; this page lists them and reloads after a decision.
 * Nothing is hidden by a report alone: only a ban hides someone.
 */
@Component({
  selector: 'app-reports',
  imports: [RouterLink, NgIcon, SidebarPushDirective, PageNav, ReportCard],
  providers: [provideIcons({ lucideChevronLeft })],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './reports.html',
})
export class Reports {
  private readonly moderation = inject(ModerationService);

  protected readonly tabs = TABS;
  protected readonly status = signal<ReportStatus>('OPEN');
  protected readonly notice = signal<string | null>(null);
  protected readonly reports = new SpringPageList((page) => this.moderation.reports(this.status(), page));
  /** "Da rivedere · N": kept while another tab is open. */
  protected readonly openCount = signal<number | null>(null);

  constructor() {
    this.reports.reset();
    // The open tab's total, each time it answers.
    effect(() => {
      const total = this.reports.total();
      if (this.status() === 'OPEN' && total !== null) untracked(() => this.openCount.set(total));
    });
  }

  protected selectTab(status: ReportStatus): void {
    if (status === this.status()) return;
    this.status.set(status);
    this.notice.set(null);
    this.reports.reset();
  }

  protected onReviewed(message: string): void {
    this.notice.set(message);
    this.reports.reload();
  }

  protected onAlreadyReviewed(): void {
    this.notice.set('Già revisionata da un altro admin: la lista è stata aggiornata.');
    this.reports.reload();
  }
}
