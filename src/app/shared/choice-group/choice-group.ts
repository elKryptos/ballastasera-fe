import { Component, booleanAttribute, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface Choice<T> {
  value: T;
  label: string;
}

/** The three looks of SerataNuova.dc.html: "Che tipo di serata" (two columns), "Stili" (chips that
 * wrap) and "Dove" / "Ingresso" (the two halves of a switch). */
type Appearance = 'grid' | 'chips' | 'segmented';

/** The picked option's colour: sky blue in the nights' form, which keeps rose for «Pubblica serata»;
 * inverted (cream by night, ink by day) in "Il tuo account". */
type Tone = 'pick' | 'invert';

/** Grid and chips are the same button (h-11, rounded-xl), laid out differently: the form's
 * buttons all share one shape. */
const BUTTON: Record<Appearance, string> = {
  grid: 'h-11 rounded-xl border text-sm font-bold',
  chips: 'h-11 rounded-xl border px-3.5 text-sm font-bold',
  segmented: 'h-10 rounded-[0.625rem] text-sm font-bold',
};
/** Picked, by tone. Whole class strings, so Tailwind finds them. */
const ON: Record<Tone, Record<Appearance, string>> = {
  pick: {
    grid: 'border-(--ev-pick) bg-(--ev-pick) text-(--ev-on-pick)',
    chips: 'border-(--ev-pick) bg-(--ev-pick) text-(--ev-on-pick)',
    segmented: 'bg-(--ev-pick) text-(--ev-on-pick)',
  },
  invert: {
    grid: 'border-(--ev-invert-bg) bg-(--ev-invert-bg) text-(--ev-invert-text)',
    chips: 'border-(--ev-invert-bg) bg-(--ev-invert-bg) text-(--ev-invert-text)',
    segmented: 'bg-(--ev-invert-bg) text-(--ev-invert-text)',
  },
};
const OFF: Record<Appearance, string> = {
  grid: 'border-line bg-(--ev-surface) text-lead',
  chips: 'border-line bg-(--ev-surface) text-lead',
  segmented: 'text-lead',
};
const GROUP: Record<Appearance, string> = {
  grid: 'grid grid-cols-2 gap-1.5',
  chips: 'flex flex-wrap gap-1.5',
  segmented: 'grid auto-cols-fr grid-flow-col gap-1.5 rounded-[0.875rem] bg-(--ev-surface) p-1',
};

/** A form control picked by tapping: one value, or a list of them when multiple. */
@Component({
  selector: 'app-choice-group',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChoiceGroup), multi: true }],
  host: { class: 'block' },
  templateUrl: './choice-group.html',
})
export class ChoiceGroup<T> implements ControlValueAccessor {
  readonly choices = input.required<Choice<T>[]>();
  /** What the group is, for screen readers: its visible label sits outside it. */
  readonly label = input.required<string>();
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly appearance = input<Appearance>('chips');
  readonly tone = input<Tone>('pick');
  /** One value that may stay empty: tapping the picked one again unpicks it (the value turns null). */
  readonly clearable = input(false, { transform: booleanAttribute });

  protected readonly selected = signal<T[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (value: T | T[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected groupClass(): string {
    return GROUP[this.appearance()];
  }

  protected buttonClass(on: boolean): string {
    const appearance = this.appearance();
    return `cursor-pointer disabled:cursor-default disabled:opacity-50 ${BUTTON[appearance]} ${on ? ON[this.tone()][appearance] : OFF[appearance]}`;
  }

  protected isOn(value: T): boolean {
    return this.selected().includes(value);
  }

  protected pick(value: T): void {
    if (this.multiple()) {
      const next = this.isOn(value) ? this.selected().filter((v) => v !== value) : [...this.selected(), value];
      this.selected.set(next);
      this.onChange(next);
    } else if (this.clearable() && this.isOn(value)) {
      this.selected.set([]);
      this.onChange(null);
    } else {
      this.selected.set([value]);
      this.onChange(value);
    }
    this.onTouched();
  }

  writeValue(value: T | T[] | null): void {
    if (Array.isArray(value)) this.selected.set(value);
    else this.selected.set(value === null || value === '' ? [] : [value]);
  }

  registerOnChange(fn: (value: T | T[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
