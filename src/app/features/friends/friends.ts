import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PeopleList } from '../../core/services/follows.service';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { FriendsActivity } from './friends-activity/friends-activity';
import { FriendsDiscover } from './friends-discover/friends-discover';
import { FriendsLists } from './friends-lists/friends-lists';
import { TablistDirective } from '../../shared/directives/tablist.directive';

type FriendsTab = 'attivita' | 'amici' | 'scopri';

const TABS: { tab: FriendsTab; label: string }[] = [
  { tab: 'attivita', label: 'Attività' },
  { tab: 'amici', label: 'Amici' },
  { tab: 'scopri', label: 'Scopri' },
];

/** ?lista= in the URL, in Italian, and the list it means. */
const LISTS: Record<string, PeopleList> = { amici: 'friends', seguaci: 'followers', seguiti: 'following' };
const LIST_SLUGS: Record<PeopleList, string> = { friends: 'amici', followers: 'seguaci', following: 'seguiti' };

/**
 * "Amici" (canvas 4d, docs/social-fe.md): Attività (who goes out tonight and what's new), Amici (the
 * friends, followers and following) and Scopri (people to follow). The tab and the list are the URL's
 * (?tab=, ?lista=): the profile's numbers lead straight to a list, and Back leaves the page rather
 * than stepping through tabs. Each tab loads when it's opened. The followers' and following's numbers
 * come from the session, asked again on the way in.
 */
@Component({
  selector: 'app-friends',
  imports: [SidebarPushDirective, FriendsActivity, FriendsDiscover, FriendsLists, TablistDirective],
  templateUrl: './friends.html',
  styleUrl: './friends.css',
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
})
export class Friends {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly tab = computed<FriendsTab>(() => {
    const tab = this.params().get('tab');
    return TABS.some((item) => item.tab === tab) ? (tab as FriendsTab) : 'attivita';
  });
  protected readonly list = computed<PeopleList>(() => LISTS[this.params().get('lista') ?? ''] ?? 'friends');

  /** The page's clock, for "2 h" and "Domani". */
  protected readonly now = signal(Date.now());

  constructor() {
    inject(AuthService).restoreSession().subscribe();
    const clock = isPlatformBrowser(inject(PLATFORM_ID)) ? setInterval(() => this.now.set(Date.now()), 60_000) : undefined;
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  protected selectTab(tab: FriendsTab): void {
    this.navigate({ tab: tab === 'attivita' ? null : tab, lista: null });
  }

  protected selectList(list: PeopleList): void {
    this.navigate({ tab: 'amici', lista: list === 'friends' ? null : LIST_SLUGS[list] });
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
      info: { skipViewTransition: true },
    });
  }
}
