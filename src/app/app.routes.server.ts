import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Prerendering bakes a route's HTML into a static file at build time,
  // bypassing canMatch entirely — the file would sit in dist/browser and be
  // reachable by direct URL no matter what the flag says. Only prerender
  // routes that are meant to be public. Everything else (including
  // flag-gated routes) renders per-request on the server, where canMatch
  // actually runs.
  { path: '', renderMode: RenderMode.Prerender },
  // Reads ?token= from the OAuth2 redirect and writes it to localStorage —
  // needs the browser, so it must never run through SSR (which has no
  // localStorage and would silently drop the token before the client sees it).
  { path: 'oauth2/callback', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
