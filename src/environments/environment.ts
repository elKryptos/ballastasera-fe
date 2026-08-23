/**
 * Default (production) environment — this is what ships to the public site.
 * A feature only reaches visitors once its flag flips to true here.
 */
import { FeatureFlag } from '../app/core/config/feature-flags';

// A plain property annotation, not `as Record<FeatureFlag, boolean>` — a cast
// would silently allow a missing key. This form makes TS error if one is missing.
const featureFlags: Record<FeatureFlag, boolean> = {
  navbarAuth: true,
  // Off until apiUrl above points at a real backend — see the TODO.
  googleAuth: false,
  mapPage: false,
  oauth2Callback: false,
  stagingDemo: false,
};

export const environment = {
  production: true,
  // TODO: point at the real API host once the backend has a public prod URL.
  apiUrl: 'https://api.ballastasera.it',
  featureFlags,
};
