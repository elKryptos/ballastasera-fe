import { Component, booleanAttribute, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface Choice<T> {
  value: T;
  label: string;
}

/** The three looks of SerataNuova.dc.html: "Che tipo di serata" (two columns), "Stili" (chips that
 * wrap) and "Dove" / "Ingresso" (the two halves of a switch). */
type Appearance = 'grid' | 'chips' | 'segmented';

const BUTTON: Record<Appearance, string> = {
  grid: 'h-11 rounded-xl border text-sm font-bold',
  chips: 'h-9 rounded-full border px-3 text-[0.8125rem] font-bold',
  segmented: 'h-10 rounded-[0.625rem] text-sm font-bold',
};
const ON: Record<Appearance, string> = {
  grid: 'border-rose bg-rose text-(--ev-on-rose)',
  chips: 'border-rose bg-rose text-(--ev-on-rose)',
  segmented: 'bg-rose text-(--ev-on-rose)',
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
  template: `
    <div [attr.role]="multiple() ? 'group' : 'radiogroup'" [attr.aria-label]="label()" [class]="groupClass()">
      @for (choice of choices(); track choice.value) {
      @let on = isOn(choice.value);
      <button type="button" [attr.role]="multiple() ? null : 'radio'" [attr.aria-checked]="multiple() ? null : on"
        [attr.aria-pressed]="multiple() ? on : null" [disabled]="disabled()"
        [class]="buttonClass(on)" (click)="pick(choice.value)">
        {{ choice.label }}
      </button>
      }
    </div>
  `,
})
export class ChoiceGroup<T> implements ControlValueAccessor {
  readonly choices = input.required<Choice<T>[]>();
  /** What the group is, for screen readers: its visible label sits outside it. */
  readonly label = input.required<string>();
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly appearance = input<Appearance>('chips');

  protected readonly selected = signal<T[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (value: T | T[]) => void = () => {};
  private onTouched: () => void = () => {};

  protected groupClass(): string {
    return GROUP[this.appearance()];
  }

  protected buttonClass(on: boolean): string {
    const appearance = this.appearance();
    return `cursor-pointer disabled:cursor-default disabled:opacity-50 ${BUTTON[appearance]} ${on ? ON[appearance] : OFF[appearance]}`;
  }

  protected isOn(value: T): boolean {
    return this.selected().includes(value);
  }

  protected pick(value: T): void {
    if (this.multiple()) {
      const next = this.isOn(value) ? this.selected().filter((v) => v !== value) : [...this.selected(), value];
      this.selected.set(next);
      this.onChange(next);
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

  registerOnChange(fn: (value: T | T[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}
