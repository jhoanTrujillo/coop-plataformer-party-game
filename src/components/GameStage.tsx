import React, {useCallback, useEffect, useRef, useState} from 'react';
import {soundEngine} from '../audio/soundEngine';
import {
  createPlayerCamera,
  createRenderFx,
  renderGameCanvas,
  spawnFxFromEvents,
  stepRenderFx,
} from '../game/renderer';
import {createMatchWorld, stepSimulation} from '../shared/engine';
import {
  CharacterColor,
  CompactWorldSnapshot,
  EMPTY_INPUT,
  GameEvent,
  GameMode,
  MatchSummary,
  PlayerInput,
  TileChange,
  WorldState,
} from '../shared/types';
import {haptics} from '../utils/haptics';
import {GameHud} from './GameHud';
import {cacheLocalScore} from './LeaderboardModal';
import {TouchControls} from './TouchControls';

export interface P2PHostConfig {
  roomCode: string;
  seed: number;
  roster: Array<{id: string; name: string; color: CharacterColor; isHost?: boolean}>;
}

interface GameStageProps {
  role: 'solo' | 'p2p_host' | 'client';
  localPlayerId: string;
  localName: string;
  localColor: CharacterColor;
  mode: GameMode;
  p2pHostConfig?: P2PHostConfig | null;
  remoteGuestInputsRef?: React.MutableRefObject<Record<string, PlayerInput>>;
  remoteSnapshotRef?: React.MutableRefObject<CompactWorldSnapshot | null>;
  onHostBroadcastSnapshot?: (snapshot: CompactWorldSnapshot) => void;
  onSendInput: (input: PlayerInput) => void;
  onMatchFinish: (summary: MatchSummary) => void;
  onExitMatch: () => void;
}

