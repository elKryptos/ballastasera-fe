import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserDto } from '../models/user.model';
import { TokenStorageService } from './token-storage.service';
import { endpoints } from '../api/endpoints';
import { Router } from '@angular/router';

/**
 * Session state, backed by the JWT the backend hands out after Google OAuth2
 * (see OAuth2LoginSuccessHandler) and read here from localStorage.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly currentUserSignal = signal<UserDto | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  /** Sends the browser to Google's consent screen; the backend redirects back to /oauth2/callback. */
  loginWithGoogle(): void {
    if (!this.isBrowser) return;
    window.location.href = `${environment.apiUrl}${endpoints.auth.googleLogin}`;
  }

  /** Called once by the /oauth2/callback route after it extracts ?token= from the redirect. */
  setToken(token: string): void {
    this.tokenStorage.set(token);
  }

  /** Loads /rest/auth/me with whatever token is stored — call on app start to restore a session. */
  restoreSession() {
    if (!this.tokenStorage.get()) {
      this.currentUserSignal.set(null);
      return of(null);
    }

    return this.http.get<UserDto>(`${environment.apiUrl}${endpoints.auth.me}`).pipe(
      tap((user) => this.currentUserSignal.set(user)),
      catchError(() => {
        this.tokenStorage.clear();
        this.currentUserSignal.set(null);
        return of(null);
      }),
    );
  }

  logout() {
    return this.http.post<void>(`${environment.apiUrl}${endpoints.auth.logout}`, {}).pipe(
      catchError(() => of(void 0)),
      tap(() => {
        this.tokenStorage.clear();
        this.currentUserSignal.set(null);
        this.router.navigateByUrl('');
      }),
    );
  }
}
