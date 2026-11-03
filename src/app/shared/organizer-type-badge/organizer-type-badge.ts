import { Component, computed, input } from '@angular/core';
import { ORGANIZER_TYPE_LABELS } from '../../core/config/organizer-types';
import { OrganizerType } from '../../core/models/organizer.model';

@Component({
  selector: 'app-organizer-type-badge',
  host: { class: 'inline-block rounded-lg bg-(--ev-tag-bg) px-2 py-0.5 text-xs font-bold text-(--ev-tag-text)' },
  template: `{{ label() }}`,
})
export class OrganizerTypeBadge {
  readonly type = input.required<OrganizerType>();
  protected readonly label = computed(() => ORGANIZER_TYPE_LABELS[this.type()]);
}
