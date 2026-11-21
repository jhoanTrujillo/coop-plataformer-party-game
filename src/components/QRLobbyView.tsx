import React, {useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {AlertTriangle, ArrowLeft, Check, Copy, Crown, Play, Users, Wifi} from 'lucide-react';
import type {PeerLinkStatus} from '../net/localPeerMesh';
import {
  CHARACTER_PALETTES,
  COLOR_ORDER,
  CharacterColor,
  GameMode,
  LobbySnapshot,
} from '../shared/types';
import {haptics} from '../utils/haptics';
import {CharacterAvatar} from './CharacterAvatar';

interface QRLobbyViewProps {
  lobby: LobbySnapshot;
  localPlayerId: string;
  peerStatuses: PeerLinkStatus[];
  onChangeMode: (mode: GameMode) => void;
  onChangeColor: (color: CharacterColor) => void;
  onStartMatch: () => void;
  onLeaveLobby: () => void;
}

export const QRLobbyView: React.FC<QRLobbyViewProps> = ({
  lobby,
  localPlayerId,
  peerStatuses,
  onChangeMode,
  onChangeColor,
  onStartMatch,
  onLeaveLobby,
}) => {
  const [copied, setCopied] = useState(false);
  const isHost = lobby.hostId === localPlayerId;
  const me = lobby.players.find((p) => p.id === localPlayerId);
  const directCount = peerStatuses.filter((p) => p.connected).length;

  const isPrivatePreview =
    typeof window !== 'undefined' && window.location.hostname.startsWith('ais-dev-');

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${lobby.roomCode}`
      : `/?room=${lobby.roomCode}`;

  const copyLink = async () => {
    haptics.tap();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      {/* Compact Header */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-800/90 bg-slate-900/90 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onLeaveLobby();
            }}
            className="arcade-btn inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Leave
          </button>
          <h1 className="font-display text-lg font-bold text-white sm:text-xl whitespace-nowrap">
            Party Lobby
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
          <Wifi className={`h-4 w-4 ${directCount > 0 ? 'text-emerald-400' : 'text-sky-400'}`} />
          <span className={directCount > 0 ? 'font-semibold text-emerald-300' : 'text-slate-300'}>
            {directCount > 0 ? 'Direct Local P2P Active' : 'Local Wi-Fi / Hotspot Ready'}
          </span>
          <span aria-hidden="true">·</span>
          <Users className="h-4 w-4 text-sky-400" />
          <span className="font-mono-num font-bold text-slate-100">{lobby.players.length}/4</span>
        </div>
      </header>

      {/* Main Two-Column Landscape Layout */}
      <main className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-12 sm:p-5">
        {/* Left: Mode Toggle + Roster + Color Picker */}
        <section className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:col-span-7">
          <div className="space-y-3">
            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-white">Game Mode</h2>
                <p className="text-xs text-slate-400">
                  {lobby.mode === 'coop'
                    ? 'Large 3-Stage Procedural Worlds ending in Baron Cinder-Crown'
                    : 'Large 3-Round Bomb Battle Arena with Chaos Boss Finale'}
                </p>
              </div>
              {isHost && (
                <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onChangeMode('coop');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                      lobby.mode === 'coop'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Co-op Adventure
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onChangeMode('battle');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                      lobby.mode === 'battle'
                        ? 'bg-rose-500 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bomb Battle
                  </button>
                </div>
              )}
            </div>

            {/* 4-Slot Party Roster */}
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((slot) => {
                const player = lobby.players[slot];
                if (!player) {
                  return (
                    <div
                      key={slot}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-3 py-2.5 text-slate-500"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 font-mono-num text-xs font-bold">
                        P{slot + 1}
                      </div>
                      <span className="text-xs font-medium">Scan QR to join</span>
                    </div>
                  );
                }

                const isMe = player.id === localPlayerId;
                const peerInfo = peerStatuses.find((s) => s.peerId === player.id);
                const linkText = isMe
                  ? 'You'
                  : peerInfo?.connected
                    ? peerInfo.isLocalLan
                      ? `Direct LAN${peerInfo.rttMs ? ` · ${peerInfo.rttMs}ms` : ''}`
                      : `Direct P2P${peerInfo.rttMs ? ` · ${peerInfo.rttMs}ms` : ''}`
                    : 'Cloud Relay';

                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                      isMe
                        ? 'border-amber-400/60 bg-slate-800/90'
                        : 'border-slate-700/80 bg-slate-800/60'
                    }`}
                  >
                    <CharacterAvatar color={player.color} size={42} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white">
                          {player.name}
                        </span>
                        {player.isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {CHARACTER_PALETTES[player.color].label} ·{' '}
                        <span
                          className={
                            peerInfo?.connected ? 'font-semibold text-emerald-300' : 'text-slate-400'
                          }
                        >
                          {linkText}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400">
              For lowest latency (~5ms), connect all phones to the same Wi-Fi or one phone&apos;s
              Mobile Hotspot — gameplay switches automatically to direct phone-to-phone UDP.
            </p>
          </div>

          {/* Your Sprite Color Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
            <span className="text-xs font-semibold text-slate-300">Your Character Sprite</span>
            <div className="flex items-center gap-2">
              {COLOR_ORDER.map((c) => {
                const pal = CHARACTER_PALETTES[c];
                const selected = me?.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      onChangeColor(c);
                    }}
                    title={pal.label}
                    className={`arcade-btn flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform ${
                      selected
                        ? 'scale-110 border-amber-300 ring-2 ring-amber-400/50'
                        : 'border-slate-700 opacity-80 hover:opacity-100'
                    }`}
                    style={{backgroundColor: pal.body}}
                    aria-label={`Pick ${pal.label}`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-slate-900"
                      style={{backgroundColor: pal.cap}}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Scannable QR Code + Room Code + Start Match CTA */}
        <section className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center sm:col-span-5">
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-400">
              Scan on Android / iOS to Join Instantly
            </span>
            <div className="mt-2 rounded-2xl bg-white p-2.5 shadow-lg">
              <QRCodeSVG
                value={shareUrl}
                size={isPrivatePreview ? 112 : 132}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-400">Room Code</span>
              <span className="font-mono-num text-2xl font-bold tracking-[0.2em] text-amber-300">
                {lobby.roomCode}
              </span>
            </div>
            {isPrivatePreview && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-left text-[11px] leading-snug text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  You are on the private AI Studio dev preview. Open your{' '}
                  <strong>Deployed / Shared URL</strong> and host the lobby there so friends can
                  scan the QR code without being blocked.
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="arcade-btn inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  Invite Link Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Invite Link
                </>
              )}
            </button>

            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  haptics.victory();
                  onStartMatch();
                }}
                className="arcade-btn inline-flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-emerald-800 bg-emerald-500 py-3 font-display text-base font-bold text-slate-950 shadow-lg hover:bg-emerald-400"
              >
                <Play className="h-5 w-5 fill-current" />
                Start 3-Stage Match
              </button>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 text-xs font-semibold text-amber-300">
                Waiting for host to start the match...
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
