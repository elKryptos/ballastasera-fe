import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { CityDto } from '../../../core/models/city.model';
import { EventCardDto } from '../../../core/models/event.model';
import { CitiesService } from '../../../core/services/cities.service';
import { CityEventsService } from '../../../core/services/city-events.service';
import { EventsService } from '../../../core/services/events.service';
import { inDateRange } from '../../../core/utils/event-filters';
import { injectPageShare } from '../../../core/utils/page-share';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { CARD_FONTS, FRAMES, MAX_CAROUSEL_CARDS, drawCard } from './cards';
import { Kind, frameOf } from './deck';
import { PERIODS, Period, cardMentions, detailMentions, eventDeck, eventLabel, nightsDeck } from './event-decks';
import { LESSON_DECKS, lessonDeck } from './lesson-decks';
import { MAX_REEL_SECONDS, cardSeconds, recordReel, reelType } from './reel';

/** What it's about: the nights of a period, one night, or the lesson. */
type Subject = 'nights' | 'event' | 'lesson';

const KINDS: { value: Kind; label: string; about: string }[] = [
  { value: 'post', label: 'Post', about: 'Resta sul profilo: una foto o un carosello.' },
  { value: 'story', label: 'Story', about: 'Dura 24 ore. Menzioni il locale e lui la ricondivide con un tocco.' },
  { value: 'reel', label: 'Reel', about: 'Un video: è quello che Instagram mostra di più a chi non ti segue.' },
];

const SUBJECTS: { value: Subject; label: string; about: string }[] = [
  { value: 'nights', label: 'Le serate', about: 'Tutte quelle di un periodo, notte per notte.' },
  { value: 'event', label: 'Una serata', about: 'Una sola, con flyer e dettagli: quella che il suo locale ricondivide.' },
  { value: 'lesson', label: 'La lezione', about: 'Un capitolo di "Impara a ballare": non scade mai.' },
];

/** A reel once it's been recorded: the file, and a URL to play it from. */
interface Reel {
  file: File;
  url: string;
}

/**
 * /admin/social: what to publish on Instagram, made here and ready to
 * download. Two choices and their options: the format — a post, a story or a
 * reel (Kind) — and what it's about — the nights of a period, one night, or
 * a chapter of the lesson (Subject); each of the three comes in each format.
 * The pictures are drawn from the same events /lista shows; a reel is a
 * video of them (reel.ts). With them come the words to paste and, under each
 * picture, who to mention on it. Nothing is posted from here: the admin
 * downloads the files (or shares them straight to the app, on a phone).
 */
@Component({
  selector: 'app-social-posts',
  imports: [SidebarPushDirective],
  templateUrl: './social-posts.html',
})
export class SocialPosts {
  private readonly cityEvents = inject(CityEventsService);
  private readonly eventsService = inject(EventsService);

  protected readonly kinds = KINDS;
  protected readonly kind = signal<Kind>('post');
  protected readonly subjects = SUBJECTS;
  protected readonly subject = signal<Subject>('nights');

  protected readonly periods = PERIODS;
  protected readonly period = signal<Period>('weekend');
  /** After the nights, a card of its own for each event. */
  protected readonly detailed = signal(true);
  /** Which night, the first of the week's until one is picked. */
  private readonly pickedEventId = signal<string | null>(null);
  protected readonly lessons = LESSON_DECKS;
  protected readonly lesson = signal(LESSON_DECKS[0].slug);

  /** Undefined until they arrive. */
  protected readonly cities = toSignal(inject(CitiesService).getCities().pipe(catchError(() => of<CityDto[]>([]))));
  private readonly pickedCityId = signal<number | null>(null);
  /** The picked city, else the first one. */
  protected readonly city = computed(() => {
    const cities = this.cities() ?? [];
    return cities.find((city) => city.id === this.pickedCityId()) ?? cities[0] ?? null;
  });

  /** The lesson needs no events: the other two wait for them. */
  protected readonly needsEvents = computed(() => this.subject() !== 'lesson');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  /** When the events were asked for: what "this weekend" is counted from. */
  private readonly now = signal(Date.now());

  /** The subject's events, soonest first: the period's nights, or the week
   * one night is picked from. None for the lesson. */
  private readonly events = computed(() => {
    const city = this.city();
    const subject = this.subject();
    if (!city || subject === 'lesson') return [];
    const now = this.now();
    const range = subject === 'nights' ? this.period() : 'week';
    return (this.cityEvents.entries().get(city.id)?.events ?? [])
      .filter((event) => inDateRange(event, range, now))
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  });

  /** The picker of the one night: the week's. */
  protected readonly eventOptions = computed(() =>
    this.subject() === 'event' ? this.events().map((event) => ({ id: event.id, label: eventLabel(event) })) : [],
  );
  protected readonly pickedEvent = computed(
    () => this.events().find((event) => event.id === this.pickedEventId()) ?? this.events()[0] ?? null,
  );
  /** The events on the pictures: all of the period's, or the one night. */
  private readonly shownEvents = computed(() => {
    if (this.subject() !== 'event') return this.events();
    const event = this.pickedEvent();
    return event ? [event] : [];
  });

