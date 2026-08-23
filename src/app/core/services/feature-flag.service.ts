import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FeatureFlag } from '../config/feature-flags';

/** Reads feature flags baked into the build via fileReplacements (see angular.json). */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  isEnabled(flag: FeatureFlag): boolean {
    return environment.featureFlags[flag] === true;
  }
}
