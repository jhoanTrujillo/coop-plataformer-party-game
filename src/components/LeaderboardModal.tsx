import React, {useEffect, useState} from 'react';
import {Trophy, X} from 'lucide-react';
import {GameMode, LeaderboardEntry} from '../shared/types';
import {haptics} from '../utils/haptics';
import {CharacterAvatar} from './CharacterAvatar';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
}

const LOCAL_CACHE_KEY = 'starhop_party_leaderboard_cache_v1';

export function cacheLocalScore(entry: LeaderboardEntry) {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    const existing: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    const next = [...existing, entry].sort((a, b) => b.score - a.score).slice(0, 30);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({open, onClose}) => {
  const [filter, setFilter] = useState<'all' | GameMode>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const query = filter === 'all' ? '' : `?mode=${filter}`;
    fetch(`/api/leaderboard${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('offline'))))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data.entries) ? data.entries : [];
        setEntries(list);
      })
      .catch(() => {
        if (!active) return;
        try {
          const raw = localStorage.getItem(LOCAL_CACHE_KEY);
          const local: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
          setEntries(filter === 'all' ? local : local.filter((e) => e.mode === filter));
        } catch {
          setEntries([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, filter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-white">All-Time Hall of Fame</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
              {(['all', 'coop', 'battle'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setFilter(m);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap ${
                    filter === m ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'all' ? 'All' : m === 'coop' ? 'Co-op' : 'Battle'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
              aria-label="Close Hall of Fame"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading high scores...</div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-display text-base font-bold text-slate-200">
                No champions recorded yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Finish a 3-Stage Co-op Run or Bomb Battle match to claim the #1 spot!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/60">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={`font-mono-num w-7 text-center text-sm font-bold ${
                      idx === 0
                        ? 'text-amber-300'
                        : idx === 1
                          ? 'text-slate-200'
                          : idx === 2
                            ? 'text-orange-300'
                            : 'text-slate-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <CharacterAvatar color={entry.color} size={34} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">{entry.playerName}</div>
                    <div className="text-[11px] text-slate-400">
                      {entry.mode === 'coop' ? 'Co-op Adventure' : 'Bomb Battle'} · {entry.coins}{' '}
                      stars · {entry.kos} KOs
                    </div>
                  </div>
                  <div className="font-mono-num text-base font-bold text-amber-300">
                    {entry.score.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
