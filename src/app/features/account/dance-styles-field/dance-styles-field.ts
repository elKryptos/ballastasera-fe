import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DANCE_LEVELS, DANCE_LEVEL_LABELS, MAX_DANCE_STYLES, levelRank } from '../../../core/config/dance-profile';
import { DanceLevel, UserDanceStyleUpdateDto } from '../../../core/models/user.model';
import { DanceStylesService } from '../../../core/services/dance-styles.service';
import { controlValue } from '../../../core/utils/form-controls';
import { LevelInsignia } from '../../../shared/level-insignia/level-insignia';
import { PROFILE_FORM } from '../profile-form';

/** "Cosa balli" in "Il tuo account": the styles the user dances, up to MAX_DANCE_STYLES,
 * each with its level. A style is picked at Principiante; its card below changes the level
 * or takes it away. */
@Component({
  selector: 'app-dance-styles-field',
  imports: [LevelInsignia],
  templateUrl: './dance-styles-field.html',
  styleUrl: './dance-styles-field.css',
})
export class DanceStylesField {
  private readonly control = inject(PROFILE_FORM).controls.danceStyles;

  /** Every style to pick from: undefined while loading, null if it couldn't be loaded. Caught here:
   * an error left in toSignal would be thrown by the template reading it. */
  private readonly loadedStyles = toSignal(
    inject(DanceStylesService)
      .getDanceStyles()
      .pipe(catchError(() => of(null))),
    { initialValue: undefined },
  );
  protected readonly styles = computed(() => this.loadedStyles() ?? []);
  protected readonly stylesFailed = computed(() => this.loadedStyles() === null);
  protected readonly picked = controlValue(this.control);
  protected readonly max = MAX_DANCE_STYLES;
  protected readonly full = computed(() => this.picked().length >= MAX_DANCE_STYLES);

  /** Every style, and whether it's picked: the chips. */
  protected readonly chips = computed(() => {
    const picked = new Set(this.picked().map((style) => style.danceStyleId));
    return this.styles().map((style) => ({ id: style.id, name: style.name, picked: picked.has(style.id) }));
  });

  /** The picked styles in the order they were picked, by name, with their levels to choose from. */
  protected readonly cards = computed(() => {
    const names = new Map(this.styles().map((style) => [style.id, style.name]));
    return this.picked().map((style) => ({
      id: style.danceStyleId,
      name: names.get(style.danceStyleId) ?? '',
      /** The picked level, by its name next to the style's on a phone, where the buttons have only their insignia. */
      rank: levelRank(style.level),
      levelLabel: DANCE_LEVEL_LABELS[style.level],
      levels: DANCE_LEVELS.map((level) => ({
        value: level,
        label: DANCE_LEVEL_LABELS[level],
        rank: levelRank(level),
        picked: level === style.level,
      })),
    }));
  });

  protected toggle(id: number): void {
    const picked = this.picked();
    if (picked.some((style) => style.danceStyleId === id)) {
      this.remove(id);
    } else if (!this.full()) {
      this.set([...picked, { danceStyleId: id, level: 'BEGINNER' }]);
    }
  }

  protected remove(id: number): void {
    this.set(this.picked().filter((style) => style.danceStyleId !== id));
  }

  protected setLevel(id: number, level: DanceLevel): void {
    this.set(this.picked().map((style) => (style.danceStyleId === id ? { ...style, level } : style)));
  }

  private set(value: UserDanceStyleUpdateDto[]): void {
    this.control.setValue(value);
    this.control.markAsDirty();
  }
}
