/** A person's initial, for an avatar without a photo: the menu's profile card and the account. */
export function initialOf(name: string | null | undefined): string {
  return name?.trim().charAt(0).toUpperCase() ?? '';
}
