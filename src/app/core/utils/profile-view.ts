import { DANCE_LEVEL_LABELS, DANCE_ROLE_LABELS, GENDER_LABELS } from '../config/dance-profile';
import { NIGHT_MILESTONES } from '../config/social';
import { DanceRole, Gender, UserDanceStyleDto, UserDto, UserProfileDto } from '../models/user.model';
import { firstNameOf } from './initials';

/** What a profile page shows of someone, whoever's it is: someone else's (UserProfileDto has all
 * of it) or one's own seen "come ti vedono" (ownProfileView). */
export type ProfileView = Pick<
  UserProfileDto,
  | 'userId'
  | 'displayName'
  | 'username'
  | 'avatarUrl'
  | 'instagram'
  | 'whatsapp'
  | 'age'
  | 'gender'
  | 'danceRole'
  | 'danceStyles'
  | 'bio'
  | 'schoolOrganizerId'
  | 'schoolName'
  | 'schoolSlug'
  | 'originCountry'
  | 'homeCityName'
  | 'followersCount'
  | 'followingCount'
  | 'eventsCount'
  | 'venuesCount'
  | 'memberSince'
>;

/** Whole years from a yyyy-MM-dd birth date to `today`. */
export function ageFrom(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age--;
  return age;
}

/** One's own profile the way the others see it: the age, not the date; the city only if shown. A
 * user kept in localStorage from before the social features lacks some fields: they read as none. */
export function ownProfileView(user: UserDto): ProfileView {
  return {
    userId: user.userId,
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl,
    instagram: user.instagram,
    whatsapp: user.whatsappVisibility === 'NOBODY' ? null : user.whatsapp,
    age: ageFrom(user.birthDate),
    gender: user.gender,
    danceRole: user.danceRole,
    danceStyles: user.danceStyles ?? [],
    bio: user.bio ?? null,
    schoolOrganizerId: user.schoolOrganizerId ?? null,
    schoolName: user.schoolName ?? null,
    schoolSlug: user.schoolSlug ?? null,
    originCountry: user.originCountry ?? null,
    homeCityName: user.showHomeCity ? (user.homeCity?.name ?? null) : null,
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    eventsCount: user.eventsCount ?? 0,
    venuesCount: user.venuesCount ?? 0,
    memberSince: user.memberSince ?? null,
  };
}

const COUNTRY_NAMES = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['it'], { type: 'region' }) : null;

/** "Colombia" from "CO", in Italian, from the browser's own list; the code itself if it has none. */
export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  try {
    return COUNTRY_NAMES?.of(code) ?? code;
  } catch {
    return code;
  }
}

export type ProfileChipKind = 'age' | 'gender' | 'role' | 'origin';

export interface ProfileChip {
  kind: ProfileChipKind;
  label: string;
}

/** Age, gender, role and country of origin, the ones given, for the chips next to the face.
 * "Preferisco non dirlo" is an answer for the form, not something to show. */
export function profileChips(view: Pick<ProfileView, 'age' | 'gender' | 'danceRole' | 'originCountry'>): ProfileChip[] {
  const chips: ProfileChip[] = [];
  if (view.danceRole) chips.push({ kind: 'role', label: DANCE_ROLE_LABELS[view.danceRole] });
  if (view.age != null) chips.push({ kind: 'age', label: `${view.age} anni` });
  if (view.gender && view.gender !== 'UNDISCLOSED') chips.push({ kind: 'gender', label: GENDER_LABELS[view.gender as Gender] });
  if (view.originCountry) chips.push({ kind: 'origin', label: countryName(view.originCountry) });
  return chips;
}

export type InCommonKind = 'style' | 'roles' | 'friends' | 'nights';

/** One row of "Avete in comune". */
export interface InCommonItem {
  kind: InCommonKind;
  title: string;
  text: string;
}

/** Two roles that fit on the floor: a leader and a follower, or anyone with someone who does both. */
function rolesFit(mine: DanceRole | null, theirs: DanceRole | null): boolean {
  if (!mine || !theirs) return false;
  if (mine === 'BOTH' || theirs === 'BOTH') return true;
  return mine !== theirs;
}

const ROLE_VERBS: Record<DanceRole, string> = { LEADER: 'guida', FOLLOWER: 'segue', BOTH: 'fa entrambi' };
const MY_ROLE_VERBS: Record<DanceRole, string> = { LEADER: 'guidi', FOLLOWER: 'segui', BOTH: 'fai entrambi' };

/** "Avete in comune", from the canvas (4c): the styles both dance (the first, at both levels), roles
 * that fit, friends both have (the backend's) and nights both went to. Only what there is. */
