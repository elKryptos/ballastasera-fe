let webGLSupport: boolean | undefined;

/** MapLibre draws with WebGL. Checked up front (once, then cached) because
 * without it MapLibre fails halfway through setting up and leaves an empty
 * container behind — callers put a fallback there instead (see map.ts and
 * MapPreview). Browser only. */
export function supportsWebGL(): boolean {
  if (webGLSupport === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
      webGLSupport = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webGLSupport = false;
    }
  }
  return webGLSupport;
}
