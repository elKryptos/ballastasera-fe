import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Rendered on the server only where it's worth its CPU: the pages that are
 * shared and found by their own content. A server render costs ~20-40 ms of
 * CPU on the worker, against the Workers Free plan's 10 ms (see failedRenders
 * in server.ts), so every other page is either baked at build time or left to
 * the browser. server.ts reads the Server routes from here: the worker
 * serves every other page as the client-side app without loading Angular.
 */
export const serverRoutes: ServerRoute[] = [
  // Prerendering bakes a route's HTML into a static file at build time,
  // bypassing canMatch entirely — the file would sit in dist/browser and be
  // reachable by direct URL no matter what the flag says. Only prerender
  // routes that are meant to be public, and whose content lives in the
  // build: no backend call, so the baked page never goes stale.
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'impara-a-ballare', renderMode: RenderMode.Prerender },
  { path: 'playlist', renderMode: RenderMode.Prerender },

  // An event's and a venue's page: what gets shared (WhatsApp, Instagram —
  // whose link previews read the HTML and never run the app) and what Google
  // indexes one by one.
  { path: 'evento/:id', renderMode: RenderMode.Server },
  { path: 'luogo/:id', renderMode: RenderMode.Server },

  // Everything else, in the browser: /lista, /mappa, /menu and /scuole change
  // with the API's data and nobody shares them for it; the map only exists in
  // the browser anyway. The rest needs the browser regardless —
  // oauth2/callback reads ?token= into localStorage; the admin pages and
  // le-tue-serate are behind roleGuard, whose JWT lives in localStorage (on
  // the server a signed-in user looks signed out); benvenuto greets the user
  // who just signed in.
  { path: '**', renderMode: RenderMode.Client },
];