  /** Each event's Instagram mentions from its full record, by id, as they
   * come in: the list's cards only carry the organizer's profile, and the
   * venue's is the one most nights have. */
  private readonly mentions = signal<ReadonlyMap<string, string[]>>(new Map());
  private readonly mentionsAsked = new Set<string>();
  /** Still waiting on some: the text isn't complete yet. */
  protected readonly mentionsPending = computed(() =>
    this.shownEvents().some((event) => !this.mentions().has(event.id)),
  );

  protected readonly deck = computed(() => {
    const kind = this.kind();
    const subject = this.subject();
    if (subject === 'lesson') return lessonDeck(this.lesson(), kind);
    const city = this.city();
    if (!city) return null;
    const mentions = this.mentions();
    const mentionsOf = (event: EventCardDto): string[] => mentions.get(event.id) ?? cardMentions(event);
    if (subject === 'event') {
      const event = this.pickedEvent();
      return event ? eventDeck(event, kind, city.name, mentionsOf) : null;
    }
    return nightsDeck(this.events(), this.period(), city.name, this.now(), mentionsOf, kind, this.detailed());
  });
  protected readonly frame = computed(() => FRAMES[frameOf(this.kind())]);

  /** How long the reel of these cards runs, in seconds. */
  protected readonly reelSeconds = computed(() =>
    Math.round((this.deck()?.cards ?? []).reduce((total, card) => total + cardSeconds(card), 0)),
  );
  /** What Instagram won't take as it is: a carousel of too many pictures,
   * or a reel that runs too long. */
  protected readonly tooMuch = computed(() => {
    const deck = this.deck();
    if (!deck) return null;
    if (deck.kind === 'post' && deck.cards.length > MAX_CAROUSEL_CARDS) {
      return `Instagram accetta al massimo ${MAX_CAROUSEL_CARDS} immagini per carosello: scegli un periodo più breve, togli i "Dettagli" o dividi il post.`;
    }
    if (deck.kind === 'reel' && this.reelSeconds() > MAX_REEL_SECONDS) {
      return `Un reel dura al massimo ${MAX_REEL_SECONDS} secondi: scegli un periodo più breve o togli i "Dettagli".`;
    }
    return null;
  });

  private readonly canvases = viewChildren<ElementRef<HTMLCanvasElement>>('card');
  /** The nights' flyers by URL, as they load; null for one that couldn't be. */
  private readonly flyers = signal<ReadonlyMap<string, ImageBitmap | null>>(new Map());
  private readonly flyersAsked = new Set<string>();
  private readonly fontsReady = signal(false);

  /** What this browser records a reel as; null where it can't. */
  protected readonly reelType = reelType();
  /** The reel of the deck on screen, once recorded; gone when the deck changes. */
  protected readonly reel = signal<Reel | null>(null);
  /** How far along the recording is, 0 to 1; null when none is running. */
  protected readonly recording = signal<number | null>(null);
  /** Counts the decks: a recording that ends after its deck has changed is dropped. */
  private deckVersion = 0;

