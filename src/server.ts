import { AngularAppEngine, RenderMode, createRequestHandler } from '@angular/ssr';
import { getActiveConsumer, setActiveConsumer } from '@angular/core/primitives/signals';
import { environment } from './environments/environment';
import { serverRoutes } from './app/app.routes.server';
import { sitemapResponse } from './sitemap';

const angularApp = new AngularAppEngine({
	// It is safe to set allow `localhost`, so that SSR can run in local development,
	// as, in production, Cloudflare will ensure that `localhost` is not the host.
	allowedHosts: ['localhost', 'ballastasera.com', 'ballastasera.it', 'ballastasera-fe-staging.kryptospace.workers.dev'],
});

const CANONICAL_HOST = 'ballastasera.it';

/** The worker's bindings (wrangler.jsonc): the static files of dist/browser. */
interface Env {
	ASSETS: { fetch(request: Request | string | URL): Promise<Response> };
}

/**
 * Server renders failed in a row in this isolate. Past BROKEN_AFTER its pages
 * are served as the client-side app (index.csr.html) until Cloudflare
 * recycles it; a page that fails before that is served the same, alone.
 *
 * A render costs ~20-40 ms of CPU, a first one in a new isolate a few
 * hundred: well past the Free plan's 10 ms, which Cloudflare enforces now
 * and then by stopping the worker mid-render. Its `finally` blocks never
 * run, and Angular's state shared by every request of the isolate stays as
 * that render left it — a component's injector factory marked as being
 * resolved, so every render after it throws NG0200 (circular dependency).
 * Angular takes that for a failed navigation and answers null, and every
 * page of the isolate came out as "Page not found." with a 404, for visitors
 * and Google alike. The client-side app has none of that state: the page
 * works, it's just not rendered in advance.
 *
 * In a row, because a single failure can be that page's own (an event whose
 * data breaks its template): a broken isolate fails every render, a render
 * that works resets the count.
 */
let failedRenders = 0;
const BROKEN_AFTER = 3;

/** The pages rendered on the server: the Server routes of
 * app.routes.server.ts ("evento/:id" matches /evento/<anything>). */
const SSR_PATHS = serverRoutes
	.filter((route) => route.renderMode === RenderMode.Server)
	.map((route) => new RegExp(`^/${route.path.split('/').map((part) => (part.startsWith(':') ? '[^/]+' : part)).join('/')}/?$`));

function isSsrPath(pathname: string): boolean {
	return SSR_PATHS.some((path) => path.test(pathname));
}

/** A page, as opposed to a file (favicon.ico, a .well-known path): the
 * routes end on `**`, so for a page Angular always answers — a null means
 * the render failed. */
function isPage(req: Request, url: URL): boolean {
	return (req.method === 'GET' || req.method === 'HEAD') && !/\.[a-z0-9]+$/i.test(url.pathname);
}

/**
 * Every request the worker gets. csrShell serves the client-side app — the
 * worker only: the dev server has no ASSETS, and answers 404 as it always did.
 */
async function handle(req: Request, csrShell: ((url: URL) => Promise<Response>) | null): Promise<Response> {
	// A worker's isolate serves request after request, and Angular keeps the
	// reactive context it's evaluating in (a computed, a template) in one
	// module-wide variable. Between two requests there's never one; one left
	// over all the same made every request after it fail on its first signal
	// write (NG0600, in restoreSession) until the isolate was recycled: the
	// "Error 1101" half the links from Instagram opened on.
	if (getActiveConsumer()) {
		console.warn('An Angular reactive context was left over from an earlier request: cleared.');
		setActiveConsumer(null);
	}

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
	// serves; the prerendered pages and the static files never reach it, which
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

	// A page not rendered on the server is the client-side app as it is
	// (app.routes.server.ts): no need to load Angular here for that, nor to
	// spend the CPU it takes. Likewise every page, once the isolate is broken.
	const page = csrShell !== null && isPage(req, url);
	if (page && (failedRenders >= BROKEN_AFTER || !isSsrPath(url.pathname))) return csrShell(url);

	let res: Response | null = null;
	try {
		res = await angularApp.handle(req);
	} catch (error) {
		// A visitor who left (closed the tab, followed another link) aborts
		// the render: nothing wrong with the isolate, and nobody to answer.
		if (!page || req.signal.aborted) throw error;
		console.error('Server render threw:', error);
	}
	if (res) {
		if (page) failedRenders = 0;
		return res;
	}

	if (page) {
		failedRenders++;
		console.error(
			failedRenders >= BROKEN_AFTER
				? `Server render failed for ${url.pathname}, ${failedRenders} in a row: this isolate serves the client-side app from now on.`
				: `Server render failed for ${url.pathname}: served as the client-side app.`,
		);
		return csrShell(url);
	}
	return new Response('Page not found.', { status: 404 });
}

/**
 * The client-side app for the page at url. index.csr.html carries the home's
 * canonical URL and og:url, which would tell Google (and a link preview) that
 * this page is the home; they're made this page's own, as SeoService does
 * once the app runs. Only those two tags: the JSON-LD names the home too, and
 * means it.
 */
async function csrPage(env: Env, url: URL): Promise<Response> {
	// /index.csr rather than /index.csr.html: the assets' html_handling
	// (wrangler.jsonc) answers a .html path with a redirect to it.
	const shell = await env.ASSETS.fetch(new URL('/index.csr', url));
	if (!shell.ok) return shell;
	const home = `https://${CANONICAL_HOST}/`;
	const own = `https://${CANONICAL_HOST}${url.pathname}`;
	const html = (await shell.text())
		.replace(`<link rel="canonical" href="${home}">`, `<link rel="canonical" href="${own}">`)
		.replace(`<meta property="og:url" content="${home}">`, `<meta property="og:url" content="${own}">`);
	// The body changed: the shell's own length and ETag no longer describe it.
	const headers = new Headers(shell.headers);
	headers.delete('content-length');
	headers.delete('etag');
	return new Response(html, { status: 200, headers });
}

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler((req) => handle(req, null));

export default {
	fetch: (req: Request, env: Env) => handle(req, (url) => csrPage(env, url)),
};
