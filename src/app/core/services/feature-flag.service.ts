import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Reads feature flags baked into the build via fileReplacements (see angular.json). */
@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  isEnabled(flag: string): boolean {
    return environment.featureFlags[flag] === true;
  }
}
