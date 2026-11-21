import React from 'react';
import {
  Gamepad2,
  Heart,
  LogOut,
  Shield,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  Wind,
  Bomb,
} from 'lucide-react';
import {PowerUpType, WorldState} from '../shared/types';
import {haptics} from '../utils/haptics';

interface GameHudProps {
  world: WorldState;
  localPlayerId: string;
  muted: boolean;
  showTouchControls: boolean;
  onToggleMute: () => void;
  onToggleTouch: () => void;
  onExitMatch: () => void;
}

const POWERUP_META: Record<PowerUpType, {label: string; color: string}> = {
  none: {label: '', color: ''},
  mega_bomb: {label: 'Mega Bombs', color: 'text-rose-300'},
  wing_cap: {label: 'Winged Cap', color: 'text-sky-300'},
  star_shield: {label: 'Star Shield', color: 'text-purple-300'},
  gold_magnet: {label: '2x Magnet', color: 'text-amber-300'},
};

export const GameHud: React.FC<GameHudProps> = ({
  world,
  localPlayerId,
  muted,
  showTouchControls,
  onToggleMute,
  onToggleTouch,
  onExitMatch,
}) => {
  const me = world.players.find((p) => p.id === localPlayerId) ?? world.players[0];
  const boss = world.boss;
  const secs = Math.ceil(world.timeRemaining);
  const lowTime = secs <= 20;

  return (
    <>
      {/* Ultra-compact Top HUD Strip (<= 11% viewport height) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-slate-950/85 via-slate-950/55 to-transparent px-3 py-2 sm:px-5">
        {/* Left: Lives & Power-Up */}
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/75 px-3 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1" aria-label={`${me?.lives ?? 0} lives remaining`}>
            {[0, 1, 2].map((idx) => (
              <Heart
                key={idx}
                className={`h-4 w-4 ${
                  idx < (me?.lives ?? 0)
                    ? 'fill-rose-500 text-rose-500'
                    : 'text-slate-600'
                }`}
              />
            ))}
          </div>

          <span className="hidden text-xs text-slate-500 sm:inline" aria-hidden="true">
            |
          </span>

          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-mono-num">{(me?.score ?? 0).toLocaleString()}</span>
          </div>

          {me && me.powerUp !== 'none' && (
            <div className={`hidden items-center gap-1 text-xs font-bold sm:flex ${POWERUP_META[me.powerUp].color}`}>
              {me.powerUp === 'mega_bomb' && <Bomb className="h-3.5 w-3.5" />}
              {me.powerUp === 'wing_cap' && <Wind className="h-3.5 w-3.5" />}
              {me.powerUp === 'star_shield' && <Shield className="h-3.5 w-3.5" />}
              {me.powerUp === 'gold_magnet' && <Sparkles className="h-3.5 w-3.5" />}
              <span className="whitespace-nowrap">{POWERUP_META[me.powerUp].label}</span>
            </div>
          )}
        </div>

        {/* Center: Stage Title / Boss HP Bar + Timer */}
        <div className="flex flex-col items-center">
          {boss && boss.action !== 'defeated' ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-slate-950/80 px-3 py-1 backdrop-blur-md">
              <span className="font-display text-xs font-bold text-rose-300 whitespace-nowrap">
                {boss.name}
              </span>
              <div className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-800 sm:w-44">
                <div
                  className={`h-full transition-all duration-150 ${
                    boss.phase === 2 ? 'bg-gradient-to-r from-red-500 to-amber-400' : 'bg-rose-500'
                  }`}
                  style={{width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`}}
                />
              </div>
              <span className="font-mono-num text-[11px] font-bold text-slate-200">
                {boss.hp}/{boss.maxHp}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-950/75 px-3 py-1.5 text-xs backdrop-blur-md">
              <span className="font-display font-bold text-white whitespace-nowrap">
                {world.stageName}
              </span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span
                className={`font-mono-num font-bold ${
                  lowTime ? 'text-rose-400' : 'text-sky-300'
                }`}
              >
                {secs}s
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Controls (Touch Pad Toggle, Mute, Exit) */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onToggleTouch();
            }}
            title="Toggle on-screen touch buttons"
            className={`arcade-btn flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md ${
              showTouchControls
                ? 'border-sky-400/50 bg-sky-500/25 text-sky-200'
                : 'border-white/15 bg-slate-950/75 text-slate-300 hover:bg-slate-800'
            }`}
            aria-label="Toggle touch buttons"
          >
            <Gamepad2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onToggleMute();
            }}
            className="arcade-btn flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/75 text-slate-200 backdrop-blur-md hover:bg-slate-800"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onExitMatch();
            }}
            title="Leave match"
            className="arcade-btn flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/75 text-slate-300 backdrop-blur-md hover:bg-rose-950 hover:text-rose-200"
            aria-label="Exit match"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stage Clear Intermission Banner */}
      {world.phase === 'stage_clear' && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          <div className="rounded-3xl border-2 border-amber-300/70 bg-slate-950/85 px-8 py-5 text-center shadow-2xl backdrop-blur-md">
            <div className="font-display text-3xl font-bold text-amber-300 sm:text-4xl">
              {world.stageIndex >= world.totalStages - 1 ? 'MATCH COMPLETE!' : 'STAGE CLEAR!'}
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {world.stageIndex >= world.totalStages - 1
                ? 'Tallying Bonus Stars for the Podium...'
                : `Warping to Stage ${world.stageIndex + 2} of ${world.totalStages}...`}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
