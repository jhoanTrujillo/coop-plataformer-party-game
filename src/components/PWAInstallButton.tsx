import React, {useState} from 'react';
import {Download, Share, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall';
import {haptics} from '../utils/haptics';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          void install();
        }}
        className="arcade-btn inline-flex items-center gap-2 rounded-xl border-b-4 border-amber-700 bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md hover:bg-amber-300 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4 stroke-[2.5]" />
        Install App
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          setShowGuide(true);
        }}
        className="arcade-btn inline-flex items-center gap-2 rounded-xl border border-white/20 bg-slate-800/85 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        {isIOS ? 'Add to Home' : 'Install on Mobile'}
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display text-lg font-bold text-amber-300">
                Install Starhop Party on Phone
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                aria-label="Close install guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-3 space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-amber-400">1.</span>
                  <span>
                    Tap the <Share className="mx-1 inline h-4 w-4 text-sky-400" />
                    <strong>Share</strong> button in Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-amber-400">2.</span>
                  <span>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-amber-400">3.</span>
                  <span>Launch from your Home Screen for full-screen landscape play!</span>
                </li>
              </ol>
            ) : (
              <ol className="mt-3 space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-amber-400">1.</span>
                  <span>
                    Open the shared game URL in <strong>Chrome on Android</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-amber-400">2.</span>
                  <span>
                    Tap the <strong>⋮ menu</strong> and pick <strong>Install app</strong> (or{' '}
                    <strong>Add to Home screen</strong>).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-amber-400">3.</span>
                  <span>
                    No APK sideloading needed — launches full-screen in landscape and works offline
                    for Solo Run!
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/95 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-lg">
      <WifiOff className="h-3.5 w-3.5" />
      Offline Mode — Solo Run available locally
    </div>
  );
};
