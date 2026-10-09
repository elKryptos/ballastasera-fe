import { Component, input, output } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

/** "Mappa | Lista": the same search seen two ways. Plain links — the filters
 * live in EventFiltersService, so they come along on their own. The schools
 * list uses it too, with its own Lista (listPath) and a word to the map before
 * going there (mapClicked). Lista can carry query params (listQueryParams):
 * the places list with every type (ALL_PLACES_QUERY), from the map's "Locali
 * e scuole" and from that list itself. */
@Component({
  selector: 'app-view-switch',
  imports: [RouterLink],
  template: `
    <nav
      aria-label="Vista"
      class="flex rounded-full border border-(--ev-edge) bg-(--ev-surface) p-1 shadow-(--ev-chip-shadow)">
      <a
        routerLink="/mappa"
        (click)="mapClicked.emit()"
        class="flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-(--ev-soft) transition-colors aria-[current=page]:bg-(--ev-text) aria-[current=page]:font-bold aria-[current=page]:text-(--ev-surface)"
        [attr.aria-current]="active() === 'map' ? 'page' : null">
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linejoin="round" aria-hidden="true">
          <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
        Mappa
      </a>
      <a
        [routerLink]="listPath()"
        [queryParams]="listQueryParams()"
        class="flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-(--ev-soft) transition-colors aria-[current=page]:bg-(--ev-text) aria-[current=page]:font-bold aria-[current=page]:text-(--ev-surface)"
        [attr.aria-current]="active() === 'list' ? 'page' : null">
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </svg>
        Lista
      </a>
    </nav>
  `,
  host: { class: 'flex' },
})
export class ViewSwitch {
  readonly active = input.required<'map' | 'list'>();
  readonly listPath = input('/lista');
  readonly listQueryParams = input<Params | null>(null);
  /** Mappa tapped, as the router takes over: the moment to tell the map what
   * to show (MapViewStateService) before it's on screen. */
  readonly mapClicked = output<void>();
}
