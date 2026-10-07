import { Component, computed, input } from '@angular/core';
import { Dance } from '../lesson';
import { Reveal } from '../reveal.directive';
import { DanceStage } from '../stage/dance-stage';
import { LessonTonight } from '../tonight/lesson-tonight';

/** The CSS motif on a style's card, drawn after the way it moves. */
type Motif = 'circles' | 'lines' | 'zigzag' | 'dots' | 'mix' | 'waves';

interface Chapter {
  n: string;
  origin: string;
  intro: string;
  facts: { k: string; v: string }[];
  tips: { title: string; copy: string }[];
  styles: { name: string; motif: Motif; copy: string }[];
}

const CHAPTERS: Record<Dance, Chapter> = {
  salsa: {
    n: '02',
    origin: 'Cuba · Porto Rico · New York',
    intro:
      'Nasce a New York tra gli anni ’60 e ’70, dall’incontro tra il son cubano, il mambo e i musicisti portoricani. Si balla in coppia, veloce e giocosa, con tanti giri: una conversazione piena di battute.',
    facts: [
      { k: 'Conteggio', v: '1 2 3 · 5 6 7' },
      { k: 'Velocità', v: '160–220 bpm' },
      { k: 'Si muove', v: 'avanti e indietro' },
      { k: 'Carattere', v: 'brillante, festosa' },
    ],
    tips: [
      {
        title: 'Tutto il peso, ogni volta',
        copy: 'Ogni numero è un cambio di peso: se resti a metà tra i due piedi, il passo dopo arriva in ritardo.',
      },
      {
        title: 'Passi piccoli',
        copy: 'Il piede non va più lontano di una scarpa. Con la musica a 180, i passi lunghi semplicemente non ci stanno.',
      },
      {
        title: 'La pausa si balla',
        copy: 'Sul 4 e sull’8 i piedi stanno fermi, ma i fianchi finiscono il movimento. È lì che sta il sapore.',
      },
    ],
    styles: [
      {
        name: 'Cubana',
        motif: 'circles',
        copy: 'Detta anche casino: la coppia gira in cerchio, una attorno all’altra. Figure come guapea, dile que no, enchufla — e in gruppo diventa rueda.',
      },
      {
        name: 'In linea',
        motif: 'lines',
        copy: 'Si balla su un binario immaginario, scambiandosi di posto. Lo stile LA parte sull’1, quello di New York spesso sul 2.',
      },
      {
        name: 'Caleña',
        motif: 'zigzag',
        copy: 'Da Cali, Colombia: piedi velocissimi, saltellanti, e tanti passi da soli. La salsa più atletica.',
      },
    ],
  },
  bachata: {
    n: '03',
    origin: 'Repubblica Dominicana',
    intro:
      'Nasce nella Repubblica Dominicana negli anni ’60, tra chitarre e storie di cuori spezzati: la chiamavano música de amargue, musica dell’amarezza. Oggi è il ballo più romantico della serata — più lento, più vicino.',
    facts: [
      { k: 'Conteggio', v: '1 2 3 tap · 5 6 7 tap' },
      { k: 'Velocità', v: '120–140 bpm' },
      { k: 'Si muove', v: 'di lato, avanti e indietro' },
      { k: 'Carattere', v: 'romantica, morbida' },
    ],
    tips: [
      {
        title: 'Il tap è leggero',
        copy: 'Sul 4 e sull’8 il piede libero tocca il pavimento senza prendere peso. Se ci appoggi il peso, il passo dopo parte col piede sbagliato.',
      },
      {
        title: 'Le ginocchia fanno i fianchi',
        copy: 'Il movimento dell’anca non si spinge con la vita: nasce dalle ginocchia morbide, che si alternano a ogni passo.',
      },
      {
        title: 'Vicino, ma rilassato',
        copy: 'Si balla spesso in abbraccio chiuso: spalle basse, braccia morbide. La guida passa dal busto, non dalle mani.',
      },
    ],
    styles: [
      {
        name: 'Dominicana',
        motif: 'dots',
        copy: 'Quella delle origini: giochi di piedi rapidi e allegri, e un passo base che va anche avanti e indietro.',
      },
      {
        name: 'Moderna',
        motif: 'mix',
        copy: 'Quella delle serate: il passo laterale di sempre, qualche giro preso in prestito dalla salsa e un po’ di onde.',
      },
      {
        name: 'Sensual',
        motif: 'waves',
        copy: 'Nata in Spagna: movimenti lenti e fluidi, onde del corpo e inclinazioni, in grande contatto.',
      },
    ],
  },
};

/**
 * Chapters 02 and 03: one dance, each with its own art — salsa a striped
 * 50s poster under a sunburst, bachata an italic name under a moon, its
 * guitar strings strummed — then the stage, three things to know and the
 * styles you'll meet on the floor.
 */
@Component({
  selector: 'app-lesson-dance',
  imports: [DanceStage, LessonTonight, Reveal],
  templateUrl: './lesson-dance.html',
  styleUrl: './lesson-dance.css',
  host: { '[class]': '"is-" + dance()' },
})
export class LessonDance {
  readonly dance = input.required<Dance>();
  protected readonly chapter = computed(() => CHAPTERS[this.dance()]);
  protected readonly strings = [0, 1, 2, 3, 4, 5];
  protected readonly roman = ['I', 'II', 'III'];
}
