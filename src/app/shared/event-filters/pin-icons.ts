import { Component, computed, input } from '@angular/core';
import { EventType } from '../../core/models/event.model';
import { VenueType } from '../../core/models/venue.model';
import {
  PIN_COLORS,
  PIN_GLYPHS,
  PIN_SHAPES,
  VENUE_PIN_COLORS,
  VENUE_PIN_GLYPHS,
} from '../../core/config/map-pins';

/** An event type's map pin, drawn small — the Filtri dialog's "Tipo di
 * serata" chips double as the map's legend, cards without a flyer show it
 * in its place, the event page drops it on its mini-map, the landing lists
 * it in its legend, and the menu and welcome pages decorate with it. Same
 * shapes and colours as the real markers (map-pins.ts). */
@Component({
  selector: 'app-event-pin-icon',
  template: `
    <svg viewBox="0 0 24 32" [attr.width]="width()" [attr.height]="size()" aria-hidden="true">
      <path [attr.d]="shape()" [attr.fill]="color()" />
      <path [attr.d]="glyph()" [attr.fill]="glyphFill()" />
    </svg>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class EventPinIcon {
  readonly type = input.required<EventType>();
  /** Height in px; the pin is 3:4. */
  readonly size = input(20);
  /** The map's colour for the type unless a page passes its own (welcome
   * passes its theme tokens, which change with the light theme). */
  readonly fill = input<string | null>(null);
  readonly glyphFill = input('#fff');

  protected readonly width = computed(() => (this.size() * 3) / 4);
  protected readonly shape = computed(() => PIN_SHAPES[this.type()]);
  protected readonly glyph = computed(() => PIN_GLYPHS[this.type()]);
  protected readonly color = computed(() => this.fill() ?? PIN_COLORS[this.type()]);
}

/** A venue's round map badge, for the "Sulla mappa" legend, the venue card
 * and the venue page's mini-map. */
@Component({
  selector: 'app-venue-pin-icon',
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <circle cx="12" cy="12" r="11" [attr.fill]="color()" stroke="#fff" stroke-width="2" />
      <path [attr.d]="glyph()" fill="#fff" />
    </svg>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class VenuePinIcon {
  readonly type = input.required<VenueType>();
  readonly size = input(16);

  protected readonly glyph = computed(() => VENUE_PIN_GLYPHS[this.type()]);
  protected readonly color = computed(() => VENUE_PIN_COLORS[this.type()]);
}
