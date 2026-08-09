import { Routes } from '@angular/router';
import { featureFlagGuard } from './core/guards/feature-flag.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },

  // Demo: only matches (and only its chunk downloads) when 'stagingDemo' is
  // on — see src/environments. Delete this block once you build a real one.
  {
    path: 'staging-demo',
    canMatch: [featureFlagGuard('stagingDemo')],
    loadComponent: () =>
      import('./features/staging-demo/staging-demo').then((m) => m.StagingDemo),
  },

  { path: '**', redirectTo: '' },
];