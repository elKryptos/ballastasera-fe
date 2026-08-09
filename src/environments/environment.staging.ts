/**
 * Staging environment — deployed behind Cloudflare Access, never linked
 * publicly. Turn a flag on here first to see it live before it goes to prod.
 */
export const environment = {
  production: false,
  featureFlags: {} as Record<string, boolean>,
};
