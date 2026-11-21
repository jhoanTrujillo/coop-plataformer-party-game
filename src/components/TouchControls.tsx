import React, {useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUp, Bomb, Hand} from 'lucide-react';
import {haptics} from '../utils/haptics';

interface TouchControlsProps {
  holdingItem: boolean;
  canDoubleJump: boolean;
  onDirectionChange: (left: boolean, right: boolean) => void;
  onJumpChange: (held: boolean, pressedEdge: boolean) => void;
  onGrabPress: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  holdingItem,
  canDoubleJump,
  onDirectionChange,
  onJumpChange,
  onGrabPress,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const padPointerId = useRef<number | null>(null);
  const jumpPointerId = useRef<number | null>(null);
  const [dirState, setDirState] = useState<'none' | 'left' | 'right'>('none');
  const [jumpDown, setJumpDown] = useState(false);
  const [grabFlash, setGrabFlash] = useState(false);

  const updatePadFromClientX = (clientX: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = (clientX - rect.left) / rect.width;
    const next: 'none' | 'left' | 'right' = rel < 0.45 ? 'left' : rel > 0.55 ? 'right' : 'none';
    setDirState((prev) => {
      if (prev !== next) {
        if (next !== 'none') haptics.tap();
        onDirectionChange(next === 'left', next === 'right');
      }
      return next;
    });
  };

  const handlePadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    padPointerId.current = e.pointerId;
    updatePadFromClientX(e.clientX);
  };

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (padPointerId.current !== e.pointerId) return;
    e.preventDefault();
    updatePadFromClientX(e.clientX);
  };

  const handlePadUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (padPointerId.current !== e.pointerId) return;
    e.preventDefault();
    padPointerId.current = null;
    setDirState('none');
    onDirectionChange(false, false);
  };

  const handleJumpDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    jumpPointerId.current = e.pointerId;
    setJumpDown(true);
    haptics.jump();
    onJumpChange(true, true);
  };

  const handleJumpUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (jumpPointerId.current !== e.pointerId) return;
    e.preventDefault();
    jumpPointerId.current = null;
    setJumpDown(false);
    onJumpChange(false, false);
  };

  const handleGrabDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setGrabFlash(true);
    if (holdingItem) haptics.throwItem();
    else haptics.grab();
    onGrabPress();
    window.setTimeout(() => setGrabFlash(false), 140);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-between px-4 pb-3 sm:px-7 sm:pb-5">
      {/* Left Thumb: Seamless Slide-Across D-Pad */}
      <div
        ref={padRef}
        onPointerDown={handlePadDown}
        onPointerMove={handlePadMove}
        onPointerUp={handlePadUp}
        onPointerCancel={handlePadUp}
        className="pointer-events-auto flex items-center gap-2 rounded-3xl border border-white/20 bg-slate-950/55 p-2 backdrop-blur-md shadow-xl"
        aria-label="Movement controls"
      >
        <div
          data-pressed={dirState === 'left'}
          className={`arcade-btn flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-2xl border-b-4 transition-colors ${
            dirState === 'left'
              ? 'border-sky-700 bg-sky-500 text-white shadow-inner'
              : 'border-slate-900 bg-slate-800/90 text-slate-100'
          }`}
        >
          <ArrowLeft className="h-8 w-8 stroke-[2.75]" />
        </div>
        <div
          data-pressed={dirState === 'right'}
          className={`arcade-btn flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-2xl border-b-4 transition-colors ${
            dirState === 'right'
              ? 'border-sky-700 bg-sky-500 text-white shadow-inner'
              : 'border-slate-900 bg-slate-800/90 text-slate-100'
          }`}
        >
          <ArrowRight className="h-8 w-8 stroke-[2.75]" />
        </div>
      </div>

      {/* Right Thumb: Tactile GRAB/THROW + JUMP Arcade Buttons */}
      <div className="pointer-events-auto flex items-end gap-3.5 sm:gap-4">
        <button
          type="button"
          data-pressed={grabFlash}
          onPointerDown={handleGrabDown}
          className={`arcade-btn relative flex h-18 w-18 sm:h-20 sm:w-20 flex-col items-center justify-center rounded-full border-b-[5px] font-display text-xs font-bold tracking-wide text-white shadow-xl ${
            holdingItem
              ? 'border-amber-800 bg-gradient-to-b from-amber-400 to-orange-600 ring-4 ring-amber-300/60'
              : 'border-rose-900 bg-gradient-to-b from-rose-500 to-red-600'
          }`}
          aria-label={holdingItem ? 'Throw held item' : 'Grab item'}
        >
          {holdingItem ? (
            <Bomb className="h-6 w-6 stroke-[2.5]" />
          ) : (
            <Hand className="h-6 w-6 stroke-[2.5]" />
          )}
          <span className="mt-0.5 text-[11px] leading-none whitespace-nowrap">
            {holdingItem ? 'THROW' : 'GRAB'}
          </span>
        </button>

        <button
          type="button"
          data-pressed={jumpDown}
          onPointerDown={handleJumpDown}
          onPointerUp={handleJumpUp}
          onPointerCancel={handleJumpUp}
          className={`arcade-btn relative flex h-20 w-20 sm:h-22 sm:w-22 flex-col items-center justify-center rounded-full border-b-[5px] font-display text-xs font-bold tracking-wide text-white shadow-xl ${
            jumpDown
              ? 'border-emerald-900 bg-emerald-500'
              : 'border-emerald-800 bg-gradient-to-b from-emerald-400 to-emerald-600'
          }`}
          aria-label="Jump or puff double jump"
        >
          <ArrowUp className="h-7 w-7 stroke-[2.75]" />
          <span className="mt-0.5 text-[11px] leading-none whitespace-nowrap">
            {canDoubleJump ? 'PUFF' : 'JUMP'}
          </span>
        </button>
      </div>
    </div>
  );
};
