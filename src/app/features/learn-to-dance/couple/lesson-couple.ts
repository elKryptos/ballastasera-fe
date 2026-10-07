import { Component } from '@angular/core';
import { LessonHeading } from '../heading/lesson-heading';
import { Reveal } from '../reveal.directive';

/**
 * Chapter 04: dancing as two. A pair of partners orbiting the one centre
 * they share — a half turn, a held beat, the other half — beside what
 * leading and following each ask of you; then the floor's manners, set as
 * an old ballroom dance card (a carnet de bal).
 */
@Component({
  selector: 'app-lesson-couple',
  imports: [LessonHeading, Reveal],
  templateUrl: './lesson-couple.html',
  styleUrl: './lesson-couple.css',
})
export class LessonCouple {
  protected readonly principles = [
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

  protected readonly manners = [
    'Si invita con un sorriso, e si accetta un «no» con lo stesso sorriso.',
    'A fine brano si ringrazia. Sempre.',
    'Alle prime armi? Dillo prima di iniziare: ci siamo passati tutti.',
    'Pista piena, figure piccole: i gomiti restano nel proprio spazio.',
    'Una maglietta di ricambio e una mentina fanno parte del kit.',
  ];
}
