import { Component, computed, effect, inject, model, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { SocialRelation, UserSummaryDto } from '../../../core/models/social.model';
import { AuthService } from '../../../core/services/auth.service';
import { FeedService } from '../../../core/services/feed.service';
import { FollowsService, PeopleList } from '../../../core/services/follows.service';
import { CursorList } from '../../../core/utils/cursor-list';
import { BlockedPeople } from '../../../shared/blocked-people/blocked-people';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { FollowButton } from '../../../shared/follow-button/follow-button';
import { PersonRow } from '../../../shared/person-row/person-row';

/** How long typing has to pause before the friends are searched. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * "Amici" in Amici (canvas 4d): the friends (both follow each other), searchable by name, and with
 * the chips the followers and those followed, each person with their follow button. A friend out
 * tonight says where, in mint ("Stasera a Serata salsa", from the feed's tonight). Private people
 * are listed without a link, "Profilo privato" in place of the button unless the viewer follows them.
 */
@Component({
  selector: 'app-friends-lists',
  imports: [InfiniteScrollDirective, FollowButton, PersonRow, BlockedPeople],
  templateUrl: './friends-lists.html',
  styleUrl: './friends-lists.css',
})
export class FriendsLists {
  private readonly follows = inject(FollowsService);
  private readonly feeds = inject(FeedService);
  private readonly auth = inject(AuthService);

  /** The chip picked: the page keeps it in the URL (?lista=). */
  readonly list = model<PeopleList>('friends');

  protected readonly typed = signal('');
  private readonly query = signal('');
  /** Where each person followed is tonight: userId → the night's title. */
  private readonly tonight = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly people = new CursorList<UserSummaryDto>(
    (cursor) => this.follows.list(this.list(), cursor, this.query()),
    undefined,
    (person) => person.userId,
  );

  /** The chips' numbers: followers and following from the session (asked again when Amici opens), friends
   * from their list once it's loaded without a search. */
  private readonly friendsTotal = signal<number | null>(null);
  protected readonly chips = computed(() => {
    const user = this.auth.currentUser();
    return [
      { list: 'friends' as const, label: 'Amici', count: this.friendsTotal() },
      { list: 'followers' as const, label: 'Seguaci', count: user?.followersCount ?? null },
      { list: 'following' as const, label: 'Seguiti', count: user?.followingCount ?? null },
    ];
  });
  protected readonly searchPlaceholder = computed(() => {
    const total = this.friendsTotal();
    return total ? `Cerca tra i tuoi ${total} amici` : 'Cerca tra i tuoi amici';
  });

  constructor() {
    // A new chip or a new search: the list from its first page.
    effect(() => {
      this.list();
      this.query();
      untracked(() => this.people.reload());
    });
    effect(() => {
      if (this.list() === 'friends' && !this.query() && this.people.loaded()) {
        const total = this.people.total();
        untracked(() => this.friendsTotal.set(total));
      }
    });
    toObservable(this.typed)
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => this.query.set(query.trim()));

    this.feeds.getFeed().subscribe({
      next: (feed) => {
        const where = new Map<string, string>();
        for (const night of feed.tonight) {
          for (const person of night.people) if (!where.has(person.userId)) where.set(person.userId, night.eventTitle);
        }
        this.tonight.set(where);
      },
      // Without it the rows just don't say where people are tonight.
      error: () => undefined,
    });
  }

  protected pick(list: PeopleList): void {
    this.list.set(list);
    this.typed.set('');
    this.query.set('');
  }

  protected tonightOf(person: UserSummaryDto): string | null {
    const night = this.tonight().get(person.userId);
    return night ? `Stasera a ${night}` : null;
  }

  protected relationChanged(person: UserSummaryDto, relation: SocialRelation): void {
    this.people.updateLocal(person.userId, (item) => ({ ...item, relation }));
  }

  protected emptyText(): string {
    if (this.query()) return 'Nessun amico con questo nome.';
    switch (this.list()) {
      case 'friends':
        return 'Ancora nessun amico. Si diventa amici seguendosi a vicenda: comincia da chi va alle tue serate.';
      case 'followers':
        return 'Ancora nessuno ti segue.';
      case 'following':
        return 'Non segui ancora nessuno.';
    }
  }
}
