/**
 * Single source of truth for feature-flag names. Add a key here first, then
 * set it in every src/environments/environment*.ts — TypeScript will error
 * on any environment file that's missing one.
 */
export const FEATURE_FLAGS = {
  /** Redesigned navbar + Google sign-in dialog — see auth-modal. */
  navbarAuth: 'navbarAuth',
  mapPage: 'mapPage',
  /** /lista route: the map's events as a list, grouped by night. */
  eventListPage: 'eventListPage',
  welcomePage: 'welcomePage',
  menuPage: 'menuPage',
  /** /oauth2/callback route, landed on after Google confirms login. */
  oauth2Callback: 'oauth2Callback',
  /** Google button in auth-modal does a real backend redirect instead of the waiting-list message. */
  googleAuth: 'googleAuth',
  /** /staging-demo route. Delete this flag once staging-demo is deleted. */
  stagingDemo: 'stagingDemo',
  /** /admin route, hub with links to the admin pages below (also gated on the ADMIN role). */
  adminHomePage: 'adminHomePage',
  /** /admin/create-unclaimed-organizer route (also gated on the ADMIN role). */
  createUnclaimedOrganizerPage: 'createUnclaimedOrganizerPage',
  /** /admin/pending-organizers route (also gated on the ADMIN role). */
  pendingOrganizersPage: 'pendingOrganizersPage',
  /** /admin/verified-organizers route (also gated on the ADMIN role). */
  verifiedOrganizersPage: 'verifiedOrganizersPage',
  /** /admin/update-organizer route (also gated on the ADMIN role). */
  updateOrganizerPage: 'updateOrganizerPage',
  /** /admin/create-event route (also gated on the ADMIN role). */
  createEventPage: 'createEventPage',
  eventDetailsPage: 'eventDetailsPage',
  createEventSeries: 'createEventSeries',
  createVenuePage: 'createVenuePage',
  /** /admin/venues-list route: venues by city, newest first, with edit and delete (also gated on the ADMIN role). */
  venueListPage: 'venueListPage',
  /** /admin/update-venue/:id route (also gated on the ADMIN role). */
  updateVenuePage: 'updateVenuePage',
  /** /luogo/:id route: a venue's page, opened from its card on the map. */
  venueDetailsPage: 'venueDetailsPage',
  /** /impara-a-ballare route: the salsa and bachata lesson. Static, no backend. */
  learnToDancePage: 'learnToDancePage',
  /** /scuole route: the list of dance schools, linked from the lesson buttons. */
  schoolListPage: 'schoolListPage',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
