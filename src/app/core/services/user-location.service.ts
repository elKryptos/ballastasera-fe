import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoPoint } from '../utils/geo';

/** GPS on phones (desktop falls back to Wi-Fi/IP, so the fix can be off by
 * hundreds of metres), a reading up to a minute old is fine, and past 10s we
 * give up and say so. */
const LOCATE_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 };

/** Past this the fix is Wi-Fi/IP guesswork (desktops: often several km) —
 * good enough to move a map, not to promise "entro 1,5 km". */
export const PRECISE_FIX_METERS = 1000;

export interface UserPosition extends GeoPoint {
  /** Metres, as the browser reports it. */
  accuracy: number;
}

export type LocateResult = { ok: true; position: UserPosition } | { ok: false; message: string };

/**
 * The visitor's position, for "Intorno a me" on the map and the distances
 * and "Entro 3 km" of the list. Only ever asked from a tap, never on page
 * load: browsers penalise permission prompts nobody asked for, and visitors
 * tend to refuse them. The position never leaves the browser. The last fix is
 * kept for the visit, so locating on one page gives the other its distances.
 */
@Service()
export class UserLocationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly current = signal<UserPosition | null>(null);
  readonly position = this.current.asReadonly();
  private readonly busy = signal(false);
  readonly locating = this.busy.asReadonly();

  locate(): Promise<LocateResult> {
    if (!this.isBrowser) return Promise.resolve({ ok: false, message: 'Posizione non disponibile.' });
    if (!window.isSecureContext) {
      // Plain http (e.g. the dev server opened by LAN IP from a phone): the
      // browser refuses geolocation outright, so say why instead of "denied".
      return Promise.resolve({ ok: false, message: 'La posizione richiede una connessione sicura (HTTPS).' });
    }
    if (!('geolocation' in navigator)) {
      return Promise.resolve({ ok: false, message: 'Questo browser non supporta la geolocalizzazione.' });
    }

    this.busy.set(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          this.busy.set(false);
          const position = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy };
          this.current.set(position);
          resolve({ ok: true, position });
        },
        (error) => {
          this.busy.set(false);
          resolve({ ok: false, message: locateErrorMessage(error) });
        },
        LOCATE_OPTIONS,
      );
    });
  }
}

function locateErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Posizione non autorizzata: attivala nelle impostazioni del browser.';
    case error.TIMEOUT:
      return 'La posizione sta impiegando troppo, riprova.';
    default:
      return 'Impossibile trovare la tua posizione.';
  }
}
