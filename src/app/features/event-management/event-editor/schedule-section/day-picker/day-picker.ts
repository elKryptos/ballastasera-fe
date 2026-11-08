import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { type BrnCalendarI18n, provideBrnCalendarI18n } from '@spartan-ng/brain/calendar';
import { HlmDatePickerImports } from '@spartan-ng/helm/date-picker';
import { dayDate, dayKey, pickedDayLabel } from '../../../../../core/utils/event-schedule';

const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
] as const;

/** Spartan's calendar in Italian, the week from Monday. */
const CALENDAR_IT: Partial<BrnCalendarI18n> = {
  formatWeekdayName: (index) => WEEKDAYS[index].slice(0, 2).toUpperCase(),
  labelWeekday: (index) => WEEKDAYS[index],
  months: () => [...MONTHS],
  formatHeader: (month, year) => `${MONTHS[month]} ${year}`,
  formatMonth: (month) => MONTHS[month].slice(0, 3),
  formatYear: (year) => String(year),
  labelPrevious: () => 'Mese precedente',
  labelNext: () => 'Mese successivo',
  firstDayOfWeek: () => 1,
};

/** The trigger's button, looking like the form's other fields. Bound with [class], never as a plain
 * class attribute: the trigger has a `class` input, and a static attribute would also land on its
 * inline host, painting stray rounded patches around the button. */
const TRIGGER_CLASS =
  'h-12 w-full rounded-[0.875rem] border-(--ev-edge) bg-(--ev-surface) px-3.5 text-base font-normal text-(--ev-text) hover:bg-(--ev-surface) hover:text-(--ev-text) data-placeholder:text-muted [app-day-picker.ng-invalid.ng-touched_&]:border-(--ev-error)';

/** Today at midnight: the first day the calendar lets pick. */
function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "Giorno" in "2 · Quando": Spartan's date picker, a calendar that opens under the button. The form
 * keeps the day as yyyy-MM-dd; this turns it into the calendar's Date and back. Days already gone
 * can't be picked. */
@Component({
  selector: 'app-day-picker',
  imports: [HlmDatePickerImports],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DayPicker), multi: true },
    provideBrnCalendarI18n(CALENDAR_IT),
  ],
  host: { class: 'block' },
  template: `
    <hlm-date-picker align="start" autoCloseOnSelect [date]="date()" [minDate]="minDate" [formatDate]="formatDay"
      [disabled]="disabled()" (dateChange)="pick($event)">
      <hlm-date-picker-trigger [buttonId]="fieldId()" [class]="triggerClass">
        Scegli il giorno
      </hlm-date-picker-trigger>
    </hlm-date-picker>
  `,
})
export class DayPicker implements ControlValueAccessor {
  /** The button's id, for the label's "for". */
  readonly fieldId = input.required<string>();

  protected readonly date = signal<Date | undefined>(undefined);
  protected readonly disabled = signal(false);
  protected readonly minDate = today();
  /** "Venerdì 14 novembre", on the button once a day is picked. */
  protected readonly formatDay = pickedDayLabel;
  protected readonly triggerClass = TRIGGER_CLASS;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected pick(day: Date | null): void {
    this.date.set(day ?? undefined);
    this.onChange(day ? dayKey(day) : '');
    this.onTouched();
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
