import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { provideBrnCalendarI18n } from '@spartan-ng/brain/calendar';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { CALENDAR_IT, MONTHS } from '../../../core/config/calendar-it';
import { MAX_AGE, MIN_AGE } from '../../../core/config/dance-profile';
import { dayDate, dayKey } from '../../../core/utils/event-schedule';
import { shiftYears } from '../../../core/utils/form-validators';

/** The trigger's button, the look of the form's other fields (.request-input). Bound with [class],
 * never as a plain class attribute: the trigger has a `class` input (see DayPicker). */
const TRIGGER_CLASS =
  'h-12 w-full rounded-[0.875rem] border-(--ev-edge) bg-(--ev-surface) px-3.5 text-base font-normal text-(--ev-text) hover:bg-(--ev-surface) hover:text-(--ev-text) data-placeholder:text-muted [app-birth-date-picker.ng-invalid.ng-touched_&]:border-(--ev-error)';

/** Where the calendar opens with no date yet: a likely birth year, not this month. */
const FIRST_LOOK_AGE = 25;

/** "Data di nascita" in "Il tuo account": the same Spartan date picker as a night's "Giorno"
 * (DayPicker), with a month and a year dropdown, since a birth date is decades back. Only the
 * days the backend accepts can be picked (MIN_AGE to MAX_AGE, see birthDateInRange). The form
 * keeps the day as yyyy-MM-dd, '' for none. */
@Component({
  selector: 'app-birth-date-picker',
  imports: [HlmDatePickerImports],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BirthDatePicker), multi: true },
    provideBrnCalendarI18n({ ...CALENDAR_IT, years: () => birthYears(new Date()) }),
  ],
  templateUrl: './birth-date-picker.html',
  styleUrl: './birth-date-picker.css',
})
export class BirthDatePicker implements ControlValueAccessor {
  /** The button's id, for the label's "for". */
  readonly fieldId = input.required<string>();

  private readonly today = new Date();
  /** The backend wants someone younger than MAX_AGE: the day after MAX_AGE years ago. */
  protected readonly minDate = dayAfter(dayDate(shiftYears(this.today, -MAX_AGE))!);
  protected readonly maxDate = dayDate(shiftYears(this.today, -MIN_AGE))!;
  protected readonly firstLook = dayDate(shiftYears(this.today, -FIRST_LOOK_AGE))!;

  protected readonly date = signal<Date | undefined>(undefined);
  protected readonly disabled = signal(false);
  protected readonly triggerClass = TRIGGER_CLASS;
  /** "12 aprile 1993", on the button once a day is picked. */
  protected readonly formatBirthDate = (day: Date) => `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected pick(day: Date | null): void {
    this.date.set(day ?? undefined);
    this.onChange(day ? dayKey(day) : '');
    this.onTouched();
  }

  protected clear(): void {
    this.pick(null);
  }

  writeValue(value: string | null): void {
    this.date.set(dayDate(value ?? '') ?? undefined);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }
}

/** The year dropdown: the years someone MIN_AGE to MAX_AGE can be born in, the most recent first. */
function birthYears(today: Date): number[] {
  const last = today.getFullYear() - MIN_AGE;
  const first = today.getFullYear() - MAX_AGE;
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}

function dayAfter(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
}
