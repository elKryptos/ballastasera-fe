/**
 * Single source of truth for feature-flag names. Add a key here first, then
 * set it in every src/environments/environment*.ts — TypeScript will error
 * on any environment file that's missing one.
 */
export const FEATURE_FLAGS = {
  /** Redesigned navbar + login/signup dialog — see auth-modal. */
  navbarAuth: 'navbarAuth',
  mapPage: 'mapPage',
  welcomePage: 'welcomePage',
  menuPage: 'menuPage',
  /** /oauth2/callback route, landed on after Google confirms login. */
  oauth2Callback: 'oauth2Callback',
  /** Google button in auth-modal does a real backend redirect instead of the waiting-list message. */
  googleAuth: 'googleAuth',
  /** /staging-demo route. Delete this flag once staging-demo is deleted. */
  stagingDemo: 'stagingDemo',
  /** /admin/pending-organizers route (also gated on the ADMIN role). */
  pendingOrganizersPage: 'pendingOrganizersPage',
  /** /admin route, hub with links to the admin pages below (also gated on the ADMIN role). */
  adminHomePage: 'adminHomePage',
  /** /admin/create-unclaimed-organizer route (also gated on the ADMIN role). */
  createUnclaimedOrganizerPage: 'createUnclaimedOrganizerPage',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
