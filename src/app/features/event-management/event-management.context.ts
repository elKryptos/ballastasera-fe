import { InjectionToken } from '@angular/core';
import { EventManagementScope } from '../../core/services/event-management.service';

/** Who the nights' pages are for, and where they live. The admin's and the organizer's are the
 * same pages: this, provided by their routes (event-management.routes.ts), is all that differs. */
export interface EventManagementContext {
  scope: EventManagementScope;
  /** The list's path. A night's pages hang from it: nuova, :id and :id/modifica. */
  basePath: string;
  /** The list's heading. */
  title: string;
  /** The back link to the list, from a night's page and from the form. */
  listLabel: string;
  /** Where the list's back link leads. */
  back: { url: string; label: string };
}

export const EVENT_MANAGEMENT_CONTEXT = new InjectionToken<EventManagementContext>('EventManagementContext');