export const GameStage: React.FC<GameStageProps> = ({
  role,
  localPlayerId,
  localName,
  localColor,
  mode,
  p2pHostConfig,
  remoteGuestInputsRef,
  remoteSnapshotRef,
  onHostBroadcastSnapshot,
  onSendInput,
  onMatchFinish,
  onExitMatch,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef(createRenderFx());
  const cameraRef = useRef(createPlayerCamera(localPlayerId));
  const worldRef = useRef<WorldState | null>(null);
  const inputRef = useRef<PlayerInput>({...EMPTY_INPUT});
  const lastProcessedTickRef = useRef<number>(-1);
  const lastSnapshotTimeRef = useRef<number>(0);
  const finishSubmittedRef = useRef(false);

  const [hudWorld, setHudWorld] = useState<WorldState | null>(null);
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 960;
  });

  // Always keep this client's camera instance locked strictly to this player's ID
  useEffect(() => {
    if (cameraRef.current.ownerPlayerId !== localPlayerId) {
      cameraRef.current = createPlayerCamera(localPlayerId);
    }
  }, [localPlayerId]);

  // Initialize local authoritative world for 'solo' OR 'p2p_host'
  useEffect(() => {
    if (role === 'client') {
      worldRef.current = null;
      lastProcessedTickRef.current = -1;
      finishSubmittedRef.current = false;
      fxRef.current = createRenderFx();
      cameraRef.current = createPlayerCamera(localPlayerId);
      return;
    }

    const seed =
      role === 'p2p_host' && p2pHostConfig
        ? p2pHostConfig.seed
        : Math.floor(Math.random() * 899999) + 100000;
    const roomCode = role === 'p2p_host' && p2pHostConfig ? p2pHostConfig.roomCode : 'SOLO';
    const roster =
      role === 'p2p_host' && p2pHostConfig
        ? p2pHostConfig.roster
        : [{id: localPlayerId, name: localName, color: localColor, isHost: true}];

    const initial = createMatchWorld(roomCode, mode, seed, roster);
    worldRef.current = initial;
    finishSubmittedRef.current = false;
    fxRef.current = createRenderFx();
    cameraRef.current = createPlayerCamera(localPlayerId);
    setHudWorld({...initial});
  }, [role, p2pHostConfig, localPlayerId, localName, localColor, mode]);

  const emitClientInput = useCallback(() => {
    if (role !== 'client') return;
    onSendInput({...inputRef.current});
    inputRef.current.jumpPressed = false;
    inputRef.current.grabPressed = false;
  }, [role, onSendInput]);

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      soundEngine.unlock();
      const inp = inputRef.current;
      let changed = false;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        inp.left = true;
        changed = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        inp.right = true;
        changed = true;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        inp.up = true;
        inp.jump = true;
        inp.jumpPressed = true;
        changed = true;
      } else if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') {
        e.preventDefault();
        inp.jump = true;
        inp.jumpPressed = true;
        changed = true;
      } else if (
        e.code === 'KeyE' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.code === 'KeyX' ||
        e.code === 'KeyK' ||
        e.code === 'KeyF'
      ) {
        e.preventDefault();
        inp.grabPressed = true;
        changed = true;
      }

      if (changed) emitClientInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      let changed = false;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        inp.left = false;
        changed = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        inp.right = false;
        changed = true;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        inp.up = false;
        inp.jump = false;
        changed = true;
      } else if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') {
        inp.jump = false;
        changed = true;
      }

      if (changed) emitClientInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [emitClientInput]);

  // Ultra-smooth 60fps Canvas Loop (decoupled from React state! HUD updates at ~8Hz so phones never stutter!)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAcc = 0;
    let netBroadcastAcc = 0;
    let lastBroadcastStage = -1;
    let pendingTileChanges: TileChange[] = [];
    let pendingEvents: GameEvent[] = [];

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));
      lastTime = now;

      if (role === 'client') {
        // Consume newest snapshot from ref (zero React re-render overhead per packet!)
        const incoming = remoteSnapshotRef?.current;
        if (incoming && incoming.tick !== lastProcessedTickRef.current) {
          lastProcessedTickRef.current = incoming.tick;
          lastSnapshotTimeRef.current = now;
          const prev = worldRef.current;
          let tiles = prev?.tiles ?? [];
          if (incoming.tiles) {
            tiles = [...incoming.tiles];
          } else if (incoming.tileChanges && prev) {
            tiles = [...prev.tiles];
            for (const ch of incoming.tileChanges) {
              const idx = ch.ty * incoming.width + ch.tx;
              if (idx >= 0 && idx < tiles.length) tiles[idx] = ch.tile;
            }
          }

          worldRef.current = {
            roomCode: incoming.roomCode,
            mode: incoming.mode,
            phase: incoming.phase,
            stageIndex: incoming.stageIndex,
            totalStages: incoming.totalStages,
            stageName: incoming.stageName,
            theme: incoming.theme,
            seed: incoming.seed,
            width: incoming.width,
            height: incoming.height,
            tiles,
            spawnerCooldowns: {},
            players: incoming.players.map((p) => ({...p})),
            items: incoming.items.map((it) => ({...it})),
            enemies: incoming.enemies.map((en) => ({...en})),
            projectiles: incoming.projectiles.map((pr) => ({...pr})),
            boss: incoming.boss ? {...incoming.boss} : null,
            timeRemaining: incoming.timeRemaining,
            stageClearTimer: incoming.stageClearTimer,
            tick: incoming.tick,
            intensity: incoming.intensity,
            events: incoming.events,
            summary: incoming.summary,
          };

          if (incoming.events.length > 0) {
            handleEventsAudioHaptics(incoming.events, localPlayerId);
            spawnFxFromEvents(fxRef.current, incoming.events);
          }
          updateAdaptiveMusic(worldRef.current);

          if (incoming.summary && !finishSubmittedRef.current) {
            finishSubmittedRef.current = true;
            onMatchFinish(incoming.summary);
          }
        } else if (worldRef.current && now - lastSnapshotTimeRef.current < 120) {
          // Smooth 60fps dead-reckoning interpolation between 30Hz snapshots!
          const w = worldRef.current;
          for (const p of w.players) {
            if (!p.heldByPlayerId && !p.stageFinished) {
              // Lightweight local prediction for crisp horizontal feel
              if (p.id === localPlayerId) {
                const inp = inputRef.current;
                const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
                if (dir !== 0) {
                  p.facing = dir as 1 | -1;
                  p.x += dir * 240 * dt * 0.55;
                } else {
                  p.x += p.vx * dt * 0.55;
                }
              } else {
                p.x += p.vx * dt * 0.7;
              }
              p.y += p.vy * dt * 0.65;
            }
          }
          for (const it of w.items) {
            if (!it.carriedById) {
              it.x += it.vx * dt * 0.7;
              it.y += it.vy * dt * 0.7;
            }
          }
          for (const en of w.enemies) {
            if (!en.carriedById) {
              en.x += en.vx * dt * 0.7;
              en.y += en.vy * dt * 0.7;
            }
          }
          if (w.boss) {
            w.boss.x += w.boss.vx * dt * 0.7;
            w.boss.y += w.boss.vy * dt * 0.7;
          }
          for (const pr of w.projectiles) {
            pr.x += pr.vx * dt;
            pr.y += pr.vy * dt;
          }
        }
      } else {
        // Authoritative 60Hz simulation on local device ('solo' OR 'p2p_host')!
        const world = worldRef.current;
        if (world && !finishSubmittedRef.current) {
          const inputsMap: Record<string, PlayerInput> = {
            [localPlayerId]: {...inputRef.current},
          };
          inputRef.current.jumpPressed = false;
          inputRef.current.grabPressed = false;

          if (role === 'p2p_host' && remoteGuestInputsRef) {
            for (const [gid, gInp] of Object.entries(remoteGuestInputsRef.current)) {
              inputsMap[gid] = {...gInp};
              gInp.jumpPressed = false;
              gInp.grabPressed = false;
            }
          }

          const changes = stepSimulation(world, inputsMap, dt);
          if (changes.length > 0) pendingTileChanges.push(...changes);
          if (world.events.length > 0) {
            pendingEvents.push(...world.events);
            handleEventsAudioHaptics(world.events, localPlayerId);
            spawnFxFromEvents(fxRef.current, world.events);
          }
          updateAdaptiveMusic(world);

          // Broadcast compact snapshot at 30Hz (or immediately on stage change / podium!) when hosting P2P
          if (role === 'p2p_host' && onHostBroadcastSnapshot) {
            netBroadcastAcc += dt;
            const stageChanged = world.stageIndex !== lastBroadcastStage;
            if (stageChanged || world.summary || netBroadcastAcc >= 0.032) {
              netBroadcastAcc = 0;
              if (stageChanged) lastBroadcastStage = world.stageIndex;
              const snap: CompactWorldSnapshot = {
                roomCode: world.roomCode,
                mode: world.mode,
                phase: world.phase,
                stageIndex: world.stageIndex,
                totalStages: world.totalStages,
                stageName: world.stageName,
                theme: world.theme,
                seed: world.seed,
                width: world.width,
                height: world.height,
                tiles: stageChanged ? world.tiles : undefined,
                tileChanges:
                  !stageChanged && pendingTileChanges.length > 0 ? pendingTileChanges : undefined,
                players: world.players,
                items: world.items,
                enemies: world.enemies,
                projectiles: world.projectiles,
                boss: world.boss,
                timeRemaining: world.timeRemaining,
                stageClearTimer: world.stageClearTimer,
                tick: world.tick,
                intensity: world.intensity,
                events: pendingEvents,
                summary: world.summary,
              };
              pendingTileChanges = [];
              pendingEvents = [];
              onHostBroadcastSnapshot(snap);
            }
          }

          // Check Match Podium Finish
          const finalSummary = world.summary;
          if (finalSummary) {
            finishSubmittedRef.current = true;
            if (role === 'solo') {
              const meRank = finalSummary.rankings[0];
              if (meRank) {
                const localEntry = {
                  id: `solo_${Date.now()}`,
                  playerName: meRank.name,
                  color: meRank.color,
                  mode: world.mode,
                  score: meRank.score,
                  coins: meRank.coins,
                  kos: meRank.kos,
                  stagesCleared: finalSummary.stagesCleared,
                  createdAt: new Date().toISOString(),
                };
                cacheLocalScore(localEntry);
                void fetch('/api/leaderboard', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify(localEntry),
                }).catch(() => {
                  // Offline solo play stays cached locally
                });
              }
            }
            onMatchFinish(finalSummary);
          }
        }
      }

      // Throttled HUD React sync (~8Hz) so mobile browsers spend 100% of frame budget on smooth Canvas!
      const world = worldRef.current;
      if (world) {
        hudSyncAcc += dt;
        if (hudSyncAcc >= 0.12) {
          hudSyncAcc = 0;
          setHudWorld({...world});
        }

        stepRenderFx(fxRef.current, dt);

        const canvas = canvasRef.current;
        if (canvas) {
          // Cap DPR at 1.5 on phones for locked 60fps even on high-DPI OLED screens
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          const cw = canvas.clientWidth;
          const ch = canvas.clientHeight;
          const targetW = Math.round(cw * dpr);
          const targetH = Math.round(ch * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.scale(dpr, dpr);
            renderGameCanvas(ctx, cw, ch, world, cameraRef.current, fxRef.current, now / 1000, dt);
            ctx.restore();
          }
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [
    role,
    localPlayerId,
    remoteGuestInputsRef,
    remoteSnapshotRef,
    onHostBroadcastSnapshot,
    onMatchFinish,
  ]);

  const handleDirectionChange = useCallback(
    (left: boolean, right: boolean) => {
      soundEngine.unlock();
      inputRef.current.left = left;
      inputRef.current.right = right;
      emitClientInput();
    },
    [emitClientInput],
  );

  const handleJumpChange = useCallback(
    (held: boolean, pressedEdge: boolean) => {
      soundEngine.unlock();
      inputRef.current.jump = held;
      if (pressedEdge) inputRef.current.jumpPressed = true;
      emitClientInput();
    },
    [emitClientInput],
  );

  const handleGrabPress = useCallback(() => {
    soundEngine.unlock();
    inputRef.current.grabPressed = true;
    emitClientInput();
  }, [emitClientInput]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const localPlayer = hudWorld?.players.find((p) => p.id === localPlayerId);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {hudWorld && (
        <GameHud
          world={hudWorld}
          localPlayerId={localPlayerId}
          muted={muted}
          showTouchControls={showTouchControls}
          onToggleMute={toggleMute}
          onToggleTouch={() => setShowTouchControls((s) => !s)}
          onExitMatch={onExitMatch}
        />
      )}

      {showTouchControls ? (
        <TouchControls
          holdingItem={Boolean(localPlayer?.heldItemId)}
          canDoubleJump={Boolean(localPlayer && !localPlayer.grounded && !localPlayer.doubleJumpUsed)}
          onDirectionChange={handleDirectionChange}
          onJumpChange={handleJumpChange}
          onGrabPress={handleGrabPress}
        />
      ) : (
        <div className="pointer-events-none fixed bottom-2.5 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-slate-950/65 px-3.5 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-md sm:flex">
          <span>Move: A / D or Arrows</span>
          <span aria-hidden="true">·</span>
          <span>Jump / Double-Jump: Space</span>
          <span aria-hidden="true">·</span>
          <span>Grab / Throw Bombs: E or Shift</span>
        </div>
      )}
    </div>
  );
};

