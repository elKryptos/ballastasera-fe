import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { INVITE_PRIVATE_TEXT } from '../../core/config/social';
import { SocialRelation } from '../../core/models/social.model';
import { UserProfileDto } from '../../core/models/user.model';
import { injectGoBack } from '../../core/routing/go-back';
import { AuthService } from '../../core/services/auth.service';
import { FollowsService } from '../../core/services/follows.service';
import { SeoService } from '../../core/services/seo.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';
import { apiErrorStatus } from '../../core/utils/api-errors';
import { waMeUrl } from '../../core/utils/event-format';
import { firstNameOf } from '../../core/utils/initials';
import { injectPageShare } from '../../core/utils/page-share';
import { personPath, profileShareUrl } from '../../core/utils/person-links';
import { inCommon, sharedStyleIds } from '../../core/utils/profile-view';
import { followsMe, iFollow, isFriend } from '../../core/utils/relation';
import { AuthModal } from '../../shared/auth-modal/auth-modal';
import { ConfirmSheet } from '../../shared/confirm-sheet/confirm-sheet';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { FollowButton, FollowTarget } from '../../shared/follow-button/follow-button';
import { ProfileContacts } from '../../shared/profile/profile-contacts/profile-contacts';
import { ProfileHero } from '../../shared/profile/profile-hero/profile-hero';
import { ProfileLayout } from '../../shared/profile/profile-layout/profile-layout';
import { ProfileMilestones } from '../../shared/profile/profile-milestones/profile-milestones';
import { ProfileSchool } from '../../shared/profile/profile-school/profile-school';
import { ProfileSection } from '../../shared/profile/profile-section/profile-section';
import { ProfileStyles } from '../../shared/profile/profile-styles/profile-styles';
import { InCommon } from './in-common/in-common';
import { InviteToNightSheet } from './invite-to-night-sheet/invite-to-night-sheet';
import { PersonAction, PersonMenu } from './person-menu/person-menu';
import { PersonNights } from './person-nights/person-nights';
import { ReportResult, ReportSheet } from './report-sheet/report-sheet';

type PageState = 'signed-out' | 'loading' | 'ready' | 'gone' | 'error' | 'blocked';

/** Which profile the URL names: /persona/{id} or /@{username}. */
interface ProfileKey {
  id: string | null;
  username: string | null;
}

/** "Sabato 15 novembre" → "15 novembre", for "L'ultima: Noche Latina, 15 novembre". */
function dayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

/**
 * Someone's page (canvas 4c, docs/social-fe.md): /persona/{id}, and /@{username} to share. Who
 * they are, Segui / Ricambia / Amici, WhatsApp once friends, what the two have in common, what they
 * dance, their next nights (with the viewer's own "Ci vado"), their milestones, school and contacts;
 * the ⋯ menu copies the link, mutes, reports and blocks. Profiles are for signed-in users: signed
 * out, the page asks to sign in and comes back here (someone opening a link from a story). A
 * profile that's private, blocked or gone answers 404, all alike: "Profilo non disponibile". One's
 * own goes to "Il tuo profilo". A phone stacks it all; from @4xl who they are stays on the left.
 */
