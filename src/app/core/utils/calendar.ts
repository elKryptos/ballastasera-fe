/** An .ics file holding one event — "+ Calendario" on the event's page. A
 * file rather than a link to one calendar: whichever the device has (Apple,
 * Google, Outlook) offers to add it. Times go in UTC, so no time zone block
 * is needed. */
export function eventIcs(
  event: { id: string; title: string; startAt: string; endAt: string; address: string; venueName: string | null },
  pageUrl: string,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ballastasera//IT',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@ballastasera.it`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(event.startAt)}`,
    `DTEND:${icsTime(event.endAt)}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(event.venueName ? `${event.venueName}, ${event.address}` : event.address)}`,
    `URL:${pageUrl}`,
    `DESCRIPTION:${icsText(pageUrl)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** "2026-10-05T18:30:00Z" → "20261005T183000Z". */
function icsTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

/** Backslashes, commas, semicolons and line breaks are escaped in text values. */
function icsText(text: string): string {
  return text.replace(/[\\,;]/g, (char) => `\\${char}`).replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets carry on in the next one, after a space. Cut
 * every 60 characters, so even accented text stays under the limit. */
function fold(line: string): string {
  return line.match(/.{1,60}/gu)?.join('\r\n ') ?? line;
}
