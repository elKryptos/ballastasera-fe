import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

const angularApp = new AngularAppEngine({
	// It is safe to set allow `localhost`, so that SSR can run in local development,
	// as, in production, Cloudflare will ensure that `localhost` is not the host.
	allowedHosts: ['localhost', 'ballastasera.com', 'ballastasera.it'],
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
	const url = new URL(req.url);
	if (url.hostname !== CANONICAL_HOST && url.hostname !== 'localhost') {
		url.hostname = CANONICAL_HOST;
		return Response.redirect(url.toString(), 301);
	}

	const res = await angularApp.handle(req);

	return res ?? new Response('Page not found.', { status: 404 });
});

export default { fetch: reqHandler };