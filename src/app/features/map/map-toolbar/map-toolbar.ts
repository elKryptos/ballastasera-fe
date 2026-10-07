import { Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { EVENT_TYPE_LABELS } from '../../../core/config/map-pins';
import { EventFiltersService } from '../../../core/services/event-filters.service';
import { DateRangeChips } from '../../../shared/event-filters/date-range-chips';
import { ViewSwitch } from '../../../shared/event-filters/view-switch';
import { LAYER_CHIPS, LAYER_OPTIONS, MapLayer } from '../map-layer';

interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
  /** From md up the layer has its own switch, so its chip would repeat it. */
  mobileOnly?: boolean;
}

/**
 * The map's top bar: Mappa | Lista, the Filtri button with the day chips next
 * to it, and — only while any is on — one removable chip per active filter
 * plus "Azzera". Floating straight on the map on phones; the top card of the
 * left-hand panel from md up, where what the map shows (Serate | Locali e
 * scuole | Scuole | Entrambi) gets a switch of its own, one click away instead
 * of inside Filtri. On the schools layer, Lista is the schools' (/scuole). Day,
 * styles, types and price are EventFiltersService's; the layer is MapPage's,
 * hence the output.
 */
@Component({
  selector: 'app-map-toolbar',
  imports: [DateRangeChips, ViewSwitch, NgTemplateOutlet],
  templateUrl: './map-toolbar.html',
  host: { class: 'block' },
})
export class MapToolbar {
  protected readonly filters = inject(EventFiltersService);

  readonly layer = input.required<MapLayer>();
  /** The /lista route is on (feature flag) — otherwise no Mappa | Lista. */
  readonly listEnabled = input(false);
  /** The /scuole route is on: on the schools layer, Lista goes there. */
  readonly schoolListEnabled = input(false);

  readonly filtersOpened = output<void>();
  /** Picked on the switch, or 'events' when the layer's chip is removed. */
  readonly layerChanged = output<MapLayer>();

  protected readonly layerOptions = LAYER_OPTIONS;
  /** Mappa | Lista: the nights' list, or the schools' while only they show. */
  private readonly toSchools = computed(() => this.layer() === 'schools' && this.schoolListEnabled());
  protected readonly showSwitch = computed(() => this.listEnabled() || this.toSchools());
  protected readonly listPath = computed(() => (this.toSchools() ? '/scuole' : '/lista'));

  protected readonly chips = computed<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];
    const layerLabel = LAYER_CHIPS[this.layer()];
    if (layerLabel) {
      chips.push({ key: 'layer', label: layerLabel, remove: () => this.layerChanged.emit('events'), mobileOnly: true });
    }
    for (const name of this.filters.styles()) {
      chips.push({ key: `style:${name}`, label: name, remove: () => this.filters.toggleStyle(name) });
    }
    for (const type of this.filters.types()) {
      chips.push({ key: `type:${type}`, label: EVENT_TYPE_LABELS[type], remove: () => this.filters.toggleType(type) });
    }
    if (this.filters.freeOnly()) {
      chips.push({ key: 'free', label: 'Gratis', remove: () => this.filters.freeOnly.set(false) });
    }
    return chips;
  });

  /** From md up, the chips row only shows when there's more than the layer's. */
  protected readonly hasDesktopChips = computed(() => this.chips().some((chip) => !chip.mobileOnly));

  protected clearAll(): void {
    this.filters.clear();
    this.layerChanged.emit('events');
  }
}
