import {
  Component,
  ElementRef,
  WritableSignal,
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
import {
  AGENDA_RANGES,
  AgendaRange,
  STORY_DAYS,
  StoryDay,
  agendaDeck,
  cardMentions,
  detailMentions,
  eventDeck,
  eventLabel,
  storyDeck,
} from './agenda-decks';
import { CARD_FONTS, FRAMES, Format, MAX_CAROUSEL_CARDS, drawCard } from './cards';
import { LESSON_DECKS, lessonDeck } from './lesson-decks';

type Mode = 'agenda' | 'story' | 'event' | 'lesson';

const MODES: { value: Mode; label: string; about: string }[] = [
  {
    value: 'agenda',
    label: 'Agenda',
    about: 'Carosello con le serate del periodo, una notte per scheda; con "Dettagli", poi una scheda per ogni serata.',
  },
  { value: 'story', label: 'Story', about: 'Le serate di una notte, in verticale: da pubblicare il giorno stesso.' },
  {
    value: 'event',
    label: 'Serata',
    about: 'Una serata da sola, con flyer e dettagli: quella che il locale ricondivide più volentieri.',
  },
  { value: 'lesson', label: 'Lezione', about: 'Carosello da un capitolo di "Impara a ballare": non scade mai.' },
];

const EVENT_FORMATS: { value: Format; label: string }[] = [
  { value: 'story', label: 'Story' },
  { value: 'post', label: 'Post' },
];

/** One of the choices under the modes, as the template draws it. */
interface Choice {
  label: string;
  on: boolean;
  pick: () => void;
}

/**
 * /admin/social: what to publish on Instagram, drawn here and ready to
 * download — the nights as a carousel (Agenda), as tonight's story or one on
 * its own (Serata), from the same events /lista shows, and the lesson's
 * chapters as carousels — each with the words to paste or the profiles to
 * mention. Nothing is posted from here: the admin downloads the pictures (or
 * shares them straight to the app, on a phone) and copies the text.
 */
@Component({
  selector: 'app-social-posts',
  imports: [SidebarPushDirective],
  templateUrl: './social-posts.html',
})
export class SocialPosts {
  private readonly cityEvents = inject(CityEventsService);
  private readonly eventsService = inject(EventsService);

  protected readonly modes = MODES;
  protected readonly mode = signal<Mode>('agenda');
  protected readonly about = computed(() => MODES.find((option) => option.value === this.mode())!.about);

  private readonly range = signal<AgendaRange>('weekend');
  /** Agenda: after the nights, a card of its own for each event. */
  protected readonly detailed = signal(true);
  private readonly storyDay = signal<StoryDay>('tonight');
  /** Serata: which night (the first of the week's until one is picked), and
   * as a story or a post. */
  private readonly pickedEventId = signal<string | null>(null);
  private readonly eventFormat = signal<Format>('story');
  protected readonly lessons = LESSON_DECKS;
  protected readonly lesson = signal(LESSON_DECKS[0].slug);

  /** The mode's own choices: the agenda's period, the story's day, Serata's
   * format. The lesson has its picker instead. */
  protected readonly choices = computed<Choice[]>(() => {
    const among = <T>(options: { value: T; label: string }[], picked: WritableSignal<T>): Choice[] =>
      options.map(({ value, label }) => ({ label, on: picked() === value, pick: () => picked.set(value) }));
    switch (this.mode()) {
      case 'agenda':
        return among(AGENDA_RANGES, this.range);
      case 'story':
        return among(STORY_DAYS, this.storyDay);
      case 'event':
        return among(EVENT_FORMATS, this.eventFormat);
      case 'lesson':
        return [];
    }
  });

  /** Undefined until they arrive. */
  protected readonly cities = toSignal(inject(CitiesService).getCities().pipe(catchError(() => of<CityDto[]>([]))));
  private readonly pickedCityId = signal<number | null>(null);
  /** The picked city, else the first one. */
  protected readonly city = computed(() => {
    const cities = this.cities() ?? [];
    return cities.find((city) => city.id === this.pickedCityId()) ?? cities[0] ?? null;
  });

  /** The lesson needs no events: the other modes wait for them. */
  protected readonly needsEvents = computed(() => this.mode() !== 'lesson');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  /** When the events were asked for: what "this weekend" is counted from. */
  private readonly now = signal(Date.now());

  /** The mode's events, soonest first: the agenda's period, the story's
   * night, or the week Serata picks from. None for a lesson. */
  private readonly events = computed(() => {
    const city = this.city();
    const mode = this.mode();
    if (!city || mode === 'lesson') return [];
    const now = this.now();
    const range = mode === 'agenda' ? this.range() : mode === 'story' ? this.storyDay() : 'week';
    return (this.cityEvents.entries().get(city.id)?.events ?? [])
      .filter((event) => inDateRange(event, range, now))
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  });

  /** Serata's picker: the week's nights. */
  protected readonly eventOptions = computed(() =>
    this.mode() === 'event' ? this.events().map((event) => ({ id: event.id, label: eventLabel(event) })) : [],
  );
  protected readonly pickedEvent = computed(
    () => this.events().find((event) => event.id === this.pickedEventId()) ?? this.events()[0] ?? null,
  );
  /** The events on the pictures: all of the mode's, or Serata's one. */
  private readonly shownEvents = computed(() => {
    if (this.mode() !== 'event') return this.events();
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
    const mode = this.mode();
    if (mode === 'lesson') return lessonDeck(this.lesson());
    const city = this.city();
    if (!city) return null;
    const mentions = this.mentions();
    const mentionsOf = (event: EventCardDto): string[] => mentions.get(event.id) ?? cardMentions(event);
    if (mode === 'event') {
      const event = this.pickedEvent();
      return event ? eventDeck(event, this.eventFormat(), city.name, mentionsOf) : null;
    }
    return mode === 'agenda'
      ? agendaDeck(this.events(), this.range(), city.name, this.now(), mentionsOf, this.detailed())
      : storyDeck(this.events(), this.storyDay(), city.name, this.now(), mentionsOf);
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
      const { width, height } = FRAMES[deck.format];
      canvases.forEach(({ nativeElement: canvas }, index) => {
        const card = deck.cards[index];
        if (!card) return;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) drawCard(ctx, deck.format, card, index, deck.cards.length, flyers);
      });
    });
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
