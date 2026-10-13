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
  googleAuth: true,
  mapPage: true,
  eventListPage: true,
  welcomePage: true,
  menuPage: true,
  oauth2Callback: true,
  stagingDemo: false,
  adminHomePage: true,
  createUnclaimedOrganizerPage: true,
  verifiedOrganizersPage: true,
  pendingOrganizersPage: true,
  updateOrganizerPage: true,
  createEventPage: true,
  eventDetailsPage: true,
  createEventSeries: true,
  createVenuePage: true,
  venueListPage: true,
  updateVenuePage: true,
  venueDetailsPage: true,
  learnToDancePage: true,
  schoolListPage: true,
  socialPostsPage: true,
};

export const environment = {
  production: true,
  // TODO: point at the real API host once the backend has a public prod URL.
  apiUrl: 'https://api.ballastasera.it',
  // apiUrl: 'http://localhost:8080',
  featureFlags,
  // Free key from https://carto.com/basemaps/apikey/ — 5M tile requests/month fair-use limit.
  cartoApiKey: 'cb1_3ie6_1_e078712b029a513ed802a563',
};
