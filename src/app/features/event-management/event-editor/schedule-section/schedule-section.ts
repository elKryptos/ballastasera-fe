import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import { scheduleEndNote } from '../../../../core/utils/event-schedule';
import { EditorSection } from '../editor-section/editor-section';
import { EventEditorFormStore } from '../event-editor-form.store';
import { DayPicker } from './day-picker/day-picker';
import { TimeSelect } from './time-select/time-select';

/** "2 · Quando": the day on a calendar, and the time it starts and ends from a list of quarters. An
 * end before the start is the next day, and the section says so ("Finisce sabato 15 alle 02:00"). */
@Component({
  selector: 'app-schedule-section',
  host: { class: 'block' },
  imports: [ReactiveFormsModule, RouterLink, EditorSection, DayPicker, TimeSelect],
  templateUrl: './schedule-section.html',
})
export class ScheduleSection {
  private readonly store = inject(EventEditorFormStore);
  protected readonly schedule = this.store.form.controls.schedule;
  protected readonly controls = this.schedule.controls;
  /** The admin can make a weekly night a series instead, on its own page. */
  protected readonly offerSeries = computed(() => this.store.scope() === 'admin' && this.store.mode() === 'create');

  protected readonly endNote = toSignal(
    this.schedule.valueChanges.pipe(
      startWith(null),
      map(() => scheduleEndNote(this.schedule.getRawValue())),
    ),
    { initialValue: null },
  );

  protected readonly missing = toSignal(
    this.schedule.events.pipe(
      startWith(null),
      map(() => Object.values(this.controls).some((control) => control.invalid && control.touched)),
    ),
    { initialValue: false },
  );
}
