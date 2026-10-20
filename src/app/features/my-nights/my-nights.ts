import { Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { EventCardDto } from '../../core/models/event.model';
import { CityEventsService } from '../../core/services/city-events.service';
import { EventEngagementService } from '../../core/services/event-engagement.service';
import { MyNightsKind, UserActivityService } from '../../core/services/user-activity.service';
import { CursorList } from '../../core/utils/cursor-list';
import { DAY_MS, eventNight, nightHeading, nightOf } from '../../core/utils/event-filters';
import { InfiniteScrollDirective } from '../../shared/directives/infinite-scroll.directive';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { MyNightCard } from './my-night-card/my-night-card';

/** Keeps the LIVE badges current with the page left open. */
const CLOCK_TICK_MS = 30 * 1000;
/** How long Annulla stays on screen before the removal reaches the backend. */
const UNDO_MS = 5000;
/** ?tab=mi-piace opens Mi piace, no tab Parteciperò: the sidebar's two rows
 * under "La tua scena" link to one each (navbar.html). */
const LIKED_TAB = 'mi-piace';

/** One tab's two lists: what's coming, and what's over. */
interface TabLists {
  upcoming: CursorList<EventCardDto>;
  past: CursorList<EventCardDto>;
}

interface NightGroup {
  night: number;
  heading: string;
  events: EventCardDto[];
}

/** A night taken out of its list, waiting out its Annulla. */
interface PendingRemoval {
  event: EventCardDto;
  kind: MyNightsKind;
  list: CursorList<EventCardDto>;
  index: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * /le-tue-serate: the signed-in user's Parteciperò and Mi piace, as the two
 * tabs of the "Le tue serate" design. Each tab has its upcoming nights
 * (soonest first) and, folded under "Serate passate", the ones already over
 * (latest first) — four CursorLists, a page at a time as the list scrolls.
 *
 * Taking a night out is optimistic: the card goes at once, Annulla stays for
 * UNDO_MS, and only then does the DELETE go out, through
 * EventEngagementService so the night's heart/check stays right everywhere
 * else. If it fails, the card comes back to where it was.
 */
@Component({
  selector: 'app-my-nights',
  imports: [NgTemplateOutlet, RouterLink, SidebarPushDirective, InfiniteScrollDirective, MyNightCard],
  templateUrl: './my-nights.html',
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
})
export class MyNights {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly userActivity = inject(UserActivityService);
  private readonly engagement = inject(EventEngagementService);
  private readonly cityEvents = inject(CityEventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tab = signal<MyNightsKind>('going');
  protected readonly pastOpen = signal(false);
  protected readonly now = signal(Date.now());

  private readonly lists: Record<MyNightsKind, TabLists> = {
    going: { upcoming: this.createList('going', false), past: this.createList('going', true) },
    liked: { upcoming: this.createList('liked', false), past: this.createList('liked', true) },
  };
  protected readonly goingList = this.lists.going.upcoming;
  protected readonly likedList = this.lists.liked.upcoming;
  protected readonly upcoming = computed(() => this.lists[this.tab()].upcoming);
  protected readonly past = computed(() => this.lists[this.tab()].past);

  protected readonly upcomingGroups = computed(() => {
    const now = this.now();
    return groupByNight(this.upcoming().items(), (event) => eventNight(event, now), (night) => nightHeading(night, now));
  });
  protected readonly pastGroups = computed(() => {
    const now = this.now();
    return groupByNight(this.past().items(), (event) => nightOf(Date.parse(event.startAt)), (night) => pastHeading(night, now));
  });

  private readonly pending = signal<PendingRemoval | null>(null);
  /** The title of a night whose removal failed, for a moment. */
  protected readonly failedTitle = signal<string | null>(null);
  protected readonly undoText = computed(() => {
    const pending = this.pending();
    if (!pending) return null;
    return `«${pending.event.title}» tolta da ${pending.kind === 'going' ? 'Parteciperò' : 'Mi piace'}`;
  });
  private failedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Leaving the page within the Annulla: the removal still goes through.
    destroyRef.onDestroy(() => {
      this.commitPending();
      clearTimeout(this.failedTimer);
    });

    // The tab is the URL's: the sidebar's rows land on theirs, and a tap on
    // the other one while here switches to it.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const tab: MyNightsKind = params.get('tab') === LIKED_TAB ? 'liked' : 'going';
      if (tab === this.tab()) return;
      this.tab.set(tab);
      this.pastOpen.set(false);
    });

    if (!this.isBrowser) return;

    // Both tabs' upcoming at once: their totals are the tabs' badges.
    this.goingList.reload();
    this.likedList.reload();

    // The open tab's past nights, on the first visit to that tab: their total
    // says whether there's a "Serate passate" at all, and how many.
    effect(() => {
      const past = this.past();
      untracked(() => {
        if (!past.loaded() && !past.loading() && !past.error()) past.reload();
      });
    });

    interval(CLOCK_TICK_MS)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  /** Through the URL (see the queryParamMap above), so the sidebar marks the
   * right row. replaceUrl: Back leaves the page, it doesn't step through tabs.
   * No cross-fade: it's the same page (app.config.ts). */
  protected selectTab(tab: MyNightsKind): void {
    if (tab === this.tab()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'liked' ? LIKED_TAB : null },
      replaceUrl: true,
      info: { skipViewTransition: true },
    });
  }

  protected togglePast(): void {
    this.pastOpen.update((open) => !open);
  }

  /** The card goes now; the DELETE after UNDO_MS, unless Annulla. One at a
   * time: a second removal sends the first one's right away. */
  protected remove(list: CursorList<EventCardDto>, event: EventCardDto): void {
    this.commitPending();
    const index = list.removeLocal(event.id);
    if (index === null) return;
    const timer = setTimeout(() => this.commitPending(), UNDO_MS);
    this.pending.set({ event, kind: this.tab(), list, index, timer });
  }

  protected undo(): void {
    const pending = this.pending();
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.set(null);
    pending.list.restore(pending.event, pending.index);
  }

  private commitPending(): void {
    const pending = this.pending();
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.set(null);

    const { event, kind, list, index } = pending;
    const field = kind === 'going' ? 'goingCount' : 'likesCount';
    // The service flips the state at once (-1), and back (+1) if the request
    // fails: that +1 is the cue to put the card back.
    const onCountChange = (delta: 1 | -1) => {
      this.cityEvents.adjustCount(event.id, field, delta);
      if (delta === 1) {
        list.restore(event, index);
        this.showFailed(event.title);
      }
    };
    if (kind === 'going') this.engagement.toggleGoing(event.id, onCountChange);
    else this.engagement.toggleLike(event.id, onCountChange);
  }

  private showFailed(title: string): void {
    clearTimeout(this.failedTimer);
    this.failedTitle.set(title);
    this.failedTimer = setTimeout(() => this.failedTitle.set(null), UNDO_MS);
  }

  /** Each page's nights marked as going/liked as they come, so that taking one
   * out sends a DELETE, not an add (the toggles go by that state). */
  private createList(kind: MyNightsKind, past: boolean): CursorList<EventCardDto> {
    return new CursorList<EventCardDto>(
      (cursor) => this.userActivity.getMyNights(kind, past, cursor),
      (events) => this.engagement.markActive(kind, events.map((event) => event.id)),
    );
  }
}

/** Nights in the lists' own order (the backend's): each night once, its
 * events in the order they came. */
function groupByNight(
  events: readonly EventCardDto[],
  nightOfEvent: (event: EventCardDto) => number,
  heading: (night: number) => string,
): NightGroup[] {
  const groups: NightGroup[] = [];
  for (const event of events) {
    const night = nightOfEvent(event);
    const last = groups.at(-1);
    if (last?.night === night) last.events.push(event);
    else groups.push({ night, heading: heading(night), events: [event] });
  }
  return groups;
}

/** A past night's heading: "Sabato 10 ottobre", with the year once it isn't
 * this one ("Sabato 13 dicembre 2025"). No "Stasera": a night that's over
 * started earlier, even when that was tonight. */
function pastHeading(night: number, now: number): string {
  const date = new Date(night * DAY_MS);
  const sameYear = date.getUTCFullYear() === new Date(now).getFullYear();
  const text = date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
