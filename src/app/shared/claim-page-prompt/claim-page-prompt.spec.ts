import { PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { AuthModal } from '../auth-modal/auth-modal';
import { ClaimPagePrompt } from './claim-page-prompt';

describe('ClaimPagePrompt', () => {
  let fixture: ComponentFixture<ClaimPagePrompt>;
  const currentUser = signal<{ role: string } | null>(null);

  const host = () => fixture.nativeElement as HTMLElement;
  const button = () => host().querySelector('button');
  const authModal = () => fixture.debugElement.query(By.directive(AuthModal))?.componentInstance as AuthModal | undefined;

  const setup = async (platform = 'browser') => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: AuthService, useValue: { currentUser, isAuthenticated: () => currentUser() !== null } },
      ],
    });
    fixture = TestBed.createComponent(ClaimPagePrompt);
    fixture.componentRef.setInput('name', 'Salsa Loca');
    fixture.componentRef.setInput('slug', 'salsa-loca');
    await fixture.whenStable();
  };

  beforeEach(() => {
    currentUser.set(null);
    // jsdom has no matchMedia: the login dialog asks it on opening (focus, reduced motion).
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('asks a visitor whether the page is theirs', async () => {
    await setup();
    expect(host().textContent).toContain('È la tua pagina?');
    expect(host().textContent).toContain('Rivendica Salsa Loca');
    expect(button()?.textContent?.trim()).toBe('Rivendica la pagina');
  });

  it.each(['ORGANIZER', 'ADMIN'])('says nothing to an %s, who already has a page', async (role) => {
    currentUser.set({ role });
    await setup();
    // Empty, so empty:hidden drops it with the parent's border and gap.
    expect(host().children.length).toBe(0);
  });

  // Signed out there, it would render for everyone and flash for an organizer until hydration.
  it('is not rendered on the server', async () => {
    await setup('server');
    expect(host().children.length).toBe(0);
  });

  it('asks a visitor to sign in first, coming back to the steps with the page picked', async () => {
    await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    button()?.click();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    expect(authModal()?.open()).toBe(true);
    expect(authModal()?.returnUrl()).toBe('/diventa-organizzatore/chi-sei?rivendica=salsa-loca');
    expect(authModal()?.text()).toContain('Salsa Loca');
  });

  it('takes a signed-in user straight to the steps with the page picked', async () => {
    currentUser.set({ role: 'USER' });
    await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    button()?.click();

    expect(navigate).toHaveBeenCalledWith('/diventa-organizzatore/chi-sei?rivendica=salsa-loca');
    expect(authModal()?.open()).toBe(false);
  });
});
