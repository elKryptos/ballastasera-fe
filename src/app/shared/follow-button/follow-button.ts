import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { PRIVATE_PROFILE_LABEL, RELATION_LABELS, UNFOLLOW_PRIVATE_TEXT } from '../../core/config/social';
import { SocialRelation } from '../../core/models/social.model';
import { FollowsService } from '../../core/services/follows.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorCode, apiErrorStatus } from '../../core/utils/api-errors';
import { firstNameOf } from '../../core/utils/initials';
import { afterFollow, afterUnfollow, iFollow } from '../../core/utils/relation';
import { RATE_LIMITED } from '../../core/interceptors/rate-limit.interceptor';
import { ConfirmSheet } from '../confirm-sheet/confirm-sheet';
import { RowPerson } from '../person-row/person-row';

/** Who the button is for, with the viewer's relation to them. */
export interface FollowTarget extends RowPerson {
  relation: SocialRelation;
}

let nextId = 0;

/**
 * "Segui" / "Segui già" / "Ricambia" / "Amici": follows or unfollows at a tap, showing the new state
 * at once and putting the old one back if the backend says no. Someone private can't be followed
 * (it would answer 404): instead of the button, "Profilo privato" — unless the viewer follows them
 * already, and then unfollowing asks first, since they can't be followed again until they're
 * public. Says "Ora siete amici" when following back. The page hears every change (relationChange)
 * to keep its own copy in step.
 */
@Component({
  selector: 'app-follow-button',
  imports: [ConfirmSheet],
  templateUrl: './follow-button.html',
  styleUrl: './follow-button.css',
})
export class FollowButton {
  private readonly follows = inject(FollowsService);
  private readonly toasts = inject(ToastService);

  readonly person = input.required<FollowTarget>();
  /** 'row': small, at the end of a list's row. 'wide': the profile's, sharing a line with others. */
  readonly size = input<'row' | 'wide'>('row');
  readonly relationChange = output<SocialRelation>();

  /** Follows the person given, and what was tapped since. */
  protected readonly relation = linkedSignal(() => this.person().relation);
  protected readonly busy = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly confirmId = `follow-confirm-${++nextId}`;

  protected readonly following = computed(() => iFollow(this.relation()));
  protected readonly label = computed(() => RELATION_LABELS[this.relation()]);
  protected readonly firstName = computed(() => firstNameOf(this.person().displayName));
  /** Private and not followed: nothing to do but say so. */
  protected readonly locked = computed(() => this.person().profilePublic === false && !this.following());
  protected readonly privateLabel = PRIVATE_PROFILE_LABEL;
  protected readonly unfollowPrivateText = UNFOLLOW_PRIVATE_TEXT;

  protected tap(): void {
    if (this.busy()) return;
    if (!this.following()) this.follow();
    else if (this.person().profilePublic === false) this.confirmOpen.set(true);
    else this.unfollow();
  }

  protected unfollow(): void {
    const before = this.relation();
    this.change(afterUnfollow(before));
    this.busy.set(true);
    this.follows.unfollow(this.person().userId).subscribe({
      complete: () => {
        this.busy.set(false);
        this.confirmOpen.set(false);
      },
      error: (error: unknown) => this.undo(before, error),
    });
  }

  private follow(): void {
    const before = this.relation();
    const after = afterFollow(before);
    this.change(after);
    this.busy.set(true);
    this.follows.follow(this.person().userId).subscribe({
      complete: () => {
        this.busy.set(false);
        if (after === 'MUTUAL') this.toasts.show(`Ora tu e ${this.firstName()} siete amici.`);
      },
      error: (error: unknown) => this.undo(before, error),
    });
  }

  private change(relation: SocialRelation): void {
    this.relation.set(relation);
    this.relationChange.emit(relation);
  }

  private undo(before: SocialRelation, error: unknown): void {
    this.busy.set(false);
    this.confirmOpen.set(false);
    this.change(before);
    // The interceptor has already said it for a rate limit.
    if (apiErrorCode(error) === RATE_LIMITED) return;
    this.toasts.show(
      apiErrorStatus(error) === 404
        ? 'Questo profilo non è più disponibile.'
        : `Non siamo riusciti ad aggiornare ${this.firstName()}. Riprova tra poco.`,
    );
  }
}
