/**
 * Default (production) environment — this is what ships to the public site.
 * A feature only reaches visitors once its flag flips to true here.
 */
export const environment = {
  production: true,
  featureFlags: {
    navbarAuth: true
  } as Record<string, boolean>,
};
