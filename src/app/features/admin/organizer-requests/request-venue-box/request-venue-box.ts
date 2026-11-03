import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMapPin } from '@ng-icons/lucide';

/** A venue that's settled for a request: the page's own, one just created, one
 * picked. Anything to do about it goes in as content, beside the link. */
@Component({
  selector: 'app-request-venue-box',
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ lucideMapPin })],
  host: { class: 'flex items-start gap-2.5 rounded-xl border border-(--ev-zone-on-text)/40 bg-(--ev-zone-on-bg) p-3' },
  template: `
    <ng-icon name="lucideMapPin" size="1.25rem" class="shrink-0 text-(--ev-zone-on-text)" aria-hidden="true" />
    <div class="min-w-0 grow">
      <div class="text-xs font-extrabold tracking-[0.06em] text-(--ev-zone-on-text) uppercase">{{ heading() }}</div>
      @if (name(); as name) {
      <div class="mt-1 text-[0.9375rem] font-extrabold">{{ name }}</div>
      }
      <div class="mt-0.5 text-[0.8125rem] text-(--ev-soft)">{{ text() }}</div>
    </div>
    <div class="flex shrink-0 flex-col items-end gap-1 self-center text-sm font-bold text-(--ev-link)">
      <a [routerLink]="['/luogo', venueId()]">Apri</a>
      <ng-content />
    </div>
  `,
})
export class RequestVenueBox {
  readonly heading = input.required<string>();
  readonly name = input<string>();
  readonly text = input.required<string>();
  readonly venueId = input.required<string>();
}
