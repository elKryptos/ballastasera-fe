import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { FeatureFlagService } from '../services/feature-flag.service';
import { FeatureFlag } from '../config/feature-flags';

/** Route only matches (and its chunk only loads) when the given flag is on. */
export function featureFlagGuard(flag: FeatureFlag): CanMatchFn {
  return () => inject(FeatureFlagService).isEnabled(flag);
}
