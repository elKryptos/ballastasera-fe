import { Routes } from '@angular/router';
import { EVENT_MANAGEMENT_CONTEXT, EventManagementContext } from './event-management.context';

/** The same four pages for the admin and for the organizer, told apart by the context. */
function eventManagementRoutes(context: EventManagementContext): Routes {
  return [
    {
      path: '',
      providers: [{ provide: EVENT_MANAGEMENT_CONTEXT, useValue: context }],
      children: [
        {
          path: '',
          loadComponent: () => import('./managed-events/managed-events').then((m) => m.ManagedEvents),
        },
        {
          path: 'nuova',
          loadComponent: () => import('./event-editor/event-editor').then((m) => m.EventEditor),
        },
        {
          path: ':id',
          loadComponent: () => import('./managed-event/managed-event').then((m) => m.ManagedEvent),
        },
        {
          path: ':id/modifica',
          loadComponent: () => import('./event-editor/event-editor').then((m) => m.EventEditor),
        },
      ],
    },
  ];
}

/** /admin/serate: every night, with its organizer and a search. */
export const ADMIN_EVENT_ROUTES = eventManagementRoutes({
  scope: 'admin',
  basePath: '/admin/serate',
  title: 'Serate',
  listLabel: 'Serate',
  back: { url: '/admin', label: 'Admin' },
});

/** /serate-pubblicate: the organizer's own nights, from the menu's "Serate pubblicate". */
export const ORGANIZER_EVENT_ROUTES = eventManagementRoutes({
  scope: 'organizer',
  basePath: '/serate-pubblicate',
  title: 'Serate pubblicate',
  listLabel: 'Le tue serate pubblicate',
  back: { url: '/menu', label: 'Menu' },
});
