import { useEffect, useState } from 'react';

/**
 * Tracks the Electron window's fullscreen state, kept in sync with the OS via
 * the preload bridge (initial read + live `onFullscreenChange` updates). Returns
 * `false` in browser dev where `window.app` is absent. Used to swap the header's
 * maximise/minimise icon and to drop the app's rounded corners in fullscreen.
 */
export function useFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    window.app?.isFullscreen().then((value) => {
      if (active) setIsFullscreen(value);
    });
    const unsubscribe = window.app?.onFullscreenChange(setIsFullscreen);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return isFullscreen;
}
