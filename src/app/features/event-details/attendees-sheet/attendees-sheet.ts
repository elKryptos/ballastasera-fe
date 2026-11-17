import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEyeOff } from '@ng-icons/lucide';
import { EventAttendeeDto } from '../../../core/models/event.model';
import { AuthService } from '../../../core/services/auth.service';
import { EventsService } from '../../../core/services/events.service';
import { instagramHandle } from '../../../core/utils/event-format';
import { initialOf } from '../../../core/utils/initials';
import { personTone } from '../../../core/utils/person-tone';
import { AttendeeProfile } from '../attendee-profile/attendee-profile';

/** People per page of the list, as the backend's default. */
const PAGE_SIZE = 20;
/** Faces stacked in the header, next to "Chi ci va". */
const HEADER_FACES = 3;
/** Pulled down further than this, the sheet closes when let go; less, it springs back. */
const CLOSE_PULL_PX = 80;
/** A pull shorter than this is a tap (the map's sheet uses the same idea, SWIPE_PX). */
const TAP_PX = 8;
/** A click this soon after a pull ends is that pull's own click, not a new tap. A finger that
 * moved often makes no click at all, so the pull must not wait for one. */
const PULL_CLICK_MS = 400;

/** "Chi ci va", opened from the event's page (the faces or "Vedi tutti"): everyone going with a
 * public profile, a page at a time, and tapping one opens their profile in the same sheet, with
 * "‹ Chi ci va" to come back. Profiles are for signed-in users only: signed out, a tap asks the
 * page to open the login (signInRequested). From the canvas' "Chi ci va" flow (3b–3e), without
 * the tabs, search and "Segui", which wait for follows. A native modal <dialog> with the app's
 * .ev-dialog look (styles.css): a sheet on phones, a card from md up. */
@Component({
  selector: 'app-attendees-sheet',
  imports: [AttendeeProfile, NgIcon],
  providers: [provideIcons({ lucideEyeOff })],
  templateUrl: './attendees-sheet.html',
  styleUrl: './attendees-sheet.css',
  // On the window, not the header: a finger pulling the sheet down soon leaves the header.
  host: {
    '(window:pointermove)': 'movePull($event)',
    '(window:pointerup)': 'endPull($event)',
    '(window:pointercancel)': 'cancelPull($event)',
  },
})
export class AttendeesSheet {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly events = inject(EventsService);
  private readonly auth = inject(AuthService);

  readonly open = model(false);
  readonly eventId = input.required<string>();
  /** Everyone going (EventDetailDto.goingCount), whether their profile is public or not. */
  readonly goingCount = input.required<number>();
  /** A signed-out visitor tapped someone: the sheet closes and the page opens the login. */
  readonly signInRequested = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private readonly attendees = signal<EventAttendeeDto[]>([]);
  /** People with a public profile, all pages together (the page's totalElements). */
  private readonly publicCount = signal(0);
  private readonly nextPage = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  /** The first page has answered: until then nothing is said about who's missing. */
  protected readonly loaded = signal(false);

  /** Bumped on every reload: an answer for an older list is dropped. */
  private generation = 0;

  /** Pulling the sheet down by its header (touch and pen; a mouse has the ✕): which finger and
   * where it started, how far down it is now, and when the last real pull (past TAP_PX) ended, to
   * tell the click it may cause from a tap. */
  private pullPointer: number | null = null;
  private pullStartY = 0;
  private readonly pull = signal(0);
  private lastPullEndedAt = 0;
  protected readonly pulling = signal(false);
  /** The CSS `translate` that follows the finger: apart from .ev-dialog's own `transform`, so the
   * closing slide still runs, from wherever the sheet was let go. */
  protected readonly pullOffset = computed(() => (this.pull() > 0 ? `0 ${this.pull()}px` : null));

  /** The person whose profile is open; null: the list. */
  protected readonly selected = signal<EventAttendeeDto | null>(null);

  /** The list's rows, the viewer first when they're going: that's the row they look for. */
  protected readonly rows = computed(() => {
    const myId = this.auth.currentUser()?.userId;
    const rows = this.attendees().map((attendee) => ({
      attendee,
      initial: initialOf(attendee.displayName),
      tone: personTone(attendee.userId),
      handle: attendee.instagram ? instagramHandle(attendee.instagram) : null,
      isMe: attendee.userId === myId,
    }));
    return [...rows.filter((row) => row.isMe), ...rows.filter((row) => !row.isMe)];
  });

  /** The header's faces: the first few in the list, overlapping. */
  protected readonly headerFaces = computed(() => this.rows().slice(0, HEADER_FACES));

  /** Not loaded yet, for "Carica altri (8)". */
  protected readonly remaining = computed(() => Math.max(0, this.publicCount() - this.attendees().length));

