import { Component, computed, input } from '@angular/core';

/** An organizer's logo, or its initials without one. Decorative: its name is
 * always written next to it. Size and corners come from the class on the tag. */
@Component({
  selector: 'app-organizer-avatar',
  host: {
    class: 'flex shrink-0 items-center justify-center overflow-hidden bg-(--ev-tag-bg) font-extrabold text-(--ev-tag-text)',
    'aria-hidden': 'true',
  },
  template: `
    @if (logoUrl(); as logo) {
    <img [src]="logo" alt="" class="size-full object-cover" />
    } @else {
    {{ initials() }}
    }
  `,
})
export class OrganizerAvatar {
  readonly name = input.required<string>();
  readonly logoUrl = input<string | null>(null);

  protected readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join(''),
  );
}
