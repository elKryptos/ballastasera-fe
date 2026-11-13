import { Component, computed, input, output } from '@angular/core';
import { EventManagementTab } from '../../../../core/models/event.model';

interface TabItem {
  tab: EventManagementTab;
  label: string;
}

/** The admin's chips (AdminSerate.dc.html) and the organizer's segmented bar
 * (SeratePubblicate.dc.html): their own words and their own order. */
const ADMIN_TABS: TabItem[] = [
  { tab: 'UPCOMING', label: 'Prossime' },
  { tab: 'CANCELLED', label: 'Annullate' },
  { tab: 'PAST', label: 'Passate' },
];
const ORGANIZER_TABS: TabItem[] = [
  { tab: 'UPCOMING', label: 'In programma' },
  { tab: 'PAST', label: 'Passate' },
  { tab: 'CANCELLED', label: 'Annullate' },
];

/** The lists' three tabs, each with how many nights it holds once known: chips for the admin, a
 * segmented bar for the organizer, as the canvas draws them. */
@Component({
  selector: 'app-management-tabs',
  host: { class: 'block' },
  templateUrl: './management-tabs.html',
})
export class ManagementTabs {
  readonly tab = input.required<EventManagementTab>();
  readonly counts = input<Partial<Record<EventManagementTab, number>>>({});
  readonly appearance = input<'chips' | 'segmented'>('segmented');
  readonly tabChange = output<EventManagementTab>();

  protected readonly tabs = computed(() => (this.appearance() === 'chips' ? ADMIN_TABS : ORGANIZER_TABS));
}