  /** Placeholder rows while the first page loads, so the sheet has its shape at once. */
  protected readonly skeletons = [1, 2, 3, 4];

  /** Going, but with a private profile: counted, never named. */
  protected readonly hiddenCount = computed(() => Math.max(0, this.goingCount() - this.publicCount()));

  /** "12 persone · 2 in incognito": the private ones only once the list has said how many are public. */
  protected readonly subtitle = computed(() => {
    const count = this.goingCount();
    const people = count === 1 ? '1 persona' : `${count} persone`;
    const hidden = this.loaded() ? this.hiddenCount() : 0;
    return hidden ? `${people} · ${hidden} in incognito` : people;
  });

  constructor() {
    // showModal() rather than the open attribute: that's what puts it in the top layer, makes
    // the page behind inert and lets Esc close it. Each opening starts from the list, fresh:
    // people may have joined or left since.
    effect(() => {
      const open = this.open();
      if (!this.isBrowser) return;
      const dialog = this.dialog().nativeElement;
      if (open && !dialog.open) {
        // A sheet closed by a pull kept its offset while sliding away, and one closed mid-pull
        // (Esc) may have one still going: back in place now.
        untracked(() => {
          this.pullPointer = null;
          this.pulling.set(false);
          this.pull.set(0);
        });
        dialog.showModal();
        untracked(() => this.reload());
      } else if (!open && dialog.open) {
        dialog.close();
      }
    });
  }

  protected openProfile(attendee: EventAttendeeDto): void {
    if (!this.auth.isAuthenticated()) {
      this.open.set(false);
      this.signInRequested.emit();
      return;
    }
    this.selected.set(attendee);
  }

  protected backToList(): void {
    this.selected.set(null);
  }

  protected loadMore(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    const page = this.nextPage();
    const generation = this.generation;
    this.events.getAttendees(this.eventId(), PAGE_SIZE, page).subscribe({
      next: (answer) => {
        if (generation !== this.generation) return;
        this.attendees.update((list) => [...list, ...answer.content]);
        this.publicCount.set(answer.page.totalElements);
        this.nextPage.set(page + 1);
        this.hasMore.set(page + 1 < answer.page.totalPages);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        if (generation !== this.generation) return;
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** The (close) event covers Esc as well as dialog.close(), so `open` follows however it was
   * dismissed; the next opening starts from the list. */
  protected onClose(): void {
    this.open.set(false);
    this.selected.set(null);
  }

  /** The header pressed by a finger or pen. Its own buttons ("‹ Chi ci va", ✕) keep their taps;
   * the line at the top is part of the handle. */
  protected startPull(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || this.pullPointer !== null) return;
    const button = (event.target as HTMLElement).closest('button');
    if (button && !button.classList.contains('grabber-hit')) return;
    this.pullPointer = event.pointerId;
    this.pullStartY = event.clientY;
    this.pulling.set(true);
  }

  /** Only the finger that started the pull moves the sheet: a second one is ignored. */
  protected movePull(event: PointerEvent): void {
    if (event.pointerId !== this.pullPointer) return;
    this.pull.set(Math.max(0, event.clientY - this.pullStartY));
  }

  /** Let go: far enough, it closes (keeping its offset, so it slides away from there); otherwise
   * it springs back. */
  protected endPull(event: PointerEvent): void {
    if (event.pointerId !== this.pullPointer) return;
    this.pullPointer = null;
    this.pulling.set(false);
    const pulled = this.pull();
    if (pulled > TAP_PX) this.lastPullEndedAt = performance.now();
    if (pulled > CLOSE_PULL_PX) this.open.set(false);
    else this.pull.set(0);
  }

  protected cancelPull(event: PointerEvent): void {
    if (event.pointerId !== this.pullPointer) return;
    this.pullPointer = null;
    this.pulling.set(false);
    this.pull.set(0);
  }

  /** The line at the top tapped: closes. Not after a pull that sprang
   * back, whose release also counts as a click on it. */
  protected closeFromGrabber(): void {
    if (this.wasPull()) return;
    this.open.set(false);
  }

  /** A tap on the backdrop is a tap on the dialog itself, outside its content. Not the click
   * that ends a pull: released below the header, it lands on the dialog too. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (this.wasPull()) return;
    if (event.target === this.dialog().nativeElement) this.open.set(false);
  }

  /** Whether the click being handled comes from a pull that just ended rather than from a tap. */
  private wasPull(): boolean {
    return performance.now() - this.lastPullEndedAt < PULL_CLICK_MS;
  }

  private reload(): void {
    this.generation++;
    this.selected.set(null);
    this.attendees.set([]);
    this.publicCount.set(0);
    this.nextPage.set(0);
    this.hasMore.set(false);
    this.loaded.set(false);
    this.loading.set(false);
    this.loadMore();
  }
}
