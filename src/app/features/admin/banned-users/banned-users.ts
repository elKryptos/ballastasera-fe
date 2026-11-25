import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { BannedUserAdminDto } from '../../../core/models/moderation.model';
import { ModerationService } from '../../../core/services/moderation.service';
import { SpringPageList } from '../../../core/utils/spring-page-list';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { PageNav } from '../../../shared/page-nav/page-nav';
import { PersonRow } from '../../../shared/person-row/person-row';

/**
 * "Utenti bannati" (social phase 4): the last banned first, each with its email, when, and
 * "Sbanna". Unbanning brings everything back as it was (the follows were kept) and reopens no report.
 */
@Component({
  selector: 'app-banned-users',
  imports: [RouterLink, NgIcon, SidebarPushDirective, PageNav, PersonRow],
  providers: [provideIcons({ lucideChevronLeft })],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './banned-users.html',
  styleUrl: './banned-users.css',
})
export class BannedUsers {
  private readonly moderation = inject(ModerationService);

  protected readonly banned = new SpringPageList((page) => this.moderation.banned(page));
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Whose "Sbanna" is on its way. */
  protected readonly unbanning = signal<string | null>(null);

  constructor() {
    this.banned.reset();
  }

  protected subtitle(user: BannedUserAdminDto): string {
    if (!user.bannedAt) return user.email;
    const when = new Date(user.bannedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${user.email} · in ban dal ${when}`;
  }

  protected unban(user: BannedUserAdminDto): void {
    if (this.unbanning()) return;
    this.unbanning.set(user.userId);
    this.error.set(null);
    this.moderation.unban(user.userId).subscribe({
      complete: () => {
        this.unbanning.set(null);
        this.notice.set(`${user.displayName} può di nuovo entrare.`);
        this.banned.reload();
      },
      error: () => {
        this.unbanning.set(null);
        this.error.set('Non siamo riusciti a sbannare. Riprova tra poco.');
      },
    });
  }
}
