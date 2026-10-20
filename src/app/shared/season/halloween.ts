import { Component, computed, inject } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { SeasonService } from '../../core/services/season.service';
import { DAY_MS } from '../../core/utils/event-filters';
import { RailTooltip } from '../directives/rail-tooltip.directive';

/* The navbar's Halloween pieces, added by navbar.html only while SeasonService
says it's Halloween. Styles: season-halloween.css, global like the rest of
the menu's (the mobile drawer is an overlay outside app-navbar). */

const WEEKDAY = new Intl.DateTimeFormat('it-IT', { weekday: 'long', timeZone: 'UTC' });

/** Bats crossing the mobile top bar, behind its logo and buttons. */
@Component({
  selector: 'app-halloween-bats',
  template: `
    @for (bat of bats; track $index) {
      <span class="season-bat-path absolute" [style.top]="bat.top" [style.left]="bat.left"
        [style.animation-delay]="bat.delay">
        <svg viewBox="0 0 32 16" class="season-bat" [style.width.px]="bat.width">
          <path fill="currentColor"
            d="M16 5L15 3L14.4 5.2C12 4.6 10 5.6 9 7.4C7 5 3.5 3.6 0 4C2.6 5.6 3.6 8 3.4 10.4C5 9.4 6.8 9.6 7.8 11C9 9.8 11 10 12 11.6C13 10.6 14.4 11 16 13C17.6 11 19 10.6 20 11.6C21 10 23 9.8 24.2 11C25.2 9.6 27 9.4 28.6 10.4C28.4 8 29.4 5.6 32 4C28.5 3.6 25 5 23 7.4C22 5.6 20 4.6 17.6 5.2L17 3Z" />
        </svg>
      </span>
    }
  `,
  host: { class: 'pointer-events-none absolute inset-0 overflow-hidden', 'aria-hidden': 'true' },
})
export class HalloweenBats {
  protected readonly bats = [
    { top: '0.5rem', left: '16%', width: 20, delay: '0s' },
    { top: '1.5rem', left: '69%', width: 14, delay: '-3.1s' },
  ];
}

/** A cobweb in the top corner of the drawer and the rail, under the menu. */
@Component({
  selector: 'app-halloween-web',
  template: `
    <svg viewBox="0 0 120 120" class="size-full" fill="none" stroke="currentColor" stroke-width="1">
      <path d="M120 0L0 4M120 0L16 58M120 0L50 104M120 0L96 120" />
      <path d="M90 1Q96 8 94 14.5Q99 20 102.5 26Q108 27 114 30" />
      <path d="M60 2Q70 16 68 29Q78 40 85 52Q96 54 108 60" />
      <path d="M26 3Q40 24 39.5 45Q54 62 65.6 81Q82 86 99 93.6" />
    </svg>
  `,
  host: {
    class: 'pointer-events-none absolute top-0 right-0 aspect-square w-[min(7.5rem,100%)] text-(--color-line)',
    'aria-hidden': 'true',
  },
})
export class HalloweenWeb {}

/** A spider dropping over the strip of page beside the open drawer, hung
 * from the drawer's own top edge (mobile only). */
@Component({
  selector: 'app-halloween-spider',
  template: `
    <svg viewBox="0 0 24 150" class="size-full">
      <path d="M12 0V128" stroke="rgba(253,242,236,.45)" stroke-width="1" />
      <path d="M8 133l-6-5-1-6M8 136l-7 0-1 5M9 139l-5 5v5M16 133l6-5 1-6M16 136l7 0 1 5M15 139l5 5v5"
        stroke="#c4b5fd" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <circle cx="12" cy="129" r="3.5" fill="#1a0e2e" stroke="#c4b5fd" stroke-width="1.2" />
      <ellipse cx="12" cy="138" rx="5" ry="6" fill="#1a0e2e" stroke="#c4b5fd" stroke-width="1.2" />
      <circle cx="10.8" cy="128.6" r=".9" fill="#ff7a1a" />
      <circle cx="13.2" cy="128.6" r=".9" fill="#ff7a1a" />
    </svg>
  `,
  host: { 'aria-hidden': 'true' },
})
export class HalloweenSpider {}

/** "Serate di Halloween": a countdown to the night, then "Stasera!" on it,
 * leading to the list of nights — tonight's or tomorrow's when it's that
 * close, otherwise all of them (the next three weeks hold the 31st). Up to
 * the night itself, and only while the list is on. */
@Component({
  selector: 'app-halloween-card',
  imports: [RouterLink, RailTooltip],
  template: `
    @if (nights() !== null && listEnabled) {
      <a class="drawer-card season-card" routerLink="/lista" [queryParams]="query()"
        appRailTooltip="Serate di Halloween">
        <span class="drawer-avatar season-card-icon">
          <svg viewBox="0 0 24 24" class="size-5.5" fill="none" stroke="currentColor" stroke-width="1.9"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 7c-4.5 0-8 2.9-8 6.5S7.5 20 12 20s8-2.9 8-6.5S16.5 7 12 7z" />
            <path d="M12 7c-2 1.5-2.5 4-2.5 6.5S10 18.5 12 20M12 7c2 1.5 2.5 4 2.5 6.5S14 18.5 12 20" />
            <path d="M12 7V4.5c0-.8.6-1.5 1.5-1.5" />
          </svg>
        </span>
        <span class="min-w-0 grow">
          <span class="block text-[0.9375rem] font-extrabold">Serate di Halloween</span>
          <span class="season-card-sub block truncate text-xs text-(--drawer-soft)">
            {{ date() }} · <span class="season-card-when">{{ when() }}</span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" class="size-4.5 shrink-0 text-(--drawer-soft)" fill="none" stroke="currentColor"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </a>
    }
  `,
  host: { class: 'contents' },
})
export class HalloweenCard {
  private readonly season = inject(SeasonService);

  protected readonly listEnabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.eventListPage);
  protected readonly nights = this.season.nightsToHalloween;

  /** "Sabato 31 ottobre" — whatever weekday it falls on that year. */
  protected readonly date = computed(() => {
    const night = this.season.halloweenNight();
    if (night === null) return '';
    const weekday = WEEKDAY.format(new Date(night * DAY_MS));
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} 31 ottobre`;
  });

  protected readonly when = computed(() => {
    const nights = this.nights();
    if (nights === 0) return 'Stasera!';
    if (nights === 1) return 'domani';
    return `tra ${nights} giorni`;
  });

  protected readonly query = computed<Params | null>(() => {
    const nights = this.nights();
    if (nights === 0) return { quando: 'stasera' };
    if (nights === 1) return { quando: 'domani' };
    return null;
  });
}
