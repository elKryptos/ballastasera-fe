/** A person's initial, for an avatar without a photo: the menu's profile card, the account, "Chi ci va". */
export function initialOf(name: string | null | undefined): string {
  return name?.trim().charAt(0).toUpperCase() ?? '';
}

/** A person's first name ("Sara" from "Sara M."), to speak of them: "Sara e Luca partecipano". */
export function firstNameOf(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}
