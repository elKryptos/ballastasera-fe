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
  welcomePage: true,
  menuPage: true,
  oauth2Callback: true,
  googleAuth: true,
  pendingOrganizersPage: true,
};

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  featureFlags,
  // Free key from https://carto.com/basemaps/apikey/ — 5M tile requests/month fair-use limit.
  cartoApiKey: 'cb1_3ie6_1_e078712b029a513ed802a563',
};
