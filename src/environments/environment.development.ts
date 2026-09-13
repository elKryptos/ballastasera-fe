/**
 * Local development environment — used by `pnpm start` (ng serve).
 * Points at the backend running on localhost:8081 (see SERVER_PORT in
 * ballastasera-be/ballastasera/.env). Feature flags can be on here because
 * nothing in this environment ships to visitors.
 */
import { FeatureFlag } from '../app/core/config/feature-flags';

// A plain property annotation, not `as Record<FeatureFlag, boolean>` — a cast
// would silently allow a missing key. This form makes TS error if one is missing.
const featureFlags: Record<FeatureFlag, boolean> = {
  navbarAuth: true,
  googleAuth: true,
  mapPage: true,
  oauth2Callback: true,
  stagingDemo: false,
};

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081',
  featureFlags,
};
