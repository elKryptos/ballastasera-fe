import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { FeatureFlagService } from '../services/feature-flag.service';

/** Route only matches (and its chunk only loads) when the given flag is on. */
export function featureFlagGuard(flag: string): CanMatchFn {
  return () => inject(FeatureFlagService).isEnabled(flag);
}
