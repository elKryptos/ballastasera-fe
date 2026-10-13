import { DOCUMENT } from '@angular/common';
import { Service, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** What a page says about itself to search engines and link previews. */
export interface PageSeo {
  /** Without the site's name: " | ballastasera" is added here. */
  title: string;
  description: string;
}

/** The one indexable origin (see server.ts): staging's pages point here too. */
const ORIGIN = 'https://ballastasera.it';

/** The home's own tags, as written in index.html — keep them in sync. What a
 * page without tags of its own goes back to. */
const HOME = {
  title: 'ballastasera — Dove andare a ballare stasera | Salsa e bachata a Milano',
  description:
    "Dove andare a ballare stasera? Salsa, bachata e reggaeton: tutte le serate latine di Milano in un posto solo, aggiornate giorno per giorno. Stiamo arrivando anche nel resto d'Italia.",
  shareTitle: 'ballastasera — Dove andare a ballare stasera?',
  shareDescription:
    "Salsa, bachata e reggaeton: tutte le serate latine di Milano in un posto solo, aggiornate giorno per giorno. Stiamo arrivando anche nel resto d'Italia.",
};

/**
 * Each page's own title, description and canonical URL. index.html carries
 * the home's, and every page used to go out with those: all of them told
 * Google they were a copy of the home, so only the home was indexed.
 *
 * As the router's TitleStrategy it runs after every navigation: a route with
 * `data: { seo }` (the fixed pages, see app.routes.ts) gets its tags there;
 * one without goes back to the home's, and a page that only knows what to
 * say once its data is in (an event, a venue) calls set() itself.
 *
 * The home is never written to on the way out of the server: until a page
 * has set something, reset() leaves index.html's head exactly as it is.
 */
@Service()
export class SeoService extends TitleStrategy {
  private readonly document = inject(DOCUMENT);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private changed = false;

  override updateTitle(state: RouterStateSnapshot): void {
    let route = state.root;
    while (route.firstChild) route = route.firstChild;
    const seo = route.data['seo'] as PageSeo | undefined;
    if (seo) this.set(seo, state.url.split(/[?#]/)[0]);
    else this.reset();
  }

  /** `path` is the page's own, without query: the canonical URL. */
  set(seo: PageSeo, path: string): void {
    this.changed = true;
    this.write(`${seo.title} | ballastasera`, seo.description, seo.title, seo.description, `${ORIGIN}${path}`);
  }

  private reset(): void {
    if (!this.changed) return;
    this.changed = false;
    this.write(HOME.title, HOME.description, HOME.shareTitle, HOME.shareDescription, `${ORIGIN}/`);
  }

  private write(title: string, description: string, shareTitle: string, shareDescription: string, url: string): void {
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:title', content: shareTitle });
    this.meta.updateTag({ property: 'og:description', content: shareDescription });
    this.meta.updateTag({ name: 'twitter:title', content: shareTitle });
    this.meta.updateTag({ name: 'twitter:description', content: shareDescription });
    this.document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
  }
}

/** A text of any length and shape (line breaks, emoji lists) as one line of
 * at most `max` characters, cut at a word. */
export function clip(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (line.length <= max) return line;
  const cut = line.lastIndexOf(' ', max - 1);
  return `${line.slice(0, cut > 0 ? cut : max - 1).replace(/[\s,;:.·-]+$/, '')}…`;
}
