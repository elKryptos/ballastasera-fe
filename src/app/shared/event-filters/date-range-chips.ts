import { Component, ElementRef, afterRenderEffect, computed, inject, viewChild } from '@angular/core';
import { EventFiltersService } from '../../core/services/event-filters.service';
import { SeasonService } from '../../core/services/season.service';
import { DATE_RANGES } from '../../core/utils/event-filters';
import { HalloweenPumpkin } from '../season/halloween';

/** Stasera / Domani / Weekend / Settimana / Tutte le date: one picked at a
 * time, straight into EventFiltersService. A sideways-scrolling row on
 * phones, wrapping from md up; the host page sets its padding
 * (--ev-row-pad) so the chips scroll edge to edge. The seasonal ones
 * (Halloween, in pumpkin: season-halloween.css) only in their season — or
 * once a link has picked one, so the picked day always shows. */
@Component({
  selector: 'app-date-range-chips',
  imports: [HalloweenPumpkin],
  template: `
    <div
      #row
      class="ev-scroll-row relative flex gap-2 overflow-x-auto px-[var(--ev-row-pad,0px)] py-1 md:flex-wrap"
      role="group"
      aria-label="Quando">
      @for (option of options(); track option.value) {
        <button
          type="button"
          class="pointer-events-auto h-9 shrink-0 cursor-pointer rounded-full border border-(--ev-edge) bg-(--ev-surface) px-4 text-sm font-semibold whitespace-nowrap text-(--ev-text) shadow-(--ev-chip-shadow) transition-colors aria-pressed:border-rose aria-pressed:bg-rose aria-pressed:font-bold aria-pressed:text-(--ev-on-rose)"
          [class.season-chip]="option.value === 'halloween'"
          [attr.aria-pressed]="filters.range() === option.value"
          (click)="filters.range.set(option.value)">
          @if (option.value === 'halloween') {
            <app-halloween-pumpkin class="-ml-1 mr-1 size-4 align-[-0.1875rem]" />
          }
          {{ option.label }}
        </button>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class DateRangeChips {
  protected readonly filters = inject(EventFiltersService);
  private readonly season = inject(SeasonService);
  protected readonly options = computed(() => {
    const range = this.filters.range();
    const halloween = this.season.halloween();
    return DATE_RANGES.filter((option) => !option.seasonal || halloween || option.value === range);
  });

  private readonly row = viewChild.required<ElementRef<HTMLDivElement>>('row');

  constructor() {
    // The day can change from elsewhere ("Vedi tutta la settimana" in the
    // map's sheet, the list's empty state): bring the picked chip into view.
    // The row's own scroll only, never the page's — hence no scrollIntoView.
    afterRenderEffect(() => {
      this.filters.range();
      const row = this.row().nativeElement;
      const chip = row.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!chip) return;
      // offsetLeft is from the row itself: it's the chips' offsetParent (relative).
      const start = chip.offsetLeft;
      const end = start + chip.offsetWidth;
      if (start < row.scrollLeft || end > row.scrollLeft + row.clientWidth) {
        row.scrollTo({ left: Math.max(0, start - 16), behavior: 'smooth' });
      }
    });
  }
}
