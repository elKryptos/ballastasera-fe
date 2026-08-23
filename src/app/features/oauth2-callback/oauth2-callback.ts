import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Landing spot for the backend's post-Google redirect (see
 * OAuth2LoginSuccessHandler, which appends `?token=<jwt>`). Stores the token,
 * refreshes the session, then sends the visitor back to the map.
 */
@Component({
  selector: 'app-oauth2-callback',
  template: `<p class="oauth2-callback">Accesso in corso…</p>`,
})
export class Oauth2Callback implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.router.navigateByUrl('/');
      return;
    }

    this.auth.setToken(token);
    this.auth.restoreSession().subscribe({
      complete: () => this.router.navigateByUrl('/'),
    });
  }
}
