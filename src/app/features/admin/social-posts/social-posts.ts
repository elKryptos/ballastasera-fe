import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { CityDto } from '../../../core/models/city.model';
import { CitiesService } from '../../../core/services/cities.service';
import { CityEventsService } from '../../../core/services/city-events.service';
import { inDateRange } from '../../../core/utils/event-filters';
import { injectPageShare } from '../../../core/utils/page-share';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';
import { AGENDA_RANGES, AgendaRange, STORY_DAYS, StoryDay, agendaDeck, storyDeck } from './agenda-decks';
import { CARD_FONTS, FRAMES, MAX_CAROUSEL_CARDS, drawCard } from './cards';
import { LESSON_DECKS, lessonDeck } from './lesson-decks';

type Mode = 'agenda' | 'story' | 'lesson';

const MODES: { value: Mode; label: string; about: string }[] = [
  { value: 'agenda', label: 'Agenda', about: 'Carosello con le serate del periodo, una notte per scheda.' },
  { value: 'story', label: 'Story', about: 'Le serate di una notte, in verticale: da pubblicare il giorno stesso.' },
  { value: 'lesson', label: 'Lezione', about: 'Carosello da un capitolo di "Impara a ballare": non scade mai.' },
];

/**
 * /admin/social: what to publish on Instagram, drawn here and ready to
 * download — the nights as a carousel (Agenda) or as tonight's story, from
 * the same events /lista shows, and the lesson's chapters as carousels —
 * each with the words to paste or the profiles to mention. Nothing is posted
 * from here: the admin downloads the pictures (or shares them straight to
 * the app, on a phone) and copies the text.
 */
@Component({
  selector: 'app-social-posts',
  imports: [SidebarPushDirective],
  templateUrl: './social-posts.html',
})
export class SocialPosts {
  private readonly cityEvents = inject(CityEventsService);

  protected readonly modes = MODES;
  protected readonly mode = signal<Mode>('agenda');
  protected readonly about = computed(() => MODES.find((option) => option.value === this.mode())!.about);

  protected readonly ranges = AGENDA_RANGES;
  protected readonly range = signal<AgendaRange>('weekend');
  protected readonly storyDays = STORY_DAYS;
  protected readonly storyDay = signal<StoryDay>('tonight');
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

  /** The lesson needs no events: only the other two wait for them. */
  protected readonly needsEvents = computed(() => this.mode() !== 'lesson');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  /** When the events were asked for: what "this weekend" is counted from. */
  private readonly now = signal(Date.now());

  protected readonly deck = computed(() => {
    const mode = this.mode();
    if (mode === 'lesson') return lessonDeck(this.lesson());
    const city = this.city();
    if (!city) return null;
    const now = this.now();
    const range = mode === 'agenda' ? this.range() : this.storyDay();
    const events = (this.cityEvents.entries().get(city.id)?.events ?? []).filter((event) => inDateRange(event, range, now));
    return mode === 'agenda' ? agendaDeck(events, this.range(), city.name, now) : storyDeck(events, this.storyDay(), city.name, now);
  });
  protected readonly frame = computed(() => FRAMES[this.deck()?.format ?? 'post']);
  protected readonly tooManyCards = computed(() => (this.deck()?.cards.length ?? 0) > MAX_CAROUSEL_CARDS);
  protected readonly maxCards = MAX_CAROUSEL_CARDS;

  private readonly canvases = viewChildren<ElementRef<HTMLCanvasElement>>('card');
  /** The nights' flyers by URL, as they load; null for one that couldn't be. */
  private readonly flyers = signal<ReadonlyMap<string, ImageBitmap | null>>(new Map());
  private readonly flyersAsked = new Set<string>();
  private readonly fontsReady = signal(false);

  private readonly pageShare = injectPageShare<'text'>();
  protected readonly copied = this.pageShare.copied;
  /** Phones: the pictures go to the share sheet, and from there to Instagram
   * or the photo roll, in one go. */
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

    // The flyers of the cards on screen, each asked for once.
    effect(() => {
      const rows = (this.deck()?.cards ?? []).flatMap((card) => (card.kind === 'night' ? card.rows : []));
      for (const { flyerUrl } of rows) {
        if (!flyerUrl || this.flyersAsked.has(flyerUrl)) continue;
        this.flyersAsked.add(flyerUrl);
        void this.loadFlyer(flyerUrl);
      }
    });

    // Redrawn whenever the deck, a flyer or the fonts change. Read before
    // the fonts' check, so the effect tracks them all from its first run.
    effect(() => {
      const deck = this.deck();
      const flyers = this.flyers();
      const canvases = this.canvases();
      if (!deck || !this.fontsReady()) return;
      canvases.forEach((canvas, index) => {
        const ctx = canvas.nativeElement.getContext('2d');
        const card = deck.cards[index];
        if (ctx && card) drawCard(ctx, deck.format, card, index, deck.cards.length, flyers);
      });
    });
  }

  protected load(city: CityDto, force = false): void {
    this.loading.set(true);
    this.error.set(false);
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

  protected copyText(): Promise<void> {
    return this.pageShare.copy(this.deck()?.text ?? '', 'text');
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
    const files = await this.cardFiles();
    try {
      await navigator.share({ files });
    } catch {
      // The share sheet was dismissed: nothing to do.
    }
    this.busy.set(false);
  }

  private async cardFiles(): Promise<File[]> {
    const files = await Promise.all(this.canvases().map((_, index) => this.cardFile(index)));
    return files.filter((file) => file !== null);
  }

  /** "ballastasera-agenda-weekend-1.png": numbered in the carousel's order. */
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
