import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Prerendering bakes a route's HTML into a static file at build time,
  // bypassing canMatch entirely — the file would sit in dist/browser and be
  // reachable by direct URL no matter what the flag says. Only prerender
  // routes that are meant to be public. Everything else (including
  // flag-gated routes) renders per-request on the server, where canMatch
  // actually runs.
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
