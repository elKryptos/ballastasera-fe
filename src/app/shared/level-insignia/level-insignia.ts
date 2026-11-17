import { Component, computed, input } from '@angular/core';

/** The badge every level shares, in the 24×24 viewBox. */
const SHIELD = 'M12 2.2 20 5.2V11c0 5.3-3.3 9.2-8 10.8C7.3 20.2 4 16.3 4 11V5.2Z';
/** A five-pointed star centred in the shield: cut out of it for a teacher. */
const STAR = 'M12 6.7 13.12 9.76 16.38 9.88 13.81 11.89 14.7 15.02 12 13.2 9.3 15.02 10.19 11.89 7.62 9.88 10.88 9.76Z';

/** A solid chevron's height, and the step from one to the next (a 1-unit gap between them). */
const CHEVRON_HEIGHT = 5.6;
const CHEVRON_STEP = 3.4;
/** Where the chevrons centre: a little above the middle, where the shield is widest. */
const CHEVRON_CENTRE = 11.2;

/** A dancer's level as a game's rank badge: the same shield for every level, with one to three
 * solid chevrons (beginner, intermediate, advanced) and, for a teacher, filled whole with a star
 * cut out of it: the badge grown, not a different one, as games do with their top tier. Solid
 * shapes rather than thin lines, so it still reads at 20px. Drawn in currentColor: whoever shows
 * it gives it the level's colour (--ev-level-N), and the cut-out star shows what's behind. Hidden
 * from screen readers: the level's name is always said next to it, or in an aria-label. Used by
 * the account's level picker and by the profile's app-level-meter. */
@Component({
  selector: 'app-level-insignia',
  templateUrl: './level-insignia.html',
  styleUrl: './level-insignia.css',
  host: { 'aria-hidden': 'true' },
})
export class LevelInsignia {
  /** 1 to 4, see levelRank. */
  readonly rank = input.required<number>();

  protected readonly shield = SHIELD;
  protected readonly teacherBadge = `${SHIELD}${STAR}`;
  protected readonly isTeacher = computed(() => this.rank() >= 4);

  /** The chevrons' outlines, stacked and centred together in the shield. */
  protected readonly chevrons = computed(() => {
    const count = Math.min(Math.max(this.rank(), 1), 3);
    const top = CHEVRON_CENTRE - (CHEVRON_HEIGHT + CHEVRON_STEP * (count - 1)) / 2;
    return Array.from({ length: count }, (_, i) => chevron(top + i * CHEVRON_STEP));
  });
}

/** A solid chevron pointing up, its tip at y. */
function chevron(y: number): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `M8 ${r(y + 3.2)}L12 ${r(y)}L16 ${r(y + 3.2)}V${r(y + 5.6)}L12 ${r(y + 2.4)}L8 ${r(y + 5.6)}Z`;
}
