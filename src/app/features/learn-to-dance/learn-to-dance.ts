import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SidebarPushDirective } from '../../shared/directives/sidebar-push.directive';
import { LessonCouple } from './couple/lesson-couple';
import { LessonDance } from './dance/lesson-dance';
import { LessonHero } from './hero/lesson-hero';
import { LessonClock, SCHOOLS_PATH } from './lesson';
import { LessonMistakes } from './mistakes/lesson-mistakes';
import { LessonMixtape } from './mixtape/lesson-mixtape';
import { LessonRhythm } from './rhythm/lesson-rhythm';
import { SchoolCall } from './school-call/school-call';
import { LessonTurntable } from './turntable/lesson-turntable';

/** The lesson's two display faces, on this page only: the poster and the romance. */
const FONTS_ID = 'lesson-fonts';
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Shrikhand&display=swap';

const CHAPTERS = [
  { id: 'ritmo', n: '01', label: 'Ritmo' },
  { id: 'salsa', n: '02', label: 'Salsa' },
  { id: 'bachata', n: '03', label: 'Bachata' },
  { id: 'coppia', n: '04', label: 'In coppia' },
  { id: 'errori', n: '05', label: 'Errori' },
  { id: 'playlist', n: '06', label: 'Playlist' },
] as const;

/**
 * /impara-a-ballare: a salsa and bachata lesson, start to finish on one
 * page — rhythm, both basic steps on an animated floor, dancing as a pair,
 * the usual mistakes, music to practise on — and a call to find a dance
 * school, before the cover and again at the end (SchoolCall). No
 * backend call: the text is written here, the band's samples are the app's
 * own static files, and Spotify loads only when a song is opened.
 *
 * It has its own look, apart from the rest of the site: a night-club poster
 * (warm black, marigold and fire for salsa, bougainvillea and lagoon for
 * bachata), with Shrikhand and Instrument Serif loaded for it alone. The
 * palette is defined on this host and read by every chapter below it.
 */
@Component({
  selector: 'app-learn-to-dance',
  imports: [
    SidebarPushDirective,
    RouterLink,
    LessonHero,
    SchoolCall,
    LessonRhythm,
    LessonDance,
    LessonCouple,
    LessonMistakes,
    LessonMixtape,
  ],
  providers: [LessonClock],
  templateUrl: './learn-to-dance.html',
  styleUrl: './learn-to-dance.css',
})
export class LearnToDance {
  private readonly document = inject(DOCUMENT);
  private readonly clock = inject(LessonClock);

  protected readonly chapters = CHAPTERS;
  /** The chapter bar's pinned way to the schools. */
  protected readonly schools = SCHOOLS_PATH;
  /** The chapter under the reading line, lit in the chapter bar. */
  protected readonly active = signal<string>('');
  /** The cover's record, while it plays: it carries on as the page scrolls, so a way to stop it follows along. */
  protected readonly onAir = computed(() => {
    const playing = this.clock.playing();
    return playing instanceof LessonTurntable ? playing : null;
  });

  constructor() {
    // Added to <head> during SSR too, so the first paint already asks for them.
    if (!this.document.getElementById(FONTS_ID)) {
      const link = this.document.createElement('link');
      link.id = FONTS_ID;
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      this.document.head.appendChild(link);
    }

    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      // A thin band across the upper middle of the screen: the chapter
      // crossing it is the one being read.
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) this.setActive(entry.target.id, host);
          }
        },
        { rootMargin: '-35% 0px -60% 0px' },
      );
      for (const { id } of CHAPTERS) {
        const section = host.querySelector(`#${id}`);
        if (section) observer.observe(section);
      }
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Lights the chapter and, on a narrow bar, slides its pill into view. */
  private setActive(id: string, host: HTMLElement): void {
    this.active.set(id);
    const list = host.querySelector<HTMLElement>('.chapters ol');
    const pill = list?.children[CHAPTERS.findIndex((c) => c.id === id)] as HTMLElement | undefined;
    if (!list || !pill || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: pill.offsetLeft - (list.clientWidth - pill.offsetWidth) / 2, behavior: 'smooth' });
  }

  protected stopRecord(): void {
    this.clock.stop();
  }

  protected scrollTo(id: string): void {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.document.getElementById(id)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }
}
