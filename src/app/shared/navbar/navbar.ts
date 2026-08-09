import { Component, signal } from '@angular/core';
import { AuthMode, AuthModal } from '../auth-modal/auth-modal';

/**
 * Site header: brand mark + name, an optional projected badge (e.g. the
 * "Work in progress" pill on the landing page), and the account entry point.
 * Owns the auth dialog itself, so any page just drops in `<app-navbar>`.
 */
@Component({
  selector: 'app-navbar',
  imports: [AuthModal],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  protected readonly authOpen = signal(false);
  protected readonly authMode = signal<AuthMode>('login');

  protected openAuth(mode: AuthMode): void {
    this.authMode.set(mode);
    this.authOpen.set(true);
  }
}
