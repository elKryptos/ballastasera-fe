import { PLATFORM_ID, Service, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { DAY_MS, nightOf } from '../utils/event-filters';
import { FeatureFlagService } from './feature-flag.service';

export type Season = 'halloween';

/** A calendar night as a day number, the way nightOf counts them (month 0 = January). */
function nightOn(year: number, month: number, day: number): number {
  return Math.round(Date.UTC(year, month, day) / DAY_MS);
}

/**
 * The season the navbar is dressed up for, if any — for now only Halloween,
 * from the night of 20 October to that of 2 November, every year: on by
 * itself and off by itself, no deploy either way. Applied as `data-season` on
 * <html> (the mobile drawer is an overlay outside app-navbar, as for
 * data-theme), which season-halloween.css styles off; the navbar adds its few
 * pieces (shared/season) while it's on. ?stagione=halloween turns it on any
 * day, to try it out; the seasonalThemes flag turns it off altogether.
 *
 * Read in the browser only, after the first render: the pages are
 * prerendered, so a season decided at build time would stay baked into them,
 * and one set before hydration would make the client disagree with that
 * markup (same pitfall as InstallPromptService).
 */
@Service()
export class SeasonService {
  private readonly featureFlags = inject(FeatureFlagService);

  private readonly current = signal<Season | null>(null);
  readonly season = this.current.asReadonly();

  /** Set together with the season, so only while it's Halloween. */
  private readonly tonight = signal<number | null>(null);

  /** This year's Halloween night (nightOf's numbering), while it's the season. */
  readonly halloweenNight = computed(() => {
    const tonight = this.tonight();
    return tonight === null ? null : nightOn(new Date(tonight * DAY_MS).getUTCFullYear(), 9, 31);
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
      const year = new Date(tonight * DAY_MS).getUTCFullYear();
      const inSeason = tonight >= nightOn(year, 9, 20) && tonight <= nightOn(year, 10, 2);
      const forced = new URLSearchParams(location.search).get('stagione') === 'halloween';
      if (!inSeason && !forced) return;

      this.tonight.set(tonight);
      this.current.set('halloween');
      document.documentElement.setAttribute('data-season', 'halloween');
    });
  }
}
