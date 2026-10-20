import { PLATFORM_ID, Service, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { halloweenNightOf, nightOf, nightOn, yearOf } from '../utils/event-filters';
import { FeatureFlagService } from './feature-flag.service';

/** Halloween's season, first and last night included, every year:
 * [month, day], month 0 = January (9 is October). */
const SEASON_START: [number, number] = [9, 20];
const SEASON_END: [number, number] = [10, 2];

/**
 * The season the navbar is dressed up for, if any — for now only Halloween,
 * from SEASON_START to SEASON_END: on by itself and off by itself, no deploy
 * either way. Applied as `data-season` on <html> (the mobile drawer is an
 * overlay outside app-navbar, as for data-theme), which season-halloween.css
 * styles off; the navbar adds its few pieces (shared/season) while it's on,
 * and the lists of nights their Halloween chip (DateRangeChips).
 * ?stagione=halloween turns it on any day, to try it out; the seasonalThemes
 * flag turns it off altogether.
 *
 * Read in the browser only, after the first render: the pages are
 * prerendered, so a season decided at build time would stay baked into them,
 * and one set before hydration would make the client disagree with that
 * markup (same pitfall as InstallPromptService).
 */
@Service()
export class SeasonService {
  private readonly featureFlags = inject(FeatureFlagService);

  /** Tonight (nightOf's numbering), set only once it's found to be the season. */
  private readonly tonight = signal<number | null>(null);

  readonly halloween = computed(() => this.tonight() !== null);

  /** This year's Halloween night (nightOf's numbering), while it's the season. */
  readonly halloweenNight = computed(() => {
    const tonight = this.tonight();
    return tonight === null ? null : halloweenNightOf(tonight);
  });

  /** Nights to go to Halloween's: 0 on the night itself, null once it's past. */
  readonly nightsToHalloween = computed(() => {
    const tonight = this.tonight();
    const halloween = this.halloweenNight();
    if (tonight === null || halloween === null || tonight > halloween) return null;
    return halloween - tonight;
  });

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || !this.featureFlags.isEnabled(FEATURE_FLAGS.seasonalThemes)) return;

    afterNextRender(() => {
      const tonight = nightOf(Date.now());
      const year = yearOf(tonight);
      const inSeason = tonight >= nightOn(year, ...SEASON_START) && tonight <= nightOn(year, ...SEASON_END);
      const forced = new URLSearchParams(location.search).get('stagione') === 'halloween';
      if (!inSeason && !forced) return;

      this.tonight.set(tonight);
      document.documentElement.setAttribute('data-season', 'halloween');
    });
  }
}
