import { Routes } from '@angular/router';
import { featureFlagGuard } from './core/guards/feature-flag.guard';
import { FEATURE_FLAGS } from './core/config/feature-flags';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },

  {
    // Landed on right after a user's first login (see Oauth2Callback). Not
    // yet gated on a per-user "already seen it" flag — that needs a
    // `hasSeenWelcome`-style field on the backend user first — so for now
    // every login goes here whenever the flag below is on.
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
    path: 'mappa',
    canMatch: [featureFlagGuard(FEATURE_FLAGS.mapPage)],
    loadComponent: () => import('./features/map/map').then((m) => m.MapPage),
  },

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

  {
    path: 'admin/pending-organizers',
    canMatch: [featureFlagGuard(FEATURE_FLAGS.pendingOrganizersPage), roleGuard('ADMIN')],
    loadComponent: () =>
      import('./features/admin/pending-organizers/pending-organizers').then((m) => m.PendingOrganizers),
  },

  { path: '**', redirectTo: '' },
];