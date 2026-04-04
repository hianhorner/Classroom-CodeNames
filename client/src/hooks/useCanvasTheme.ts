import { useEffect } from 'react';

export type CanvasTheme = 'red' | 'blue' | 'silver';

export function useCanvasTheme(theme: CanvasTheme | null | undefined) {
  useEffect(() => {
    if (!theme) {
      return;
    }

    document.documentElement.dataset.canvasTheme = theme;
  }, [theme]);
}
