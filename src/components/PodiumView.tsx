import React from 'react';
import {Crown, Home, RotateCw, Star, Trophy} from 'lucide-react';
import {MatchSummary} from '../shared/types';
import {haptics} from '../utils/haptics';
import {CharacterAvatar} from './CharacterAvatar';

interface PodiumViewProps {
  summary: MatchSummary;
  canRestart: boolean;
  onPlayAgain: () => void;
  onOpenLeaderboard: () => void;
  onReturnMenu: () => void;
}

export const PodiumView: React.FC<PodiumViewProps> = ({
  summary,
  canRestart,
  onPlayAgain,
  onOpenLeaderboard,
  onReturnMenu,
}) => {
  const winner = summary.rankings[0];

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 text-amber-400" />
          <h1 className="font-display text-lg font-bold text-white sm:text-xl">
            Party Ranking Board
          </h1>
          <span className="text-xs text-slate-400">
            · {summary.mode === 'coop' ? 'Co-op Adventure' : 'Bomb Battle'} · Seed #{summary.seed}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onOpenLeaderboard();
            }}
            className="arcade-btn inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-slate-700 whitespace-nowrap"
          >
            <Trophy className="h-3.5 w-3.5" />
            All-Time Top
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onReturnMenu();
            }}
            className="arcade-btn inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap"
          >
            <Home className="h-3.5 w-3.5" />
            Menu
          </button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-12 sm:p-5">
        {/* Left: Ranked Podium List */}
        <section className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:col-span-7">
          <div className="space-y-2.5">
            {winner && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5">
                <Crown className="h-7 w-7 shrink-0 text-amber-400" />
                <CharacterAvatar color={winner.color} size={46} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-amber-300">Match Champion</div>
                  <div className="truncate font-display text-lg font-bold text-white">
                    {winner.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-num text-2xl font-bold text-amber-300">
                    {winner.score.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-300">pts</div>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/60">
              {summary.rankings.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3.5 py-2">
                  <span
                    className={`font-mono-num w-7 text-center text-sm font-bold ${
                      p.rank === 1
                        ? 'text-amber-300'
                        : p.rank === 2
                          ? 'text-slate-200'
                          : p.rank === 3
                            ? 'text-orange-300'
                            : 'text-slate-500'
                    }`}
                  >
                    #{p.rank}
                  </span>
                  <CharacterAvatar color={p.color} size={34} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {p.coins} stars · {p.kos} KOs · {p.bossDamage} boss dmg
                      {p.bonusPoints > 0 ? ` · +${p.bonusPoints} bonus` : ''}
                    </div>
                  </div>
                  <div className="font-mono-num text-base font-bold text-amber-300">
                    {p.score.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {canRestart ? (
              <button
                type="button"
                onClick={() => {
                  haptics.victory();
                  onPlayAgain();
                }}
                className="arcade-btn inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-b-4 border-emerald-800 bg-emerald-500 py-3 font-display text-base font-bold text-slate-950 hover:bg-emerald-400"
              >
                <RotateCw className="h-5 w-5" />
                Play Again (New Procedural Map)
              </button>
            ) : (
              <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 text-center text-xs font-semibold text-amber-300">
                Waiting for host to launch the next match...
              </div>
            )}
          </div>
        </section>

        {/* Right: Mario Party-style Bonus Star Awards */}
        <section className="flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:col-span-5">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <h2 className="font-display text-base font-bold text-white">Bonus Star Awards</h2>
          </div>

          <div className="space-y-2 overflow-y-auto">
            {summary.awards.map((award) => (
              <div
                key={`${award.title}_${award.playerId}`}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
              >
                <CharacterAvatar color={award.color} size={36} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-amber-300">
                      {award.title}
                    </span>
                    <span className="font-mono-num text-xs font-bold text-emerald-400">
                      +{award.bonus}
                    </span>
                  </div>
                  <div className="truncate text-xs text-slate-200">{award.playerName}</div>
                  <div className="truncate text-[11px] text-slate-400">{award.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
