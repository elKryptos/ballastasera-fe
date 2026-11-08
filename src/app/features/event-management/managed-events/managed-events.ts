import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CityDto } from '../../../core/models/city.model';
import { EventCardDto, EventManagementTab } from '../../../core/models/event.model';
import { OrganizerAdminDto } from '../../../core/models/organizer.model';
import { CitiesService } from '../../../core/services/cities.service';
import { EventManagementService, ManagedEventsFilters } from '../../../core/services/event-management.service';
import { OrganizersService } from '../../../core/services/organizers.service';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { EVENT_MANAGEMENT_CONTEXT } from '../event-management.context';
import { EventSearch } from './event-search/event-search';
import { ManagedEventCard } from './managed-event-card/managed-event-card';
import { ManagementTabs } from './management-tabs/management-tabs';
import { OrganizerFilter } from './organizer-filter/organizer-filter';

const PAGE_SIZE = 20;
const TABS: EventManagementTab[] = ['UPCOMING', 'CANCELLED', 'PAST'];

/** What an empty tab says. */
const EMPTY_TAB: Record<EventManagementTab, string> = {
  UPCOMING: 'Nessuna serata in programma.',
  CANCELLED: 'Nessuna serata annullata. Se una salta, annullala dalla sua pagina: chi aveva detto «ci vado» lo vede subito.',
  PAST: 'Nessuna serata passata.',
};

/**
 * The nights' list, as on the canvas: "Serate" for the admin (AdminSerate: every night, a search,
 * the organizer filter and "Nuova serata" at the bottom) and "Serate pubblicate" for the organizer
 * (SeratePubblicate: their own, "Pubblica una serata" on top). Three tabs with their counts, and
 * "Carica altre" for the next page. Each card opens the night's page.
 */
@Component({
  selector: 'app-managed-events',
  imports: [RouterLink, SidebarPushDirective, EventSearch, OrganizerFilter, ManagedEventCard, ManagementTabs],
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
  templateUrl: './managed-events.html',
})
export class ManagedEvents {
  protected readonly context = inject(EVENT_MANAGEMENT_CONTEXT);
  private readonly service = inject(EventManagementService);
  private readonly organizers = inject(OrganizersService);

  protected readonly isAdmin = this.context.scope === 'admin';
  /** The organizer's page, named over the heading. */
  protected readonly organizer = this.organizers.myOrganizer;
  protected readonly tab = signal<EventManagementTab>('UPCOMING');
  protected readonly events = signal<EventCardDto[]>([]);
  protected readonly counts = signal<Partial<Record<EventManagementTab, number>>>({});
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly emptyText = EMPTY_TAB;
  /** When the list was loaded: tells the nights that are over. */
  protected readonly now = Date.now();

  private readonly search = signal<string | null>(null);
  private readonly filterOrganizer = signal<OrganizerAdminDto | null>(null);
  private readonly cities = toSignal(inject(CitiesService).getCities().pipe(catchError(() => of<CityDto[]>([]))), {
    initialValue: [] as CityDto[],
  });
  /** "Milano · tutte" next to the admin's heading: the city, and whose nights. */
  protected readonly scopeLabel = computed(() => {
    const cities = this.cities();
    const city = cities.length === 1 ? `${cities[0].name} · ` : '';
    return `${city}${this.filterOrganizer()?.name ?? 'tutte'}`;
  });

  private readonly page = signal(0);
  /** switchMap: only the latest asked for shows, however fast the tabs and the filters change. */
  private readonly reload$ = new Subject<void>();
  private readonly recount$ = new Subject<void>();

  constructor() {
    this.reload$
      .pipe(
        switchMap(() =>
          this.service
            .list(this.context.scope, this.tab(), this.page(), PAGE_SIZE, this.filters())
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.loading.set(false);
        this.loadFailed.set(result === null);
        if (!result) return;
        this.events.update((shown) => (result.page.number === 0 ? result.content : [...shown, ...result.content]));
        this.hasMore.set(result.page.number + 1 < result.page.totalPages);
      });

    // One night per tab is enough to know how many it holds.
    this.recount$
      .pipe(
        switchMap(() =>
          forkJoin(
            TABS.map((tab) =>
              this.service.list(this.context.scope, tab, 0, 1, this.filters()).pipe(
                map((result) => result.page.totalElements),
                catchError(() => of(undefined)),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((totals) => this.counts.set(Object.fromEntries(TABS.map((tab, i) => [tab, totals[i]]))));

    if (!this.isAdmin) this.organizers.ensureMine().pipe(catchError(() => of(null))).subscribe();
    this.load();
    this.recount$.next();
  }

  protected selectTab(tab: EventManagementTab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.load();
  }

  protected onSearch(search: string): void {
    this.search.set(search || null);
    this.refilter();
  }

  protected onOrganizer(organizer: OrganizerAdminDto | null): void {
    this.filterOrganizer.set(organizer);
    this.refilter();
  }

  protected loadMore(): void {
    this.page.update((page) => page + 1);
    this.loading.set(true);
    this.reload$.next();
  }

  private filters(): ManagedEventsFilters {
    return { search: this.search(), organizerId: this.filterOrganizer()?.id ?? null };
  }

  private refilter(): void {
    this.load();
    this.recount$.next();
  }

  /** From the first page, emptied meanwhile so another tab's nights don't linger. */
  private load(): void {
    this.page.set(0);
    this.events.set([]);
    this.hasMore.set(false);
    this.loading.set(true);
    this.reload$.next();
  }
}
