import { Component, computed, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { CityDto } from '../../../core/models/city.model';
import { DanceStyleDto } from '../../../core/models/dance-style.model';

/** The map's filters: the floating panel (città + stile, or on desktop a
 * collapsed summary of the active ones) and the mobile "Filtri" button that
 * opens it. Presentational: MapPage owns the selection (it drives which
 * events get fetched and drawn), the open state (shared with the legend,
 * which closes it) and the viewport size, and reacts to the outputs below.
 * Only the desktop collapse state is the panel's own. */
@Component({
  selector: 'app-map-filters',
  imports: [NgIcon],
  templateUrl: './map-filters.html',
  styleUrl: './map-filters.css',
  providers: [provideIcons({ lucideX })],
})
export class MapFilters {
  readonly cities = input.required<CityDto[]>();
  readonly danceStyles = input.required<DanceStyleDto[]>();
  readonly selectedCityId = input.required<number | null>();
  /** Matched by display name against EventCardDto.danceStyles — see MapPage. */
  readonly selectedStyleNames = input.required<ReadonlySet<string>>();
  readonly loading = input(false);
  readonly error = input(false);
  /** Events left after the style filter, for the "N eventi in questa zona" line. */
  readonly eventCount = input(0);
  /** Mobile: the panel is showing (and the "Filtri" button hidden). Desktop
   * ignores it — the panel is always there, see the sm: overrides. */
  readonly open = input(false);
  /** Hides panel and button while the event card is docked over them on
   * mobile — see MapPage.hideFabsForCard. */
  readonly hideForCard = input(false);
  /** Tracks the sm: breakpoint — see MapPage.isDesktop. */
  readonly isDesktop = input(false);

  readonly citySelected = output<number | null>();
  readonly styleToggled = output<string>();
  /** The mobile "Filtri" button and the panel's own close button. */
  readonly openToggled = output<void>();

  /** Desktop-only: the panel can shrink down to just its active filters via
  the collapse arrow, freeing up map space without closing it outright.
  Starts collapsed so the map is unobstructed on load. Never toggled from
  mobile, which uses `open` instead — but combine it with isDesktop() before
  trusting it for anything visual, since mobile never resets it back to false. */
  protected readonly collapsed = signal(true);

  protected readonly summaryMode = computed(() => this.isDesktop() && this.collapsed());

  /** The panel's size/chrome depends on whether it's showing the full list or
  just the collapsed summary — returned as one string since it's several
  classes at once. Open looks the same on mobile and on the desktop-expanded
  state, on purpose. */
  protected readonly panelStateClass = computed(() =>
    this.summaryMode() ? 'w-auto p-2' : 'w-72 p-4 border shadow-(--map-shadow)',
  );

  /** Pinned near the top corner while the full filter list is showing, but
  centred on the single row of chips once collapsed to the summary. */
  protected readonly collapseButtonClass = computed(() =>
    this.summaryMode() ? 'top-1/2 -translate-y-1/2' : 'top-3',
  );

  protected readonly activeCityName = computed(() => {
    const id = this.selectedCityId();
    if (id === null) return null;
    return this.cities().find((city) => city.id === id)?.name ?? null;
  });

  protected readonly activeStyleNames = computed(() => Array.from(this.selectedStyleNames()));

  protected readonly hasActiveFilters = computed(
    () => this.selectedCityId() !== null || this.selectedStyleNames().size > 0,
  );

  protected toggleCollapsed(): void {
    this.collapsed.update((collapsed) => !collapsed);
  }
}
