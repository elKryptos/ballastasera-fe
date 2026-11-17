import { DanceLevel, DanceRole, Gender } from '../models/user.model';

/** How the dancer's profile reads, in "Il tuo account" and in someone's profile. The
 * Records keep each list complete: a new value in the backend fails here first. */
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Uomo',
  FEMALE: 'Donna',
  OTHER: 'Altro',
  UNDISCLOSED: 'Preferisco non dirlo',
};

export const DANCE_ROLE_LABELS: Record<DanceRole, string> = {
  LEADER: 'Leader',
  FOLLOWER: 'Follower',
  BOTH: 'Entrambi',
};

export const DANCE_LEVEL_LABELS: Record<DanceLevel, string> = {
  BEGINNER: 'Principiante',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzato',
  TEACHER: 'Insegnante',
};

/** In the order the forms show them: the keys of the labels. */
export const GENDERS = Object.keys(GENDER_LABELS) as Gender[];
export const DANCE_ROLES = Object.keys(DANCE_ROLE_LABELS) as DanceRole[];
export const DANCE_LEVELS = Object.keys(DANCE_LEVEL_LABELS) as DanceLevel[];

/** 1 to 4: how many chevrons the level's insignia has (4: the teacher's star), and which
 * .level-N colour it takes (styles.css), from green (beginner) to gold (teacher). */
export function levelRank(level: DanceLevel): number {
  return DANCE_LEVELS.indexOf(level) + 1;
}

/** As many as the backend takes (UserUpdateDto, @Size(max = 10)). */
export const MAX_DANCE_STYLES = 10;

/** The age range the backend accepts for the birth date (UserUpdateDto.isBirthDateValid). */
export const MIN_AGE = 16;
export const MAX_AGE = 100;
