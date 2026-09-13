import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';

/**
 * Landing spot for the backend's post-Google redirect (see
 * OAuth2LoginSuccessHandler, which appends `?token=<jwt>`). Stores the token,
 * refreshes the session, then sends first-time visitors to the welcome page
 * and everyone else straight to the menu — the map is no longer a post-login
 * redirect target, it's reached from the menu or the welcome page's own CTA.
 */
@Component({
  selector: 'app-oauth2-callback',
  templateUrl: './oauth2-callback.html',
  styleUrl: './oauth2-callback.css',
})
export class Oauth2Callback implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly featureFlags = inject(FeatureFlagService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.router.navigateByUrl('/');
      return;
    }

    this.auth.setToken(token);
    this.auth.restoreSession().subscribe({
      complete: () => this.router.navigateByUrl(this.postLoginUrl()),
    });
  }

  private postLoginUrl(): string {
    if (!this.featureFlags.isEnabled(FEATURE_FLAGS.welcomePage)) {
      return '/';
    }

    // `hasSeenWelcome` doesn't exist on the backend yet (see UserDto), so
    // this is always falsy for now and every login lands on /benvenuto —
    // that's fine while the page is still being reviewed. Once the backend
    // sends the field (and Welcome.enter() marks it seen via a PATCH), this
    // starts sending returning users straight to /menu, unchanged.
    const hasSeenWelcome = this.auth.currentUser()?.hasSeenWelcome ?? false;
    return hasSeenWelcome ? '/menu' : '/benvenuto';
  }
}
