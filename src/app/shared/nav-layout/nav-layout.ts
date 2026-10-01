import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeepAliveHooks } from '../../core/routing/keep-alive-reuse.strategy';
import { Navbar } from '../navbar/navbar';

/**
 * Parent route of every page with the site navigation (see app.routes.ts):
 * one <app-navbar> for all of them, kept as it is while moving between them
 * instead of being torn down and rebuilt with each page — what used to make
 * the sidebar blink on every route change.
 */
@Component({
  selector: 'app-nav-layout',
  imports: [Navbar, RouterOutlet],
  template: `
    <app-navbar />
    <router-outlet (attach)="routeAttached($event)" (detach)="routeDetached($event)" />
  `,
  // Adds no box of its own: the navbar and the page lay out as if they sat
  // straight in <app-root>, same as when each page carried its own navbar.
  styles: ':host { display: contents; }',
})
export class NavLayout {
  /** The outlet's attach/detach only fire for keep-alive routes (see
   * KeepAliveReuseStrategy) — forwarded to the page, which otherwise has no
   * way to tell it just went off or back on screen. */
  protected routeAttached(component: unknown): void {
    (component as KeepAliveHooks).onRouteAttached?.();
  }

  protected routeDetached(component: unknown): void {
    (component as KeepAliveHooks).onRouteDetached?.();
  }
}