function updateAdaptiveMusic(world: WorldState) {
  if (world.phase === 'podium') {
    soundEngine.setMusicState('victory', 0.4);
  } else if (world.boss && world.boss.action !== 'defeated') {
    soundEngine.setMusicState('boss', world.intensity);
  } else if (world.intensity >= 0.7) {
    soundEngine.setMusicState('tense', world.intensity);
  } else {
    soundEngine.setMusicState('explore', world.intensity);
  }
}

function handleEventsAudioHaptics(events: GameEvent[], localPlayerId: string) {
  for (const ev of events) {
    soundEngine.playSfx(ev.type);
    const isMine = !ev.playerId || ev.playerId === localPlayerId;
    if (!isMine && ev.type !== 'explode' && ev.type !== 'mega_explode' && ev.type !== 'boss_slam') {
      continue;
    }
    switch (ev.type) {
      case 'double_jump':
        haptics.puff();
        break;
      case 'grab':
        haptics.grab();
        break;
      case 'throw':
        haptics.throwItem();
        break;
      case 'coin':
      case 'star':
        haptics.coin();
        break;
      case 'powerup':
        haptics.powerup();
        break;
      case 'explode':
      case 'boss_slam':
        haptics.explode();
        break;
      case 'mega_explode':
      case 'boss_defeat':
        haptics.megaExplode();
        break;
      case 'hurt':
        haptics.hurt();
        break;
      case 'stage_clear':
        haptics.victory();
        break;
    }
  }
}
