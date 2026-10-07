/**
 * The parts of Spotify's iFrame API the playlist uses — see
 * https://developer.spotify.com/documentation/embeds/references/iframe-api.
 */
export interface SpotifyController {
  play(): void;
  togglePlay(): void;
  destroy(): void;
  addListener(event: 'ready', listener: () => void): void;
  addListener(event: 'playback_update', listener: (e: { data: { isPaused: boolean } }) => void): void;
}

export interface SpotifyIFrameApi {
  /** Replaces `target` with the player's iframe; `ready` gets its controller. */
  createController(
    target: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    ready: (controller: SpotifyController) => void,
  ): void;
}

const SCRIPT = 'https://open.spotify.com/embed/iframe-api/v1';

let loading: Promise<SpotifyIFrameApi> | undefined;

/**
 * Spotify's iFrame API, loaded on first use only: it's a third-party script,
 * so nothing of Spotify's reaches the page before someone opens a song.
 * Rejects if the script can't load (blocked, offline), and lets a later call
 * try again.
 */
export function spotifyApi(doc: Document): Promise<SpotifyIFrameApi> {
  loading ??= new Promise<SpotifyIFrameApi>((resolve, reject) => {
    const win = doc.defaultView as Window & { onSpotifyIframeApiReady?: (api: SpotifyIFrameApi) => void };
    win.onSpotifyIframeApiReady = resolve;
    const script = doc.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error('Spotify iFrame API unavailable'));
    };
    doc.head.appendChild(script);
  });
  return loading;
}
