import { Component, inject, input, signal } from '@angular/core';
import { UserSummaryDto } from '../../core/models/social.model';
import { FollowsService } from '../../core/services/follows.service';
import { ToastService } from '../../core/services/toast.service';
import { firstNameOf } from '../../core/utils/initials';
import { PersonRow } from '../person-row/person-row';
import { Sheet } from '../sheet/sheet';

/**
 * "Persone bloccate" (social phase 1): a row in the account ("Avvisi e persone") that opens the list of
 * the people the user blocked, each with "Sblocca"; a small link under the lists in "Amici" opens the
 * same, for whoever looks for it there. Their pages aren't linked: neither sees the other's while
 * blocked. Unblocking brings no follow back (the block deleted them).
 */
@Component({
  selector: 'app-blocked-people',
  imports: [PersonRow, Sheet],
  templateUrl: './blocked-people.html',
  styleUrl: './blocked-people.css',
})
export class BlockedPeople {
  private readonly follows = inject(FollowsService);
  private readonly toasts = inject(ToastService);

  /** 'row': the account's, with what blocking means. 'link': a small one, under the lists of "Amici". */
  readonly appearance = input<'row' | 'link'>('row');

  protected readonly open = signal(false);
  protected readonly people = signal<UserSummaryDto[] | null>(null);
  protected readonly failed = signal(false);
  /** Whose "Sblocca" is on its way. */
  protected readonly unblocking = signal<string | null>(null);

  protected show(): void {
    this.open.set(true);
    this.load();
  }

  protected load(): void {
    this.people.set(null);
    this.failed.set(false);
    this.follows.blocks().subscribe({
      next: (people) => this.people.set(people),
      error: () => this.failed.set(true),
    });
  }

  protected unblock(person: UserSummaryDto): void {
    if (this.unblocking()) return;
    this.unblocking.set(person.userId);
    this.follows.unblock(person.userId).subscribe({
      complete: () => {
        this.unblocking.set(null);
        this.people.update((people) => people?.filter((item) => item.userId !== person.userId) ?? null);
        this.toasts.show(`Hai sbloccato ${firstNameOf(person.displayName)}.`);
      },
      error: () => {
        this.unblocking.set(null);
        this.toasts.show('Non siamo riusciti a sbloccare. Riprova tra poco.');
      },
    });
  }
}
