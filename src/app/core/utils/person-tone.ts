/** A colour for someone without a photo (behind their initial) and for their profile's header:
 * the canvas' sky, mint, yellow, orange, pink, lilac and green, each with a dark text that
 * reads on it. */
export interface PersonTone {
  bg: string;
  fg: string;
}

const TONES: PersonTone[] = [
  { bg: '#6aa8ff', fg: '#0d1a33' },
  { bg: '#2ee6c5', fg: '#0e2a26' },
  { bg: '#f5c04a', fg: '#2a1d05' },
  { bg: '#ff9f6a', fg: '#2a1405' },
  { bg: '#ff7a9c', fg: '#2a0a14' },
  { bg: '#c9b8ff', fg: '#1a0e2e' },
  { bg: '#9fd36a', fg: '#15240a' },
];

/** Always the same tone for the same person: in the list of who's going and in their profile. */
export function personTone(userId: string): PersonTone {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
