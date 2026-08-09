import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/landing/landing').then((m) => m.Landing) },

  // Features in development go here, gated behind a flag so they only render
  // where that flag is on (see src/environments). Example:
  // import { featureFlagGuard } from './core/guards/feature-flag.guard';
  // {
  //   path: 'app',
  //   canMatch: [featureFlagGuard('appShell')],
  //   loadChildren: () => import('./features/app-shell/app-shell.routes').then((m) => m.routes),
  // },

  { path: '**', redirectTo: '' },
];
