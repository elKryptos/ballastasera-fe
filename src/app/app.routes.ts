import { Routes } from '@angular/router';
import { featureFlagGuard } from './core/guards/feature-flag.guard';
import { FEATURE_FLAGS } from './core/config/feature-flags';
import { roleGuard } from './core/guards/role.guard';

const loadLanding = () => import('./features/landing/landing').then((m) => m.Landing);

export const routes: Routes = [
  {
    // Every page with the site navigation sits under this one parent, which
    // holds a single <app-navbar> for all of them — see NavLayout. Its chunk
    // only loads once one of these pages matches; a URL none of them takes
    // falls through to the routes after it.
    path: '',
    loadComponent: () => import('./shared/nav-layout/nav-layout').then((m) => m.NavLayout),
    children: [
      {
        // The landing only takes the navbar with the redesign on; otherwise
        // it's the bare route right after this parent.
        path: '',
        pathMatch: 'full',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.navbarAuth)],
        loadComponent: loadLanding,
      },

      {
        // Landed on after each of a user's first three logins (loginCount <= 3,
        // see Oauth2Callback.postLoginUrl); from the fourth on, login goes
        // straight to /menu. Only while the flag below is on.
        path: 'benvenuto',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.welcomePage)],
        loadComponent: () => import('./features/welcome/welcome').then((m) => m.Welcome),
      },

      {
        path: 'menu',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.menuPage)],
        loadComponent: () => import('./features/menu/menu').then((m) => m.Menu),
      },

      {
        // keepAlive: detached rather than destroyed on the way out, so coming
        // back doesn't rebuild the map — see KeepAliveReuseStrategy.
        path: 'mappa',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.mapPage)],
        data: { keepAlive: true },
        loadComponent: () => import('./features/map/map').then((m) => m.MapPage),
      },

      {
        // The map's search as a list, grouped by night — the "Lista" half of
        // the Mappa | Lista switch. Same filters (EventFiltersService).
        path: 'lista',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.eventListPage)],
        loadComponent: () => import('./features/event-list/event-list').then((m) => m.EventList),
      },

      {
        path: 'admin',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.adminHomePage), roleGuard('ADMIN')],
        loadComponent: () => import('./features/admin/admin-home/admin-home').then((m) => m.AdminHome),
      },

      {
        path: 'admin/pending-organizers',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.pendingOrganizersPage), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/pending-organizers/pending-organizers').then((m) => m.PendingOrganizers),
      },

      {
        path: 'admin/create-unclaimed-organizer',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.createUnclaimedOrganizerPage), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/create-unclaimed-organizer/create-unclaimed-organizer').then(
            (m) => m.CreateUnclaimedOrganizer,
          ),
      },

      {
        path: 'admin/create-event',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.createEventPage), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/create-event/create-event').then((m) => m.CreateEvent),
      },

      {
        path: 'admin/verified-organizers-list',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.verifiedOrganizersPage), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/verified-organizer-list/verified-organizer-list').then(
            (m) => m.VerifiedOrganizerList,
          ),
      },

      {
        path: 'admin/update-organizer/:id',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.updateOrganizerPage), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/update-organizer/update-organizer').then(
            (m) => m.UpdateOrganizer,
          ),
      },

      {
        path: 'evento/:id',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.eventDetailsPage)],
        loadComponent: () =>
          import('./features/event-details/event-details').then(
            (m) => m.EventDetails),
      },

      {
        // A venue's page, opened from its card on /mappa.
        path: 'luogo/:id',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.venueDetailsPage)],
        loadComponent: () =>
          import('./features/venue-details/venue-details').then(
            (m) => m.VenueDetails),
      },

      {
        path: 'admin/create-event-series',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.createEventSeries), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/create-event-series/create-event-series').then(
            (m) => m.CreateEventSeries)
      },

      {
        path: 'admin/create-venue',
        canMatch: [featureFlagGuard(FEATURE_FLAGS.createVenuePage), roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/admin/create-venue/create-venue').then(
            (m) => m.CreateVenue)
      },
    ],
  },

  // Without the site navigation:
  { path: '', pathMatch: 'full', loadComponent: loadLanding },

  {
    path: 'oauth2/callback',
    canMatch: [featureFlagGuard(FEATURE_FLAGS.oauth2Callback)],
    loadComponent: () =>
      import('./features/oauth2-callback/oauth2-callback').then((m) => m.Oauth2Callback),
  },

  // Demo: only matches (and only its chunk downloads) when 'stagingDemo' is
  // on — see src/environments. Delete this block once you build a real one.
  {
    path: 'staging-demo',
    canMatch: [featureFlagGuard(FEATURE_FLAGS.stagingDemo)],
    loadComponent: () =>
      import('./features/staging-demo/staging-demo').then((m) => m.StagingDemo),
  },

  { path: '**', redirectTo: '' },
];
