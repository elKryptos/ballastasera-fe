import { PageSeo } from '../services/seo.service';

/** The fixed pages' titles and descriptions for search engines and link
 * previews, set on their routes as `data: { seo }` (see SeoService). In
 * Italian only, like the home's in index.html: what a crawler is served. An
 * event's and a venue's come from their data, in their own components. */
export const PAGE_SEO = {
  lista: {
    title: 'Serate di salsa e bachata a Milano, giorno per giorno',
    description:
      'La lista delle serate latine di Milano, notte per notte: salsa, bachata e reggaeton con orari, prezzi e locali. Filtra per stile, giorno e distanza.',
  },
  mappa: {
    title: 'Mappa delle serate di salsa e bachata a Milano',
    description:
      'Dove si balla stasera vicino a te: le serate di salsa e bachata di Milano sulla mappa, con i locali e le scuole di ballo.',
  },
  lesson: {
    title: 'Impara a ballare salsa e bachata: ritmo e passo base',
    description:
      'Non serve talento: serve saper contare fino a otto. Il ritmo, il passo base di salsa e bachata, come si balla in coppia e gli errori che facciamo tutti.',
  },
  playlist: {
    title: 'Playlist di salsa e bachata: musica da ballare',
    description:
      'Salsa e bachata, dai classici ai pezzi più recenti: una playlist per esercitarti, lato A per la salsa e lato B per la bachata.',
  },
  scuole: {
    title: 'Scuole di salsa e bachata a Milano',
    description:
      'Dove imparare salsa e bachata a Milano: le scuole di ballo con indirizzo e contatti, in elenco o sulla mappa, anche vicino a te.',
  },
} satisfies Record<string, PageSeo>;