export function inCommon(me: UserDto, them: UserProfileDto, dateLabel: (iso: string) => string): InCommonItem[] {
  const items: InCommonItem[] = [];
  const firstName = firstNameOf(them.displayName);

  const myLevels = new Map((me.danceStyles ?? []).map((style) => [style.danceStyleId, style.level]));
  const shared = them.danceStyles.filter((style) => myLevels.has(style.danceStyleId));
  if (shared.length) {
    const first = shared[0];
    const mine = myLevels.get(first.danceStyleId)!;
    const text =
      mine === first.level
        ? `Tutti e due a livello ${DANCE_LEVEL_LABELS[mine]}`
        : `Tu ${DANCE_LEVEL_LABELS[mine]}, ${firstName} ${DANCE_LEVEL_LABELS[first.level]}`;
    const others = shared.length - 1;
    items.push({
      kind: 'style',
      title: others ? `${first.name} e altri ${others}` : first.name,
      text,
    });
  }

  if (rolesFit(me.danceRole, them.danceRole)) {
    items.push({
      kind: 'roles',
      title: 'Ruoli che si incastrano',
      text: `Tu ${MY_ROLE_VERBS[me.danceRole!]}, ${firstName} ${ROLE_VERBS[them.danceRole!]}`,
    });
  }

  if (them.mutualFriendsCount > 0) {
    const names = them.mutualFriends.map((friend) => firstNameOf(friend.displayName));
    const others = them.mutualFriendsCount - names.length;
    const who = others > 0 ? `${names.join(', ')} e altri ${others}` : joinNames(names);
    items.push({
      kind: 'friends',
      title: them.mutualFriendsCount === 1 ? '1 amico in comune' : `${them.mutualFriendsCount} amici in comune`,
      text: who,
    });
  }

  if (them.eventsTogetherCount > 0) {
    const last = them.lastEventTogetherTitle;
    const when = them.lastEventTogetherStartAt ? `, ${dateLabel(them.lastEventTogetherStartAt)}` : '';
    items.push({
      kind: 'nights',
      title: them.eventsTogetherCount === 1 ? '1 serata insieme' : `${them.eventsTogetherCount} serate insieme`,
      text: last ? `L'ultima: ${last}${when}` : '',
    });
  }

  return items;
}

/** "Sara e Luca", "Sara, Luca e Marco". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/** The styles the viewer dances too, for "anche tu" in "Cosa balla". */
export function sharedStyleIds(mine: UserDanceStyleDto[] | undefined, theirs: UserDanceStyleDto[]): Set<number> {
  const myIds = new Set((mine ?? []).map((style) => style.danceStyleId));
  return new Set(theirs.filter((style) => myIds.has(style.danceStyleId)).map((style) => style.danceStyleId));
}

/** The next goal in "Traguardi": the first milestone above the nights done, how many are missing and
 * how far along (0–100); null past the last. */
export function nextMilestone(eventsCount: number): { target: number; missing: number; percent: number } | null {
  const target = NIGHT_MILESTONES.find((milestone) => milestone > eventsCount);
  if (target === undefined) return null;
  return { target, missing: target - eventsCount, percent: Math.round((eventsCount / target) * 100) };
}

export type ProfileStepKey = 'photo' | 'styles' | 'bio' | 'instagram' | 'school';

/** One thing that makes a profile say who someone is, for "Completa il profilo" (canvas 4). */
export interface ProfileStep {
  key: ProfileStepKey;
  done: boolean;
  /** In "Fatto: foto, cosa balli". */
  doneLabel: string;
  /** The row that leads to it, while it's missing. */
  todoLabel: string;
}

/** The five steps of "Completa il profilo", in the order they're suggested. */
export function profileSteps(user: UserDto): ProfileStep[] {
  return [
    { key: 'photo', done: !!user.avatarUrl, doneLabel: 'foto', todoLabel: 'Aggiungi una foto' },
    { key: 'styles', done: (user.danceStyles ?? []).length > 0, doneLabel: 'cosa balli', todoLabel: 'Di\' cosa balli e a che livello' },
    { key: 'bio', done: !!user.bio?.trim(), doneLabel: 'bio', todoLabel: 'Scrivi due righe su di te' },
    { key: 'instagram', done: !!user.instagram, doneLabel: 'Instagram', todoLabel: 'Aggiungi il tuo Instagram' },
    { key: 'school', done: !!user.schoolName, doneLabel: 'scuola', todoLabel: 'Indica la tua scuola o crew' },
  ];
}
