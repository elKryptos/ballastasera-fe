import { Component, input } from '@angular/core';

/** One of the form's blocks, as the canvas draws them (SerataNuova.dc.html): "1 · La serata",
 * "2 · Quando"… with the number in mono, and a chip on the right ("Solo admin") when there's one.
 * Its fields are projected. */
@Component({
  selector: 'app-editor-section',
  host: {
    class: 'flex flex-col gap-3.5 rounded-[1.125rem] border border-line bg-(--ev-raised) p-4',
    role: 'group',
    '[attr.aria-labelledby]': 'sectionId()',
  },
  template: `
    <div class="flex items-center justify-between gap-3">
      <h2 [id]="sectionId()" class="text-[0.9375rem] font-extrabold">
        @if (step(); as step) {
        <span class="font-mono text-(--ev-like)">{{ step }}</span> ·
        }
        {{ title() }}
        @if (note(); as note) {
        <span class="font-medium text-muted">· {{ note }}</span>
        }
      </h2>
      @if (badge(); as badge) {
      <span class="shrink-0 rounded-lg bg-[#6aa8ff]/16 px-2 py-0.5 text-[0.6875rem] font-extrabold text-[#6aa8ff]">{{ badge }}</span>
      }
    </div>
    <ng-content />
  `,
})
export class EditorSection {
  readonly title = input.required<string>();
  /** The heading's id, which names the block. */
  readonly sectionId = input.required<string>();
  readonly step = input<number>();
  readonly note = input<string>();
  readonly badge = input<string>();
}
