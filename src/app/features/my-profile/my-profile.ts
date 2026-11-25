import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ATTENDANCE_VISIBILITY_LABELS,
  PRIVATE_PROFILE_LABEL,
  WHATSAPP_VISIBILITY_LABELS,
} from '../../core/config/social';
import { UserDto } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { ownProfileView, profileSteps } from '../../core/utils/profile-view';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { ProfileContacts } from '../../shared/profile/profile-contacts/profile-contacts';
import { ProfileHero } from '../../shared/profile/profile-hero/profile-hero';
import { ProfileLayout } from '../../shared/profile/profile-layout/profile-layout';
import { ProfileMilestones } from '../../shared/profile/profile-milestones/profile-milestones';
import { ProfileSchool } from '../../shared/profile/profile-school/profile-school';
import { ProfileSection } from '../../shared/profile/profile-section/profile-section';
import { ProfileStyles } from '../../shared/profile/profile-styles/profile-styles';
import { MyUpcomingNights } from './my-upcoming-nights/my-upcoming-nights';
import { ShareSheet } from './share-sheet/share-sheet';
import { TablistDirective } from '../../shared/directives/tablist.directive';

type ProfileTab = 'own' | 'public';

/** "Le vedono tutti": who sees the nights one goes to, said under "Prossime serate". */
const NIGHTS_SEEN_BY: Record<UserDto['attendanceVisibility'], string> = {
  EVERYONE: 'Le vedono tutti',
  MUTUALS: 'Le vedono gli amici',
  NOBODY: 'Le vedi solo tu',
};

/**
 * "Il tuo profilo" (canvas 4, docs/social-fe.md): the user's own page, opened from the menu's profile
 * card. "Il tuo profilo": who they are, "Modifica profilo" and "Condividi" (the stories' card), what's
 * missing to complete it, what they dance, their next nights with the friends going, their milestones,
 * school, who sees what, and "Esci". "Come ti vedono": the same profile the way the others see it, its
 * buttons inert. Everything comes from the session's user, asked again on the way in for fresh numbers.
 */
@Component({
  selector: 'app-my-profile',
  imports: [
    RouterLink,
    SidebarPushDirective,
    ProfileContacts,
    ProfileHero,
    ProfileLayout,
    ProfileMilestones,
    ProfileSchool,
    ProfileSection,
    ProfileStyles,
    MyUpcomingNights,
    ShareSheet,
    TablistDirective,
  ],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.css',
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
})
export class MyProfile {
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.currentUser;
  protected readonly tab = signal<ProfileTab>('own');
  protected readonly shareOpen = signal(false);
  /** The page's clock, for "OGGI". */
  protected readonly now = signal(Date.now());

  protected readonly view = computed(() => {
    const user = this.user();
    return user ? ownProfileView(user) : null;
  });

  protected readonly steps = computed(() => {
    const user = this.user();
    return user ? profileSteps(user) : [];
  });
  protected readonly stepsDone = computed(() => this.steps().filter((step) => step.done));
  protected readonly stepsMissing = computed(() => this.steps().filter((step) => !step.done));
  protected readonly stepsDoneText = computed(() => this.stepsDone().map((step) => step.doneLabel).join(', '));

  protected readonly nightsSeenBy = computed(() => NIGHTS_SEEN_BY[this.user()?.attendanceVisibility ?? 'EVERYONE']);

  /** "Chi vede cosa": each setting as it is, all changed in "Modifica profilo". */
  protected readonly privacy = computed(() => {
    const user = this.user();
    if (!user) return [];
    return [
      { label: 'Profilo', value: user.showProfilePublic ? 'Visibile' : PRIVATE_PROFILE_LABEL },
      {
        label: 'WhatsApp',
        value: user.whatsapp ? WHATSAPP_VISIBILITY_LABELS[user.whatsappVisibility ?? 'MUTUALS'] : 'Nessun numero',
      },
      { label: 'Serate a cui vai', value: ATTENDANCE_VISIBILITY_LABELS[user.attendanceVisibility ?? 'EVERYONE'] },
    ];
  });

  /** In "Come ti vedono": WhatsApp for friends only, said with a lock as the others see it. */
  protected readonly previewWhatsappLock = computed(() => {
    const user = this.user();
    return user?.whatsapp && user.whatsappVisibility === 'MUTUALS' ? 'Lo vede solo chi vi seguite a vicenda.' : null;
  });

  protected readonly memberSince = computed(() => {
    const since = this.user()?.memberSince;
    return since ? new Date(since).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : null;
  });

  constructor() {
    // Fresh numbers (followers, nights) and fields: the stored user may be from another day.
    this.auth.restoreSession().subscribe();
    const clock = isPlatformBrowser(inject(PLATFORM_ID)) ? setInterval(() => this.now.set(Date.now()), 60_000) : undefined;
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  protected logout(): void {
    this.auth.logout().subscribe();
  }
}
