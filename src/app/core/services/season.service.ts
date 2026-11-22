import { PLATFORM_ID, Service, afterNextRender, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { halloweenNightOf, nightOf, nightOn, yearOf } from '../utils/event-filters';
import { FeatureFlagService } from './feature-flag.service';

/** The looks the navbar can be dressed up in. */
type Season = 'halloween' | 'vice';

/** When each season is on, first and last night included: [month, day],
 * month 0 = January (9 is October). Every year, unless it names its own.
 * Vice City is GTA VI's launch (19 November 2026), that year only. */
const SEASONS: readonly { season: Season; start: [number, number]; end: [number, number]; year?: number }[] = [
  { season: 'halloween', start: [9, 20], end: [10, 2] },
  { season: 'vice', start: [10, 19], end: [10, 30], year: 2026 },
];

function isSeason(value: string | null): value is Season {
  return SEASONS.some(({ season }) => season === value);
}

/**
 * The season the navbar is dressed up for, if any — Halloween, or Vice City
 * for GTA VI's launch — each between its dates in SEASONS: on by itself and
 * off by itself, no deploy either way. Applied as `data-season` on <html>
 * (the mobile drawer is an overlay outside app-navbar, as for data-theme),
 * which season-halloween.css and season-vice.css style off; the navbar adds
 * its few pieces (shared/season, the logo's own) while one is on, and the
 * lists of nights their Halloween chip (DateRangeChips).
 * ?stagione=halloween or ?stagione=vice turns one on any day, to try it out;
 * the seasonalThemes flag turns them off altogether.
 *
 * Read in the browser only, after the first render: the pages are
 * prerendered, so a season decided at build time would stay baked into them,
 * and one set before hydration would make the client disagree with that
 * markup (same pitfall as InstallPromptService).
 */
@Service()
export class SeasonService {
  private readonly featureFlags = inject(FeatureFlagService);

  /** The season on, and tonight (nightOf's numbering): set only once it's found to be one. */
  private readonly on = signal<{ season: Season; tonight: number } | null>(null);

  readonly halloween = computed(() => this.on()?.season === 'halloween');
  readonly vice = computed(() => this.on()?.season === 'vice');

  /** This year's Halloween night (nightOf's numbering), while it's the season. */
  readonly halloweenNight = computed(() => {
    const on = this.on();
    return on?.season === 'halloween' ? halloweenNightOf(on.tonight) : null;
  });

  /** Nights to go to Halloween's: 0 on the night itself, null once it's past. */
  readonly nightsToHalloween = computed(() => {
    const tonight = this.on()?.tonight;
    const halloween = this.halloweenNight();
    if (tonight === undefined || halloween === null || tonight > halloween) return null;
    return halloween - tonight;
  });

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || !this.featureFlags.isEnabled(FEATURE_FLAGS.seasonalThemes)) return;

    afterNextRender(() => {
      const tonight = nightOf(Date.now());
      const forced = new URLSearchParams(location.search).get('stagione');
      const season = isSeason(forced) ? forced : seasonOf(tonight);
      if (!season) return;

      this.on.set({ season, tonight });
      document.documentElement.setAttribute('data-season', season);
    });
  }
}

/** The season a night falls in, if any. */
function seasonOf(night: number): Season | null {
  const year = yearOf(night);
  const on = SEASONS.find(
    (s) => (s.year === undefined || s.year === year) && night >= nightOn(year, ...s.start) && night <= nightOn(year, ...s.end),
  );
  return on?.season ?? null;
}
