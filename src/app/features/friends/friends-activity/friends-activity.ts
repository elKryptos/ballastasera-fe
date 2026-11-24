import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedDto, FeedNewsDto, SocialRelation } from '../../../core/models/social.model';
import { EventEngagementService } from '../../../core/services/event-engagement.service';
import { FeedService } from '../../../core/services/feed.service';
import { nightShortLabel } from '../../../core/utils/event-filters';
import { timeAgo } from '../../../core/utils/time-ago';
import { FollowButton } from '../../../shared/follow-button/follow-button';
import { PersonRow } from '../../../shared/person-row/person-row';
import { TonightCard } from '../tonight-card/tonight-card';

/**
 * "Attività" in Amici (canvas 4d, social phase 5): "Stasera escono", the nights tonight of the people
 * the viewer follows, and "Novità" of the last 7 days: who started following them ("Ricambia") and
 * who's going where. Worked out by the backend at each visit, without the muted.
 */
@Component({
  selector: 'app-friends-activity',
  imports: [RouterLink, FollowButton, PersonRow, TonightCard],
  templateUrl: './friends-activity.html',
  styleUrl: './friends-activity.css',
})
export class FriendsActivity {
  private readonly feeds = inject(FeedService);
  private readonly engagement = inject(EventEngagementService);

  /** The page's clock, for "2 h" and "Domani". */
  readonly now = input.required<number>();

  protected readonly feed = signal<FeedDto | null>(null);
  protected readonly failed = signal(false);

  /** "Stasera escono · 4 amici": people, not nights (someone going to two counts once). */
  protected readonly outTonight = computed(() => {
    const people = new Set(this.feed()?.tonight.flatMap((night) => night.people.map((person) => person.userId)));
    return people.size === 1 ? '1 persona' : `${people.size} persone`;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.feeds.getFeed().subscribe({
      next: (feed) => {
        this.feed.set(feed);
        // The nights the viewer is going to, so their buttons start on.
        const going = [
          ...feed.tonight.filter((night) => night.meGoing).map((night) => night.eventId),
          ...feed.news.filter((news) => news.meGoing && news.eventId).map((news) => news.eventId!),
        ];
        this.engagement.markActive('going', going);
      },
      error: () => this.failed.set(true),
    });
  }

  protected newsText(news: FeedNewsDto): string {
    if (news.type === 'FOLLOWED_YOU') return `ha iniziato a seguirti · ${timeAgo(news.at, this.now())}`;
    const when = news.eventStartAt ? ` · ${nightShortLabel({ startAt: news.eventStartAt }, this.now())}` : '';
    const also = news.meGoing ? ' · ci vai anche tu' : '';
    return `va a ${news.eventTitle}${when}${also}`;
  }

  /** "Ricambia" tapped in the news: the row keeps the new relation, so it doesn't jump back. */
  protected relationChanged(news: FeedNewsDto, relation: SocialRelation): void {
    this.feed.update((feed) =>
      feed
        ? {
            ...feed,
            news: feed.news.map((item) =>
              item.user.userId === news.user.userId ? { ...item, user: { ...item.user, relation } } : item,
            ),
          }
        : feed,
    );
  }
}
