import { Component, computed, effect, inject, input, model, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged, skip } from 'rxjs';
import {
  INVITE_HIDDEN_NIGHTS_TEXT,
  INVITE_PHRASES,
  INVITE_PHRASE_LABELS,
  INVITE_STATUS_LABELS,
} from '../../../core/config/social';
import { PageCursor } from '../../../core/models/page.model';
import { InviteFriendDto, InvitePhrase } from '../../../core/models/social.model';
import { AuthService } from '../../../core/services/auth.service';
import { InvitesService } from '../../../core/services/invites.service';
import { apiErrorCode } from '../../../core/utils/api-errors';
import { firstNameOf } from '../../../core/utils/initials';
import { INVITE_LIMIT, NO_INVITES_LEFT_TEXT, inviteErrorMessage, inviteStatusFromError } from '../../../core/utils/invite-errors';
import { Choice, ChoiceGroup } from '../../../shared/choice-group/choice-group';
import { InfiniteScrollDirective } from '../../../shared/directives/infinite-scroll.directive';
import { PersonRow } from '../../../shared/person-row/person-row';
import { Sheet } from '../../../shared/sheet/sheet';
import { SEARCH_DEBOUNCE_MS } from '../../../core/utils/remote-search';

/**
 * "Invita a ballare" from a night's page (social phase 6, S10): a phrase on top (fixed, no free text),
 * the friends below, searchable, each with "Invita" or why not ("Ci va già", "Già invitato",
 * "Profilo privato: non può essere invitato"), and how many invites are left today. With the nights
 * hidden from everyone, it warns first that the friend will see this one. A dialog the backend
 * refuses as a whole (a private profile, a night over, not going) says why instead of the list.
 */
@Component({
  selector: 'app-invite-sheet',
  imports: [ReactiveFormsModule, ChoiceGroup, InfiniteScrollDirective, PersonRow, Sheet],
  templateUrl: './invite-sheet.html',
  styleUrl: './invite-sheet.css',
})
export class InviteSheet {
  private readonly invites = inject(InvitesService);
  private readonly auth = inject(AuthService);

  readonly open = model(false);
  readonly eventId = input.required<string>();
  readonly eventTitle = input.required<string>();

  protected readonly phrase = new FormControl<InvitePhrase>('CI_VIENI', { nonNullable: true });
  protected readonly phrases: Choice<InvitePhrase>[] = INVITE_PHRASES.map((value) => ({
    value,
    label: INVITE_PHRASE_LABELS[value],
  }));
  protected readonly statusLabels = INVITE_STATUS_LABELS;
  protected readonly hiddenNightsText = INVITE_HIDDEN_NIGHTS_TEXT;
  protected readonly noInvitesLeftText = NO_INVITES_LEFT_TEXT;

  protected readonly query = signal('');
  protected readonly friends = signal<InviteFriendDto[]>([]);
  protected readonly invitesLeft = signal<number | null>(null);
  private readonly cursor = signal<PageCursor | null>(null);
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  /** The whole dialog refused (PROFILE_PRIVATE, NOT_GOING…): why, in place of the list. */
  protected readonly refused = signal<string | null>(null);
  protected readonly failed = signal(false);
  /** What the last invite did, said in the sheet itself: a toast would wait for it to close. */
  protected readonly notice = signal<{ text: string; error: boolean } | null>(null);
  /** Whose invite is on its way. */
  protected readonly sending = signal<string | null>(null);
  private request: Subscription | null = null;

  protected readonly hasMore = computed(() => this.cursor() !== null);
  /** Their nights hidden from everyone: the invite tells the friend which night they go to. */
  protected readonly nightsHidden = computed(() => this.auth.currentUser()?.attendanceVisibility === 'NOBODY');
  protected readonly leftText = computed(() => {
    const left = this.invitesLeft();
    if (left === null) return null;
    if (left === 0) return NO_INVITES_LEFT_TEXT;
    return left === 1 ? 'Ti resta 1 invito oggi.' : `Ti restano ${left} inviti oggi.`;
  });

  constructor() {
    // Each opening, from the first page, the search emptied: who's going may have changed.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.query.set('');
        this.notice.set(null);
        this.load(null);
      });
    });
    toObservable(this.query)
      .pipe(skip(1), debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        if (this.open()) this.load(null);
      });
  }

  protected loadMore(): void {
    const cursor = this.cursor();
    if (cursor && !this.loading()) this.load(cursor);
  }

  protected invite(friend: InviteFriendDto): void {
    if (this.sending() || this.invitesLeft() === 0) return;
    const userId = friend.user.userId;
    this.sending.set(userId);
    this.notice.set(null);
    this.invites.invite(userId, { eventId: this.eventId(), phrase: this.phrase.value }).subscribe({
      complete: () => {
        this.sending.set(null);
        this.setStatus(userId, 'ALREADY_INVITED');
        this.invitesLeft.update((left) => (left === null ? null : Math.max(0, left - 1)));
        this.notice.set({ text: `Invito mandato a ${firstNameOf(friend.user.displayName)}.`, error: false });
      },
      error: (error: unknown) => {
        this.sending.set(null);
        const status = inviteStatusFromError(error);
        if (status) this.setStatus(userId, status);
        if (apiErrorCode(error) === INVITE_LIMIT) this.invitesLeft.set(0);
        this.notice.set({ text: inviteErrorMessage(error), error: true });
      },
    });
  }

  private setStatus(userId: string, status: InviteFriendDto['status']): void {
    this.friends.update((friends) => friends.map((item) => (item.user.userId === userId ? { ...item, status } : item)));
  }

  private load(cursor: PageCursor | null): void {
    this.request?.unsubscribe();
    const first = cursor === null;
    if (first) {
      this.friends.set([]);
      this.loaded.set(false);
    }
    this.loading.set(true);
    this.refused.set(null);
    this.failed.set(false);
    this.request = this.invites.friends(this.eventId(), this.query(), cursor).subscribe({
      next: (answer) => {
        this.invitesLeft.set(answer.invitesLeft);
        this.friends.update((friends) => (first ? answer.friends.items : [...friends, ...answer.friends.items]));
        const page = answer.friends;
        this.cursor.set(page.nextCursorStartAt && page.nextCursorId ? { startAt: page.nextCursorStartAt, id: page.nextCursorId } : null);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (apiErrorCode(error)) this.refused.set(inviteErrorMessage(error));
        else this.failed.set(true);
      },
    });
  }
}
