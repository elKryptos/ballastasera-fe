import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { environment } from './environments/environment';
import { sitemapResponse } from './sitemap';

const angularApp = new AngularAppEngine({
	// It is safe to set allow `localhost`, so that SSR can run in local development,
	// as, in production, Cloudflare will ensure that `localhost` is not the host.
	allowedHosts: ['localhost', 'ballastasera.com', 'ballastasera.it', 'ballastasera-fe-staging.kryptospace.workers.dev'],
});

const CANONICAL_HOST = 'ballastasera.it';

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler(async (req) => {
	// ballastasera.com used to serve the same content as .it with no redirect,
	// so Google was free to (and did) pick .com as the canonical over our tag,
	// leaving the real .it homepage excluded from the index. A real 301 fixes
	// that ambiguity — there is now exactly one indexable origin.
	// Production build only: the staging worker (workers.dev) must serve its own
	// pages, or /oauth2/callback would bounce the login token to the live site.
	// Plain http goes to https too: a link typed without it (an Instagram bio)
	// opened the site over http, where the browser refuses the visitor's
	// position and the API, which only answers https://ballastasera.it, refuses
	// every request — the pages came up empty. This covers what the worker
	// serves; the prerendered home and the static files never reach it, which
	// is what Cloudflare's "Always Use HTTPS" is for.
	const url = new URL(req.url);
	const insecure = url.protocol === 'http:';
	if (environment.production && url.hostname !== 'localhost' && (url.hostname !== CANONICAL_HOST || insecure)) {
		url.hostname = CANONICAL_HOST;
		url.protocol = 'https:';
		return Response.redirect(url.toString(), 301);
	}

	// Written on request, with the venues and the events of the moment — see
	// sitemap.ts. There's no sitemap.xml among the static assets, or Cloudflare
	// would serve that one without ever getting here.
	if (url.pathname === '/sitemap.xml') return sitemapResponse(`https://${CANONICAL_HOST}`);

	const res = await angularApp.handle(req);

	return res ?? new Response('Page not found.', { status: 404 });
});

export default { fetch: reqHandler };