import { Routes } from '@angular/router';
import { featureFlagGuard } from './core/guards/feature-flag.guard';
import { FEATURE_FLAGS } from './core/config/feature-flags';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },

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

  { path: '**', redirectTo: '' },
];