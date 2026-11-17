import { Component, computed, input } from '@angular/core';
import { DANCE_LEVEL_LABELS, levelRank } from '../../core/config/dance-profile';
import { DanceLevel } from '../../core/models/user.model';
import { LevelInsignia } from '../level-insignia/level-insignia';

/** A dancer's level in a style: its insignia (a shield with chevrons, starred for a teacher:
 * app-level-insignia) and its name, both in the level's colour (green for a beginner up to gold
 * for a teacher: the global .level-N class, styles.css). From the canvas' profile of someone
 * going ("Cosa balla"). */
@Component({
  selector: 'app-level-meter',
  imports: [LevelInsignia],
  templateUrl: './level-meter.html',
  styleUrl: './level-meter.css',
  host: { '[class]': '"level-" + rank()' },
})
export class LevelMeter {
  readonly level = input.required<DanceLevel>();

  protected readonly rank = computed(() => levelRank(this.level()));
  protected readonly label = computed(() => DANCE_LEVEL_LABELS[this.level()]);
}
