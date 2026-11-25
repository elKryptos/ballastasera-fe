import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import { INVITE_PHRASE_LABELS } from '../../core/config/social';
import { NotificationDto, SocialRelation } from '../../core/models/social.model';
import { NotificationsService } from '../../core/services/notifications.service';
import { CursorList } from '../../core/utils/cursor-list';
import { nightShortLabel } from '../../core/utils/event-filters';
import { timeAgo } from '../../core/utils/time-ago';
import { InfiniteScrollDirective } from '../../shared/directives/infinite-scroll.directive';
import { EmailNotificationsToggle } from '../../shared/email-notifications-toggle/email-notifications-toggle';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { FollowButton } from '../../shared/follow-button/follow-button';
import { PersonRow } from '../../shared/person-row/person-row';

/**
 * The bell (social phase 6, docs/social-fe.md S9): who started following the viewer ("Ricambia"),
 * who became their friend, who invited them to a night ("Vedi": the night's page, where they say
 * "Ci vado"; there's no answer to an invite). Opening it marks everything read at once, once the
 * first page is on screen: what was new this time still shows as new. Notices last 60 days. Beside
 * the list, "Ricevi email".
 */
@Component({
  selector: 'app-notifications',
  imports: [RouterLink, InfiniteScrollDirective, SidebarPushDirective, EmailNotificationsToggle, FollowButton, PersonRow],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
})
export class Notifications {
  private readonly notifications = inject(NotificationsService);

  protected readonly list = new CursorList<NotificationDto>((cursor) => this.notifications.list(cursor));
  /** The page's clock, for "2 h". */
  protected readonly now = signal(Date.now());

  constructor() {
    const clock = isPlatformBrowser(inject(PLATFORM_ID)) ? setInterval(() => this.now.set(Date.now()), 60_000) : undefined;
    inject(DestroyRef).onDestroy(() => clearInterval(clock));

    this.list.reload();
    let marked = false;
    effect(() => {
      if (marked || !this.list.loaded()) return;
      marked = true;
      untracked(() => this.notifications.markAllRead().pipe(catchError(() => EMPTY)).subscribe());
    });
  }

  protected text(notice: NotificationDto): string {
    const ago = timeAgo(notice.createdAt, this.now());
    switch (notice.type) {
      case 'NEW_FOLLOWER':
        return `ha iniziato a seguirti · ${ago}`;
      case 'NEW_FRIEND':
        return `ora siete amici · ${ago}`;
      case 'INVITE': {
        const when = notice.eventStartAt ? ` · ${nightShortLabel({ startAt: notice.eventStartAt }, this.now())}` : '';
        const phrase = notice.phrase ? `«${INVITE_PHRASE_LABELS[notice.phrase]}» ` : '';
        return `${phrase}ti invita a ${notice.eventTitle}${when}`;
      }
    }
  }

  protected relationChanged(notice: NotificationDto, relation: SocialRelation): void {
    // The same person may have more than one notice: all of them follow.
    for (const item of this.list.items()) {
      if (item.actor.userId === notice.actor.userId) {
        this.list.updateLocal(item.id, (current) => ({ ...current, actor: { ...current.actor, relation } }));
      }
    }
  }
}
