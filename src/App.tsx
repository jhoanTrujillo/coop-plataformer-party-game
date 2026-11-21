import {useCallback, useEffect, useRef, useState} from 'react';
import {
  Bomb,
  Play,
  QrCode,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {soundEngine} from './audio/soundEngine';
import {CharacterAvatar} from './components/CharacterAvatar';
import {GameStage, P2PHostConfig} from './components/GameStage';
import {LandscapeGuard} from './components/LandscapeGuard';
import {LeaderboardModal} from './components/LeaderboardModal';
import {OfflineIndicator, PWAInstallButton} from './components/PWAInstallButton';
import {PodiumView} from './components/PodiumView';
import {QRLobbyView} from './components/QRLobbyView';
import {LocalPeerMesh, PeerLinkStatus, PeerSignalPayload} from './net/localPeerMesh';
import {
  CHARACTER_PALETTES,
  COLOR_ORDER,
  CharacterColor,
  CompactWorldSnapshot,
  EMPTY_INPUT,
  GameMode,
  LobbySnapshot,
  MatchSummary,
  PlayerInput,
} from './shared/types';
import {haptics} from './utils/haptics';

type ScreenMode = 'title' | 'lobby' | 'playing_solo' | 'playing_host' | 'playing_client' | 'podium';

const TITLE_BANNER_SRC = '/src/assets/images/starhop_title_banner_1795198173521.jpg';

export default function App() {
  const [screen, setScreen] = useState<ScreenMode>('title');
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem('starhop_name') || 'Starhop';
    } catch {
      return 'Starhop';
    }
  });
  const [playerColor, setPlayerColor] = useState<CharacterColor>('sakura');
  const [selectedMode, setSelectedMode] = useState<GameMode>('coop');
  const [joinCode, setJoinCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(false);
  const [bannerError, setBannerError] = useState<boolean>(false);

  // Multiplayer WebSocket + Direct Local WebRTC P2P Mesh state
  const wsRef = useRef<WebSocket | null>(null);
  const meshRef = useRef<LocalPeerMesh | null>(null);
  const remoteSnapshotRef = useRef<CompactWorldSnapshot | null>(null);
  const remoteGuestInputsRef = useRef<Record<string, PlayerInput>>({});
  const lobbyRef = useRef<LobbySnapshot | null>(null);
  const localPlayerIdRef = useRef<string>('solo_p1');

  const [localPlayerId, setLocalPlayerId] = useState<string>('solo_p1');
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [peerStatuses, setPeerStatuses] = useState<PeerLinkStatus[]>([]);
  const [p2pHostConfig, setP2pHostConfig] = useState<P2PHostConfig | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [matchKey, setMatchKey] = useState<number>(1);
  const [wasMultiplayerMatch, setWasMultiplayerMatch] = useState<boolean>(false);

  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  useEffect(() => {
    localPlayerIdRef.current = localPlayerId;
  }, [localPlayerId]);

  // Check URL ?room=XXXX from scanned QR code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCode(roomParam.trim().toUpperCase().slice(0, 4));
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('starhop_name', playerName);
    } catch {
      // Ignore storage errors
    }
  }, [playerName]);

  useEffect(() => {
    if (screen === 'lobby') {
      soundEngine.setMusicState('lobby', 0.2);
    } else if (screen === 'podium') {
      soundEngine.setMusicState('victory', 0.4);
    } else if (screen === 'title') {
      soundEngine.setMusicState('off', 0);
    }
  }, [screen]);

  const sendWs = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const mergeGuestInput = useCallback((fromId: string, inc: Partial<PlayerInput>) => {
    const prev = remoteGuestInputsRef.current[fromId] ?? {...EMPTY_INPUT};
    remoteGuestInputsRef.current[fromId] = {
      left: !!inc.left,
      right: !!inc.right,
      up: !!inc.up,
      jump: !!inc.jump,
      jumpPressed: prev.jumpPressed || !!inc.jumpPressed,
      grabPressed: prev.grabPressed || !!inc.grabPressed,
    };
  }, []);

  const ensurePeerMesh = useCallback((): LocalPeerMesh => {
    if (meshRef.current) return meshRef.current;
    const mesh = new LocalPeerMesh({
      onSendSignal: (targetId, signal) => {
        sendWs({type: 'rtc_signal', targetId, signal});
      },
      onData: (peerId, data) => {
        if (data.t === 'input' && data.input) {
          mergeGuestInput(peerId, data.input as Partial<PlayerInput>);
        } else if (data.t === 'state' && data.state) {
          const snap = data.state as CompactWorldSnapshot;
          remoteSnapshotRef.current = snap;
          if (snap.phase === 'podium' && snap.summary) {
            setMatchSummary(snap.summary);
            setWasMultiplayerMatch(true);
            setScreen('podium');
          }
        }
      },
      onStatusChange: (statuses) => {
        setPeerStatuses(statuses);
      },
    });
    meshRef.current = mesh;
    return mesh;
  }, [sendWs, mergeGuestInput]);

  useEffect(() => {
    return () => {
      meshRef.current?.destroy();
      meshRef.current = null;
    };
  }, []);

  const ensureSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const existing = wsRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        resolve(existing);
        return;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setErrorMsg(null);
        resolve(ws);
      };

      ws.onerror = () => {
        setErrorMsg('Could not reach the multiplayer server. Solo Run works offline anytime!');
        reject(new Error('WebSocket failed'));
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'welcome' && typeof msg.playerId === 'string') {
            setLocalPlayerId(msg.playerId);
            localPlayerIdRef.current = msg.playerId;
          } else if (msg.type === 'lobby_state' && msg.lobby) {
            const snap: LobbySnapshot = msg.lobby;
            setLobby(snap);
            lobbyRef.current = snap;
            const myId = localPlayerIdRef.current;

            // Automatically establish direct Local Wi-Fi / Hotspot WebRTC DataChannels!
            const mesh = ensurePeerMesh();
            const otherIds = snap.players.filter((p) => p.id !== myId).map((p) => p.id);
            mesh.syncPeerIds(otherIds);
            if (snap.hostId === myId) {
              for (const gid of otherIds) {
                void mesh.connectToPeer(gid);
              }
            }

            if (snap.status === 'lobby') {
              setScreen('lobby');
            }
          } else if (msg.type === 'rtc_signal' && msg.fromId && msg.signal) {
            const mesh = ensurePeerMesh();
            void mesh.handleSignal(String(msg.fromId), msg.signal as PeerSignalPayload);
          } else if (msg.type === 'p2p_match_start') {
            const myId = localPlayerIdRef.current;
            remoteSnapshotRef.current = null;
            remoteGuestInputsRef.current = {};
            setMatchSummary(null);
            setWasMultiplayerMatch(true);
            setSelectedMode(msg.mode === 'battle' ? 'battle' : 'coop');
            setMatchKey((k) => k + 1);

            if (msg.hostId === myId) {
              setP2pHostConfig({
                roomCode: String(msg.roomCode ?? 'P2P'),
                seed: Number(msg.seed) || 123456,
                roster: Array.isArray(msg.roster) ? msg.roster : [],
              });
              setScreen('playing_host');
            } else {
              setP2pHostConfig(null);
              setScreen('playing_client');
            }
          } else if (msg.type === 'p2p_guest_input' && msg.fromId && msg.input) {
            // Hybrid WS fallback input from a guest whose firewall blocked WebRTC
            mergeGuestInput(String(msg.fromId), msg.input as Partial<PlayerInput>);
          } else if (msg.type === 'world_state' && msg.state) {
            const world: CompactWorldSnapshot = msg.state;
            remoteSnapshotRef.current = world;
            if (world.phase === 'podium' && world.summary) {
              setMatchSummary(world.summary);
              setWasMultiplayerMatch(true);
              setScreen('podium');
            } else {
              setScreen('playing_client');
            }
          } else if (msg.type === 'error' && typeof msg.message === 'string') {
            setErrorMsg(msg.message);
          }
        } catch {
          // Ignore malformed message
        }
      };
    });
  }, [ensurePeerMesh, mergeGuestInput]);

  const handleHostParty = async () => {
    soundEngine.unlock();
    soundEngine.playSfx('ui_tap');
    haptics.tap();
    setErrorMsg(null);
    try {
      const ws = await ensureSocket();
      ws.send(
        JSON.stringify({
          type: 'create_room',
          name: playerName.trim() || 'Host',
          color: playerColor,
          mode: selectedMode,
        }),
      );
    } catch {
      // Error surfaced via errorMsg
    }
  };

  const handleJoinParty = async () => {
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setErrorMsg('Enter a 4-letter Room Code or scan your host’s QR code.');
      return;
    }
    soundEngine.unlock();
    soundEngine.playSfx('ui_tap');
    haptics.tap();
    setErrorMsg(null);
    try {
      const ws = await ensureSocket();
      ws.send(
        JSON.stringify({
          type: 'join_room',
          roomCode: cleanCode,
          name: playerName.trim() || 'Guest',
          color: playerColor,
        }),
      );
    } catch {
      // Error surfaced via errorMsg
    }
  };

  const handleStartSolo = () => {
    soundEngine.unlock();
    soundEngine.playSfx('star');
    haptics.victory();
    setErrorMsg(null);
    setWasMultiplayerMatch(false);
    setLocalPlayerId('solo_p1');
    setMatchKey((k) => k + 1);
    setScreen('playing_solo');
  };

  // Host broadcasts authoritative state directly over ~5ms local UDP WebRTC to connected peers,
  // and transparently relays via WS only to any peer whose cellular firewall blocked P2P!
  const handleHostBroadcastSnapshot = useCallback(
    (snapshot: CompactWorldSnapshot) => {
      const currentLobby = lobbyRef.current;
      if (!currentLobby) return;
      const guestIds = currentLobby.players
        .filter((p) => p.id !== localPlayerIdRef.current)
        .map((p) => p.id);
      if (guestIds.length === 0) return;

      const sentViaP2P = meshRef.current?.broadcast({t: 'state', state: snapshot}) ?? new Set<string>();
      const fallbackTargets = guestIds.filter((id) => !sentViaP2P.has(id));
      if (fallbackTargets.length > 0) {
        sendWs({type: 'p2p_relay_state', targetIds: fallbackTargets, state: snapshot});
      }
    },
    [sendWs],
  );

  // Guest sends input straight over ~5ms local UDP WebRTC DataChannel to the Host phone!
  const handleSendInput = useCallback(
    (input: PlayerInput) => {
      const currentLobby = lobbyRef.current;
      if (currentLobby && meshRef.current?.isPeerOpen(currentLobby.hostId)) {
        meshRef.current.sendToPeer(currentLobby.hostId, {t: 'input', input});
      } else if (currentLobby) {
        sendWs({type: 'p2p_relay_input', input});
      } else {
        sendWs({type: 'input', input});
      }
    },
    [sendWs],
  );

  const handleMatchFinish = useCallback(
    (summary: MatchSummary) => {
      if (screen === 'playing_host') {
        sendWs({type: 'p2p_record_summary', summary});
      }
      setMatchSummary(summary);
      setScreen('podium');
    },
    [screen, sendWs],
  );

  const handleExitToTitle = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendWs({type: 'leave_room'});
    }
    meshRef.current?.destroy();
    meshRef.current = null;
    setPeerStatuses([]);
    setLobby(null);
    remoteSnapshotRef.current = null;
    setP2pHostConfig(null);
    setMatchSummary(null);
    setScreen('title');
  };

  const handleStartMultiplayerMatch = () => {
    // Launch host-authoritative Local P2P mode (0ms Host + ~5ms direct LAN/Hotspot UDP for guests + automatic WS fallback!)
    sendWs({type: 'start_p2p_match'});
  };

  const handlePlayAgain = () => {
    if (wasMultiplayerMatch && lobby) {
      sendWs({type: 'start_p2p_match'});
      remoteSnapshotRef.current = null;
      setMatchSummary(null);
    } else {
      handleStartSolo();
    }
  };

  const toggleMute = () => {
    soundEngine.unlock();
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-slate-950 text-slate-50">
      <LandscapeGuard />
      <OfflineIndicator />
      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />

      {/* 1. TITLE SCREEN */}
      {screen === 'title' && (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
          {!bannerError ? (
            <img
              src={TITLE_BANNER_SRC}
              alt="Starhop Party floating emerald islands and crystal castle"
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-600 via-indigo-800 to-slate-950" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/75 to-slate-950/55" />

          <header className="relative z-10 flex items-center justify-between gap-4 px-4 py-2.5 sm:px-7 sm:py-3">
            <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
              <CharacterAvatar color={playerColor} size={34} />
              <span className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                Starhop Party
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  haptics.tap();
                  setLeaderboardOpen(true);
                }}
                className="arcade-btn inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-amber-300 backdrop-blur-md hover:bg-slate-800 whitespace-nowrap"
              >
                <Trophy className="h-3.5 w-3.5" />
                Hall of Fame
              </button>

              <PWAInstallButton />

              <button
                type="button"
                onClick={toggleMute}
                className="arcade-btn flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-900/80 text-slate-200 backdrop-blur-md hover:bg-slate-800"
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              >
                {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </header>

          <main className="relative z-10 grid flex-1 grid-cols-1 items-center gap-4 overflow-y-auto px-4 pb-4 sm:grid-cols-12 sm:px-7">
            <section className="flex flex-col justify-center gap-3 sm:col-span-6 lg:col-span-7">
              <div className="max-w-lg">
                <h1 className="font-display text-3xl font-bold leading-tight text-white [text-wrap:balance] sm:text-4xl lg:text-5xl">
                  Jump, Puff &amp; Toss Bombs With Friends
                </h1>
                <p className="mt-1.5 text-xs text-slate-200 sm:text-sm">
                  Large multi-tier procedural worlds, cracked puzzle vaults, power-ups, and a Baron
                  Cinder-Crown boss showdown — powered by direct local Wi-Fi / Hotspot P2P.
                </p>
              </div>

              <div className="max-w-lg rounded-2xl border border-white/15 bg-slate-950/75 p-3.5 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-3">
                  <CharacterAvatar color={playerColor} size={52} className="shrink-0" />
                  <div className="min-w-[140px] flex-1">
                    <label htmlFor="nickname-input" className="block text-[11px] font-semibold text-slate-300">
                      Player Name · {CHARACTER_PALETTES[playerColor].label}
                    </label>
                    <input
                      id="nickname-input"
                      type="text"
                      maxLength={14}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter nickname"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {COLOR_ORDER.map((c) => {
                      const pal = CHARACTER_PALETTES[c];
                      const active = playerColor === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            soundEngine.unlock();
                            soundEngine.playSfx('ui_tap');
                            haptics.tap();
                            setPlayerColor(c);
                          }}
                          title={pal.label}
                          className={`arcade-btn flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                            active
                              ? 'scale-110 border-amber-300 ring-2 ring-amber-400/50'
                              : 'border-slate-700 opacity-85 hover:opacity-100'
                          }`}
                          style={{backgroundColor: pal.body}}
                          aria-label={`Select ${pal.label}`}
                        >
                          <span
                            className="h-3 w-3 rounded-full border border-slate-900"
                            style={{backgroundColor: pal.cap}}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        setSelectedMode('coop');
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap ${
                        selectedMode === 'coop'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Co-op
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        setSelectedMode('battle');
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap ${
                        selectedMode === 'battle'
                          ? 'bg-rose-500 text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Bomb className="h-3.5 w-3.5" />
                      Bomb Battle
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-slate-950/80 p-4 backdrop-blur-md sm:col-span-6 lg:col-span-5">
              <button
                type="button"
                onClick={handleStartSolo}
                className="arcade-btn flex w-full items-center justify-center gap-2.5 rounded-xl border-b-4 border-amber-700 bg-amber-400 px-5 py-3.5 font-display text-lg font-bold text-slate-950 shadow-lg hover:bg-amber-300 whitespace-nowrap"
              >
                <Play className="h-5 w-5 fill-current" />
                Play Solo Run ({selectedMode === 'coop' ? '3-Stage Boss' : 'Bomb Arena'})
              </button>

              <button
                type="button"
                onClick={() => void handleHostParty()}
                className="arcade-btn flex w-full items-center justify-center gap-2.5 rounded-xl border-b-4 border-sky-800 bg-sky-500 px-5 py-3 font-display text-base font-bold text-slate-950 shadow-lg hover:bg-sky-400 whitespace-nowrap"
              >
                <QrCode className="h-5 w-5" />
                Host Party Lobby (QR Code)
              </button>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  aria-label="4-letter Room Code"
                  className="font-mono-num w-32 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-center text-sm font-bold tracking-[0.2em] text-amber-300 uppercase outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => void handleJoinParty()}
                  className="arcade-btn inline-flex items-center gap-1.5 rounded-xl border-b-4 border-emerald-800 bg-emerald-500 px-4 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
                >
                  <Users className="h-4 w-4" />
                  Join
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/75 px-3 py-2 text-xs font-semibold text-rose-200">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px] text-slate-400">
                <span>Direct Wi-Fi / Hotspot P2P · 60fps Canvas</span>
                <span>1–4 Players Online or Offline</span>
              </div>
            </section>
          </main>
        </div>
      )}

      {/* 2. QR CODE MULTIPLAYER LOBBY */}
      {screen === 'lobby' && lobby && (
        <QRLobbyView
          lobby={lobby}
          localPlayerId={localPlayerId}
          peerStatuses={peerStatuses}
          onChangeMode={(m) => {
            setSelectedMode(m);
            sendWs({type: 'set_mode', mode: m});
          }}
          onChangeColor={(c) => {
            setPlayerColor(c);
            sendWs({type: 'update_profile', color: c});
          }}
          onStartMatch={handleStartMultiplayerMatch}
          onLeaveLobby={handleExitToTitle}
        />
      )}

      {/* 3. ACTIVE GAMEPLAY (SOLO, LOCAL P2P HOST, OR P2P/RELAY CLIENT) */}
      {(screen === 'playing_solo' || screen === 'playing_host' || screen === 'playing_client') && (
        <GameStage
          key={`${screen}_${matchKey}`}
          role={
            screen === 'playing_solo'
              ? 'solo'
              : screen === 'playing_host'
                ? 'p2p_host'
                : 'client'
          }
          localPlayerId={localPlayerId}
          localName={playerName.trim() || 'Starhop'}
          localColor={playerColor}
          mode={screen === 'playing_solo' ? selectedMode : lobby?.mode ?? selectedMode}
          p2pHostConfig={p2pHostConfig}
          remoteGuestInputsRef={remoteGuestInputsRef}
          remoteSnapshotRef={remoteSnapshotRef}
          onHostBroadcastSnapshot={handleHostBroadcastSnapshot}
          onSendInput={handleSendInput}
          onMatchFinish={handleMatchFinish}
          onExitMatch={handleExitToTitle}
        />
      )}

      {/* 4. END-OF-MATCH PODIUM & RANKING BOARD */}
      {screen === 'podium' && matchSummary && (
        <PodiumView
          summary={matchSummary}
          canRestart={!wasMultiplayerMatch || lobby?.hostId === localPlayerId}
          onPlayAgain={handlePlayAgain}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          onReturnMenu={handleExitToTitle}
        />
      )}
    </div>
  );
}
