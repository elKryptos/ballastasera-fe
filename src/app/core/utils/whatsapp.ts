/** The backend's rule for a WhatsApp number (UserUpdateDto.whatsapp): E.164, a + and 7 to 15 digits. */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/** A number the way people write it ("333 123 4567", "+39 333-123.4567", "0039 333…")
 * the way the backend stores it ("+393331234567"): spaces, dashes, dots and brackets
 * go, a leading 00 becomes +, and without a + it's taken as Italian (+39). Empty stays
 * empty. It doesn't check the result: that's E164_PATTERN's job. */
export function normalizeWhatsapp(value: string | null | undefined): string {
  let number = (value ?? '').replace(/[\s\-.()]/g, '');
  if (!number) return '';
  if (number.startsWith('00')) number = `+${number.slice(2)}`;
  if (!number.startsWith('+')) number = `+39${number}`;
  return number;
}

export function isValidWhatsapp(value: string | null | undefined): boolean {
  return E164_PATTERN.test(normalizeWhatsapp(value));
}
