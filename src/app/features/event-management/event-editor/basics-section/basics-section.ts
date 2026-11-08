import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';
import { DanceStylesService } from '../../../../core/services/dance-styles.service';
import { RequestField } from '../../../../shared/request-field/request-field';
import { Choice, ChoiceGroup } from '../choice-group/choice-group';
import { EditorSection } from '../editor-section/editor-section';
import { EVENT_TYPE_CHOICES } from '../../../../core/config/event-types';
import { EventEditorFormStore } from '../event-editor-form.store';

/** "1 · La serata": the title, its kind, the styles danced and a description. */
@Component({
  selector: 'app-basics-section',
  host: { class: 'block' },
  imports: [ReactiveFormsModule, EditorSection, RequestField, ChoiceGroup],
  templateUrl: './basics-section.html',
})
export class BasicsSection {
  protected readonly controls = inject(EventEditorFormStore).form.controls;
  protected readonly typeChoices = EVENT_TYPE_CHOICES;
  protected readonly styleChoices = toSignal(
    inject(DanceStylesService)
      .getDanceStyles()
      .pipe(
        map((styles): Choice<number>[] => styles.map((style) => ({ value: style.id, label: style.name }))),
        catchError(() => of<Choice<number>[]>([])),
      ),
    { initialValue: [] as Choice<number>[] },
  );
}
