import { Dance } from './lesson';

/** The lesson's words, apart from the components that lay them out: the
 * chapters read them, and so do the Instagram carousels made from the lesson
 * (admin/social-posts), so the two never say different things. */

/** Chapter 01: counting before stepping. */
export const RHYTHM_TIPS = [
  {
    title: 'Conta in otto',
    copy: 'Due battute da quattro: 1-2-3-4, 5-6-7-8. Ogni numero è un battito, e i passi vanno su quei numeri — non tra uno e l’altro.',
  },
  {
    title: 'Trova l’1',
    copy: 'È l’inizio della frase musicale, dove il pezzo sembra “ripartire”. Spesso è lì che entra la voce o cambia il giro del piano o della chitarra.',
  },
  {
    title: 'Prima le mani',
    copy: 'Metti un brano e batti le mani sull’1 e sul 5, senza muovere i piedi. Quando ti viene naturale, sei pronto per il passo base.',
  },
];

/** The CSS motif on a style's card, drawn after the way it moves. */
export type Motif = 'circles' | 'lines' | 'zigzag' | 'dots' | 'mix' | 'waves';

export interface DanceChapter {
  n: string;
  origin: string;
  intro: string;
  facts: { k: string; v: string }[];
  tips: { title: string; copy: string }[];
  styles: { name: string; motif: Motif; copy: string }[];
}

/** Chapters 02 and 03: what the lesson says about each dance. */
export const DANCE_CHAPTERS: Record<Dance, DanceChapter> = {
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

/** Chapter 04: what leading and following each ask of you. */
export const COUPLE_PRINCIPLES = [
  {
    title: 'Il telaio',
    copy: 'Braccia tonificate, gomiti davanti al corpo, spalle basse. Né spaghetti né legno: un elastico teso.',
  },
  {
    title: 'Chi guida propone',
    copy: 'Prepara la figura un tempo prima, col corpo prima che con le mani. Una proposta chiara, mai una spinta.',
  },
  {
    title: 'Chi segue interpreta',
    copy: 'Aspetta il segnale invece di indovinarlo, e ci mette il suo stile. Seguire è un’abilità, non un ruolo passivo.',
  },
  {
    title: 'Guarda il partner',
    copy: 'Non i piedi: la connessione passa anche dagli occhi. E da un sorriso.',
  },
];

/** Chapter 04's dance card: the floor's manners. */
export const FLOOR_MANNERS = [
  'Si invita con un sorriso, e si accetta un «no» con lo stesso sorriso.',
  'A fine brano si ringrazia. Sempre.',
  'Alle prime armi? Dillo prima di iniziare: ci siamo passati tutti.',
  'Pista piena, figure piccole: i gomiti restano nel proprio spazio.',
  'Una maglietta di ricambio e una mentina fanno parte del kit.',
];

/** Chapter 05: the beginner's classics, each with its fix. */
export const MISTAKES = [
  { wrong: 'Guardare i piedi', right: 'Guarda il partner: i piedi sanno dove andare.' },
  { wrong: 'Fare passi lunghi', right: 'Passi piccoli, sempre sotto il corpo.' },
  { wrong: 'Saltare la pausa', right: 'Conta ad alta voce, almeno le prime volte.' },
  { wrong: 'Stringere la mano', right: 'Presa leggera: si guida col corpo, non con le dita.' },
  { wrong: 'Fermarsi a ogni errore', right: 'Resta a tempo: l’errore passa, il ritmo resta.' },
  { wrong: 'Ballare in apnea', right: 'Respira, sorridi, e se ti perdi riparti dall’1.' },
];
