import React, {useEffect, useState} from 'react';
import {Maximize2, RotateCcw} from 'lucide-react';
import {haptics} from '../utils/haptics';

export const LandscapeGuard: React.FC = () => {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
      setIsPortraitMobile(portrait);
      if (!portrait) setDismissed(false);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  const requestLandscapeFullscreen = async () => {
    haptics.tap();
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const orient = screen.orientation as unknown as {lock?: (o: string) => Promise<void>};
      if (orient && typeof orient.lock === 'function') {
        await orient.lock('landscape');
      }
    } catch {
      // Some mobile browsers require manual rotation
    }
  };

  if (!isPortraitMobile || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 px-6 text-center backdrop-blur-md">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/15 text-amber-300">
        <RotateCcw className="h-8 w-8" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold text-white">
        Rotate Phone to Landscape
      </h2>
      <p className="mt-2 max-w-xs text-sm text-slate-300">
        Starhop Party is built for wide horizontal play with dual-thumb arcade controls.
      </p>
      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => void requestLandscapeFullscreen()}
          className="arcade-btn inline-flex items-center justify-center gap-2 rounded-xl border-b-4 border-amber-700 bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg"
        >
          <Maximize2 className="h-4 w-4" />
          Enter Fullscreen Landscape
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
};
