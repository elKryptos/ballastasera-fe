import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, DetachedRouteHandle, Route } from '@angular/router';

/** Optional hooks for the component of a keep-alive route, called by App's
 * router outlet (see app.html) when the page is put away and brought back —
 * it gets no ngOnDestroy/ngOnInit in between, so this is where it pauses its
 * timers and resyncs whatever may have changed while it was off screen. */
export interface KeepAliveHooks {
  onRouteDetached?(): void;
  onRouteAttached?(): void;
}

/**
 * Routes flagged `data: { keepAlive: true }` are detached instead of destroyed
 * when navigated away from, and reattached as they were on return. For /mappa:
 * rebuilding it meant a new Leaflet map and a new MapLibre instance (WebGL
 * context, style, tiles), with an empty map showing until the basemap had
 * drawn again. Every other route keeps Angular's default behaviour.
 * Handles are kept for the whole session, one per route — for /mappa that's
 * one WebGL context staying alive while the visitor is on other pages.
 */
export class KeepAliveReuseStrategy extends BaseRouteReuseStrategy {
  private readonly handles = new Map<Route, DetachedRouteHandle>();

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return route.routeConfig?.data?.['keepAlive'] === true;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (!route.routeConfig) return;
    if (handle) {
      this.handles.set(route.routeConfig, handle);
    } else {
      this.handles.delete(route.routeConfig);
    }
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return !!route.routeConfig && this.handles.has(route.routeConfig);
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return (route.routeConfig && this.handles.get(route.routeConfig)) ?? null;
  }
}