  private readonly pageShare = injectPageShare<string>();
  protected readonly copied = this.pageShare.copied;
  /** Phones: the files go to the share sheet, and from there to Instagram or
   * the photo roll, in one go. */
  protected readonly canShareFiles =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([], 'card.png', { type: 'image/png' })] });
  protected readonly busy = signal(false);

  constructor() {
    // A canvas draws with a fallback font if the web font isn't in yet, and
    // doesn't redraw by itself when it is.
    void Promise.all(CARD_FONTS.map((font) => document.fonts.load(font)))
      .catch(() => undefined)
      .then(() => this.fontsReady.set(true));

    effect(() => {
      const city = this.city();
      if (city) untracked(() => this.load(city));
    });

    // The full record of each event on the pictures, asked for once, for its
    // mentions. One that can't be had keeps what its card says.
    effect(() => {
      for (const event of this.shownEvents()) {
        if (this.mentionsAsked.has(event.id)) continue;
        this.mentionsAsked.add(event.id);
        const keep = (found: string[]): void => this.mentions.update((all) => new Map(all).set(event.id, found));
        this.eventsService.getEventDetail(event.id).subscribe({
          next: (detail) => keep(detailMentions(detail)),
          error: () => keep(cardMentions(event)),
        });
      }
    });

    // The flyers of the cards on screen, each asked for once.
    effect(() => {
      const shown = (this.deck()?.cards ?? []).flatMap((card) =>
        card.kind === 'night' ? card.rows : card.kind === 'event' ? [card] : [],
      );
      for (const { flyerUrl } of shown) {
        if (!flyerUrl || this.flyersAsked.has(flyerUrl)) continue;
        this.flyersAsked.add(flyerUrl);
        void this.loadFlyer(flyerUrl);
      }
    });

    // Redrawn whenever the deck, a flyer or the fonts change. Read before
    // the fonts' check, so the effect tracks them all from its first run.
    // Each canvas is given its format's size here, not by the template: a
    // resize blanks a canvas, and one coming after this had drawn (going
    // from a story to a post with as many cards) left it empty.
    effect(() => {
      const deck = this.deck();
      const flyers = this.flyers();
      const canvases = this.canvases();
      if (!deck || !this.fontsReady()) return;
      const format = frameOf(deck.kind);
      const { width, height } = FRAMES[format];
      canvases.forEach(({ nativeElement: canvas }, index) => {
        const card = deck.cards[index];
        if (!card) return;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) drawCard(ctx, format, card, index, deck.cards.length, flyers);
      });
    });

    // A recorded reel is of the cards as they were: any change to them (a
    // flyer coming in too) and it's no longer theirs.
    effect(() => {
      this.deck();
      this.flyers();
      untracked(() => this.dropReel());
    });
    inject(DestroyRef).onDestroy(() => this.dropReel());
  }

  /** `force` is "Aggiorna": the events again, and their mentions with them —
   * it's what the admin presses after adding a venue's missing profile. */
  protected load(city: CityDto, force = false): void {
    this.loading.set(true);
    this.error.set(false);
    if (force) {
      this.mentionsAsked.clear();
      this.mentions.set(new Map());
    }
    this.cityEvents.load(city, { force }).subscribe({
      next: () => {
        this.now.set(Date.now());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected selectCity(event: Event): void {
    this.pickedCityId.set(Number((event.target as HTMLSelectElement).value));
  }

  protected selectEvent(event: Event): void {
    this.pickedEventId.set((event.target as HTMLSelectElement).value);
  }

  protected selectLesson(event: Event): void {
    this.lesson.set((event.target as HTMLSelectElement).value);
  }

  /** Through fetch, not an <img>: the site's own <img>s cache the flyers
   * without CORS headers, and a canvas that drew one of those can't be
   * exported any more. `no-store` asks the API again, with them. */
  private async loadFlyer(url: string): Promise<void> {
    let flyer: ImageBitmap | null = null;
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (response.ok) flyer = await createImageBitmap(await response.blob());
    } catch {
      // Left null: the row shows the title's initial instead.
    }
    this.flyers.update((flyers) => new Map(flyers).set(url, flyer));
  }

  /** `what` names the button that says "Copiato" for a moment. */
  protected copy(text: string, what: string): Promise<void> {
    return this.pageShare.copy(text, what);
  }

  protected async download(index: number): Promise<void> {
    const file = await this.cardFile(index);
    if (file) save(file);
  }

  protected async downloadAll(): Promise<void> {
    this.busy.set(true);
    for (const file of await this.cardFiles()) save(file);
    this.busy.set(false);
  }

  protected async shareAll(): Promise<void> {
    this.busy.set(true);
    await share(await this.cardFiles());
    this.busy.set(false);
  }

  /** Plays the cards on screen and records them (recordReel): it takes as
   * long as the reel runs, with this tab in view. */
  protected async recordReel(): Promise<void> {
    const deck = this.deck();
    const type = this.reelType;
    const frames = this.canvases().map((canvas) => canvas.nativeElement);
    if (!deck || !type || !frames.length || this.recording() !== null) return;
    const version = this.deckVersion;
    this.recording.set(0);
    try {
      const video = await recordReel(frames, deck.cards.map(cardSeconds), type, (done) => this.recording.set(done));
      if (version === this.deckVersion) {
        const file = new File([video], `ballastasera-${deck.slug}.${type.extension}`, { type: video.type });
        this.reel.set({ file, url: URL.createObjectURL(file) });
      }
    } catch {
      // Nothing recorded: the button is there to try again.
    }
    this.recording.set(null);
  }

  protected downloadReel(): void {
    const reel = this.reel();
    if (reel) save(reel.file);
  }

  protected canShare(file: File): boolean {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  }

  protected shareReel(): Promise<void> {
    const reel = this.reel();
    return reel ? share([reel.file]) : Promise.resolve();
  }

  private dropReel(): void {
    this.deckVersion++;
    const reel = this.reel();
    if (reel) URL.revokeObjectURL(reel.url);
    this.reel.set(null);
  }

  private async cardFiles(): Promise<File[]> {
    const files = await Promise.all(this.canvases().map((_, index) => this.cardFile(index)));
    return files.filter((file) => file !== null);
  }

  /** "ballastasera-post-serate-weekend-1.png": numbered in the deck's order. */
  private cardFile(index: number): Promise<File | null> {
    const canvas = this.canvases()[index]?.nativeElement;
    const slug = this.deck()?.slug;
    if (!canvas || !slug) return Promise.resolve(null);
    return new Promise((resolve) =>
      canvas.toBlob(
        (blob) => resolve(blob && new File([blob], `ballastasera-${slug}-${index + 1}.png`, { type: 'image/png' })),
        'image/png',
      ),
    );
  }
}

function save(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  // Not right away: the download reads the URL after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function share(files: File[]): Promise<void> {
  try {
    await navigator.share({ files });
  } catch {
    // The share sheet was dismissed: nothing to do.
  }
}
