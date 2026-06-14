import { useEffect, useState } from 'react';

/**
 * Tracks the Electron window's fullscreen state via the preload bridge
 * (electron/preload.ts). Returns false outside Electron (e.g. browser preview).
 */
export function useFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let mounted = true;
    window.app?.isFullscreen().then((value) => {
      if (mounted) setIsFullscreen(value);
    });
    const unsubscribe = window.app?.onFullscreenChange(setIsFullscreen);
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  return isFullscreen;
}
