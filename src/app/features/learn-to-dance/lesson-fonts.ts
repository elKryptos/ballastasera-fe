/** The lesson's two display faces, the poster and the romance (see
 * lesson-look.css), for its pages alone: the lesson and its playlist. */
const FONTS_ID = 'lesson-fonts';
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Shrikhand&display=swap';

/** Adds them to <head>, once — during SSR too, so the first paint already
 * asks for them. */
export function loadLessonFonts(document: Document): void {
  if (document.getElementById(FONTS_ID)) return;
  const link = document.createElement('link');
  link.id = FONTS_ID;
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}
