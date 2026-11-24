import { Component, computed, inject, input, signal } from '@angular/core';
import { SocialRelation, SuggestionDto } from '../../../core/models/social.model';
import { AuthService } from '../../../core/services/auth.service';
import { FeedService } from '../../../core/services/feed.service';
import { ToastService } from '../../../core/services/toast.service';
import { nightShortLabel } from '../../../core/utils/event-filters';
import { injectPageShare } from '../../../core/utils/page-share';
import { profileShareUrl } from '../../../core/utils/person-links';
import { FollowButton } from '../../../shared/follow-button/follow-button';
import { PersonRow } from '../../../shared/person-row/person-row';

/**
 * "Scopri" in Amici (canvas 4d, social phase 5): people the viewer may know, in the backend's order
 * (a night in common first, then whoever's looking for a partner, then friends in common), each with
 * why they're suggested and "Segui". Under them, the viewer's own profile link to send to someone who
 * dances with them and isn't here yet (just the link: no automatic follow).
 */
@Component({
  selector: 'app-friends-discover',
  imports: [FollowButton, PersonRow],
  templateUrl: './friends-discover.html',
  styleUrl: './friends-discover.css',
})
export class FriendsDiscover {
  private readonly feeds = inject(FeedService);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly pageShare = injectPageShare();

  /** The page's clock, for "Domani". */
  readonly now = input.required<number>();

  protected readonly suggestions = signal<SuggestionDto[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly myLink = computed(() => {
    const user = this.auth.currentUser();
    return user ? profileShareUrl(user.userId, user.username) : null;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.feeds.getSuggestions().subscribe({
      next: (suggestions) => this.suggestions.set(suggestions),
      error: () => this.failed.set(true),
    });
  }

  /** "Bachata Sunday · Domani · cerca con chi ballare · 3 amici in comune": what's known, in that order. */
  protected why(suggestion: SuggestionDto): string {
    const parts: string[] = [];
    if (suggestion.eventTitle && suggestion.eventStartAt) {
      parts.push(`${suggestion.eventTitle} · ${nightShortLabel({ startAt: suggestion.eventStartAt }, this.now())}`);
    }
    if (suggestion.lookingForPartner) parts.push('cerca con chi ballare');
    if (suggestion.mutualFriendsCount === 1) parts.push('1 amico in comune');
    else if (suggestion.mutualFriendsCount > 1) parts.push(`${suggestion.mutualFriendsCount} amici in comune`);
    return parts.join(' · ');
  }

  protected relationChanged(suggestion: SuggestionDto, relation: SocialRelation): void {
    this.suggestions.update((list) =>
      list?.map((item) => (item === suggestion ? { ...item, user: { ...item.user, relation } } : item)) ?? null,
    );
  }

  protected copyMyLink(): void {
    const link = this.myLink();
    if (!link) return;
    void this.pageShare
      .copy(link, 'link')
      .then((copied) => this.toasts.show(copied ? 'Link del tuo profilo copiato.' : 'Non siamo riusciti a copiare il link.'));
  }
}