@Component({
  selector: 'app-person',
  imports: [
    RouterLink,
    AuthModal,
    ConfirmSheet,
    SidebarPushDirective,
    FollowButton,
    ProfileContacts,
    ProfileHero,
    ProfileLayout,
    ProfileMilestones,
    ProfileSchool,
    ProfileSection,
    ProfileStyles,
    InCommon,
    InviteToNightSheet,
    PersonMenu,
    PersonNights,
    ReportSheet,
  ],
  templateUrl: './person.html',
  styleUrl: './person.css',
  host: { class: 'block min-h-dvh bg-ground text-(--ev-text)' },
})
export class PersonPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly follows = inject(FollowsService);
  private readonly toasts = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly pageShare = injectPageShare();

  protected readonly goBack = injectGoBack('/amici');

  private readonly key = toSignal(
    this.route.paramMap.pipe(map((params): ProfileKey => ({ id: params.get('id'), username: params.get('username') }))),
    { requireSync: true },
  );

  protected readonly state = signal<PageState>('loading');
  protected readonly profile = signal<UserProfileDto | null>(null);
  /** Follows the profile, and the button's taps since. */
  protected readonly relation = linkedSignal<SocialRelation>(() => this.profile()?.relation ?? 'NONE');
  protected readonly muted = linkedSignal(() => this.profile()?.muted ?? false);

  protected readonly authOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly reportOpen = signal(false);
  protected readonly blockOpen = signal(false);
  protected readonly inviteOpen = signal(false);
  /** The viewer's own profile is private: they can't invite (social-plan.md §3). */
  protected readonly myProfilePrivate = computed(() => this.auth.currentUser()?.showProfilePublic === false);
  protected readonly invitePrivateText = INVITE_PRIVATE_TEXT;
  protected readonly blocking = signal(false);
  /** Where the login comes back to: this very page. */
  protected readonly returnUrl = signal(this.router.url);

  /** The page's clock, for the nights' "OGGI". */
  protected readonly now = signal(Date.now());

  protected readonly firstName = computed(() => firstNameOf(this.profile()?.displayName));
  protected readonly friends = computed(() => isFriend(this.relation()));
  protected readonly followTarget = computed<FollowTarget | null>(() => {
    const profile = this.profile();
    return profile ? { ...profile, relation: this.relation(), profilePublic: true } : null;
  });

  protected readonly sharedStyles = computed(() => {
    const profile = this.profile();
    return profile ? sharedStyleIds(this.auth.currentUser()?.danceStyles, profile.danceStyles) : new Set<number>();
  });

  protected readonly inCommon = computed(() => {
    const profile = this.profile();
    const me = this.auth.currentUser();
    return profile && me ? inCommon(me, { ...profile, relation: this.relation() }, dayMonth) : [];
  });

  /** WhatsApp, when they show it to the viewer: the green button next to "Segui". */
  protected readonly whatsappUrl = computed(() => waMeUrl(this.profile()?.whatsapp));

  /** Why WhatsApp is locked, said on the locked button and in "Contatti". Whether they gave a
   * number at all isn't known (hidden and missing both come as null): it says how it'd unlock. */
  protected readonly whatsappLock = computed(() => {
    const relation = this.relation();
    if (isFriend(relation)) return null;
    if (iFollow(relation)) return `Se lo condivide, si sblocca quando anche ${this.firstName()} ti segue.`;
    if (followsMe(relation)) return `${this.firstName()} ti segue: ricambia e, se lo condivide, potete scrivervi.`;
    return 'Se lo condivide, si sblocca quando vi seguite a vicenda.';
  });

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const clock = isBrowser ? setInterval(() => this.now.set(Date.now()), 60_000) : undefined;
    inject(DestroyRef).onDestroy(() => clearInterval(clock));

    // The profile follows the URL and the session: signing in from this page loads it.
    effect(() => {
      const key = this.key();
      const signedIn = this.auth.isAuthenticated();
      untracked(() => {
        this.returnUrl.set(this.router.url);
        if (!signedIn) this.state.set('signed-out');
        else if (isBrowser) this.load(key);
      });
    });
  }

  protected retry(): void {
    this.load(this.key());
  }

  protected openSignIn(): void {
    this.authOpen.set(true);
  }

  protected relationChanged(relation: SocialRelation): void {
    this.relation.set(relation);
    // Unfollowing loses the mute, as the backend does.
    if (!iFollow(relation)) this.muted.set(false);
  }

  protected share(): void {
    const profile = this.profile();
    if (profile) void this.pageShare.share(profile.displayName, profileShareUrl(profile.userId, profile.username));
  }

  protected whatsappLocked(): void {
    const lock = this.whatsappLock();
    if (lock) this.toasts.show(lock);
  }

  protected onMenu(action: PersonAction): void {
    const profile = this.profile();
    if (!profile) return;
    switch (action) {
      case 'copy-link':
        this.copyLink(profile);
        break;
      case 'mute':
        this.toggleMute(profile);
        break;
      case 'report':
        this.reportOpen.set(true);
        break;
      case 'block':
        this.blockOpen.set(true);
        break;
    }
  }

  protected invited(): void {
    this.toasts.show(`Invito mandato a ${this.firstName()}.`);
  }

  protected reported(result: ReportResult): void {
    this.toasts.show('Segnalazione inviata. Grazie: la controlliamo noi.');
    if (result.blocked) this.state.set('blocked');
  }

  protected block(): void {
    const profile = this.profile();
    if (!profile || this.blocking()) return;
    this.blocking.set(true);
    this.follows.block(profile.userId).subscribe({
      complete: () => {
        this.blocking.set(false);
        this.blockOpen.set(false);
        this.state.set('blocked');
        this.toasts.show(`Hai bloccato ${this.firstName()}.`);
      },
      error: () => {
        this.blocking.set(false);
        this.toasts.show('Non siamo riusciti a bloccare. Riprova tra poco.');
      },
    });
  }

  /** The follows the block removed don't come back: the profile is loaded again as it is now. */
  protected unblock(): void {
    const profile = this.profile();
    if (!profile || this.blocking()) return;
    this.blocking.set(true);
    this.follows.unblock(profile.userId).subscribe({
      complete: () => {
        this.blocking.set(false);
        this.load(this.key());
      },
      error: () => {
        this.blocking.set(false);
        this.toasts.show('Non siamo riusciti a sbloccare. Riprova tra poco.');
      },
    });
  }

  private copyLink(profile: UserProfileDto): void {
    void this.pageShare
      .copy(profileShareUrl(profile.userId, profile.username), 'link')
      .then((copied) => this.toasts.show(copied ? 'Link del profilo copiato.' : 'Non siamo riusciti a copiare il link.'));
  }

  private toggleMute(profile: UserProfileDto): void {
    const muted = !this.muted();
    this.muted.set(muted);
    this.follows.setMuted(profile.userId, muted).subscribe({
      complete: () =>
        this.toasts.show(
          muted
            ? `Non vedi più le attività di ${this.firstName()}. Non lo sa.`
            : `Vedi di nuovo le attività di ${this.firstName()}.`,
        ),
      error: () => {
        this.muted.set(!muted);
        this.toasts.show('Non siamo riusciti a cambiarlo. Riprova tra poco.');
      },
    });
  }

  private load(key: ProfileKey): void {
    const request: Observable<UserProfileDto> | null = key.username
      ? this.users.getProfileByUsername(key.username)
      : key.id
        ? this.users.getProfile(key.id)
        : null;
    if (!request) {
      this.state.set('gone');
      return;
    }
    this.state.set('loading');
    request.subscribe({
      next: (profile) => {
        if (profile.userId === this.auth.currentUser()?.userId) {
          void this.router.navigate(['/il-tuo-profilo'], { replaceUrl: true });
          return;
        }
        this.profile.set(profile);
        this.state.set('ready');
        this.seo.set(
          { title: profile.displayName, description: `Il profilo di ${profile.displayName} su ballastasera.` },
          key.username ? `/@${key.username}` : personPath(profile.userId),
        );
      },
      error: (error: unknown) => this.state.set(apiErrorStatus(error) === 404 ? 'gone' : 'error'),
    });
  }
}
