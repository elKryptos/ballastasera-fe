/**
 * Staging environment — deployed behind Cloudflare Access, never linked
 * publicly. Turn a flag on here first to see it live before it goes to prod.
 */
import { FeatureFlag } from '../app/core/config/feature-flags';

// A plain property annotation, not `as Record<FeatureFlag, boolean>` — a cast
// would silently allow a missing key. This form makes TS error if one is missing.
const featureFlags: Record<FeatureFlag, boolean> = {
  stagingDemo: true,
  navbarAuth: true,
  mapPage: true,
  oauth2Callback: true,
  googleAuth: true,
};

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  featureFlags,
};
