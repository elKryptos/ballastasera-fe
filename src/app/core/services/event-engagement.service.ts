import { Service, WritableSignal, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { EventsService } from './events.service';

/** +1/-1 on whatever count the caller shows next to the toggle. */
export type CountChange = (delta: 1 | -1) => void;

/**
 * Parteciperò / Mi piace state, keyed by event id. Toggles are optimistic:
 * flipped immediately, then reconciled against the backend and rolled back
 * if the request fails.
 */
@Service()
export class EventEngagementService {
  private readonly eventsService = inject(EventsService);
  private readonly authService = inject(AuthService);

  private readonly goingEventIds = signal<ReadonlySet<string>>(new Set());
  private readonly likedEventIds = signal<ReadonlySet<string>>(new Set());

  /** Ids with a request still in flight, per state signal — a second tap on
   * the same button is ignored until it settles, or add/remove could reach
   * the server out of order and leave the button out of sync with the backend. */
  private readonly pendingToggles = new Map<WritableSignal<ReadonlySet<string>>, Set<string>>();

  /** Whose likes syncAllLikes() already loaded. */
  private likesSyncedFor: string | null = null;

  isGoing(eventId: string): boolean {
    return this.goingEventIds().has(eventId);
  }

  isLiked(eventId: string): boolean {
    return this.likedEventIds().has(eventId);
  }

  /** Local state only ever flips on toggle, so without this a user who's
   * already attending/liking sees the button uncoloured — and their first
   * click would fire "add" again instead of "remove". Signed out, it clears
   * the event's state instead, so a previous session's doesn't linger. */
  sync(eventId: string): void {
    this.syncOne(eventId, this.likedEventIds, (id) => this.eventsService.isFavorite(id));
    this.syncOne(eventId, this.goingEventIds, (id) => this.eventsService.isGoing(id));
  }

  /** Every like of the signed-in user in one request, for pages showing many
   * hearts at once (/lista), where sync() per card would be a request each.
   * Once per user per visit: from then on the toggles keep it current. Only
   * likes — Parteciperò isn't shown on those cards. */
  syncAllLikes(): void {
    const userId = this.authService.currentUser()?.userId;
    if (!userId || this.likesSyncedFor === userId) return;
    this.likesSyncedFor = userId;

    this.eventsService.getMyFavorites().subscribe({
      next: (events) => this.likedEventIds.update((ids) => new Set([...ids, ...events.map((event) => event.id)])),
      error: (err) => {
        this.likesSyncedFor = null;
        console.error('Failed to load liked events', err);
      },
    });
  }

  /** Returns false, without doing anything, when signed out — the caller
   * opens the login dialog, since the action requires a session server-side. */
  toggleGoing(eventId: string, onCountChange?: CountChange): boolean {
    return this.toggleOptimistic(
      this.goingEventIds,
      eventId,
      (id) => this.eventsService.addAttendance(id),
      (id) => this.eventsService.removeAttendance(id),
      onCountChange,
    );
  }

  /** Same contract as toggleGoing. */
  toggleLike(eventId: string, onCountChange?: CountChange): boolean {
    return this.toggleOptimistic(
      this.likedEventIds,
      eventId,
      (id) => this.eventsService.addFavorite(id),
      (id) => this.eventsService.removeFavorite(id),
      onCountChange,
    );
  }

  private syncOne(
    eventId: string,
    idsSignal: WritableSignal<ReadonlySet<string>>,
    fetchActive: (id: string) => Observable<boolean>,
  ): void {
    if (!this.authService.isAuthenticated()) {
      this.setMembership(idsSignal, eventId, false);
      return;
    }

    fetchActive(eventId).subscribe({
      next: (active) => this.setMembership(idsSignal, eventId, active),
      error: (err) => console.error('Failed to sync toggle state for event', eventId, err),
    });
  }

  private toggleOptimistic(
    idsSignal: WritableSignal<ReadonlySet<string>>,
    id: string,
    add: (id: string) => Observable<void>,
    remove: (id: string) => Observable<void>,
    onCountChange?: CountChange,
  ): boolean {
    if (!this.authService.isAuthenticated()) return false;

    const pending = this.pendingToggles.get(idsSignal) ?? new Set<string>();
    if (pending.has(id)) return true;
    this.pendingToggles.set(idsSignal, pending);

    const wasActive = idsSignal().has(id);
    this.setMembership(idsSignal, id, !wasActive);
    onCountChange?.(wasActive ? -1 : 1);
    pending.add(id);

    const request = wasActive ? remove(id) : add(id);
    request.subscribe({
      complete: () => pending.delete(id),
      error: () => {
        pending.delete(id);
        // Restore the exact previous state rather than flipping again.
        this.setMembership(idsSignal, id, wasActive);
        onCountChange?.(wasActive ? 1 : -1);
      },
    });
    return true;
  }

  private setMembership(idsSignal: WritableSignal<ReadonlySet<string>>, id: string, active: boolean): void {
    idsSignal.update((ids) => {
      const next = new Set(ids);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
