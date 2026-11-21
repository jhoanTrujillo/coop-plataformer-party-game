import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {WebSocket, WebSocketServer} from 'ws';
import {createMatchWorld, stepSimulation} from './src/shared/engine.ts';
import {COLOR_ORDER, EMPTY_INPUT} from './src/shared/types.ts';
import type {
  CharacterColor,
  CompactWorldSnapshot,
  GameMode,
  LeaderboardEntry,
  LobbySnapshot,
  PlayerInput,
  WorldState,
} from './src/shared/types.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
  name: string;
  color: CharacterColor;
  ready: boolean;
}

interface Room {
  code: string;
  hostId: string;
  mode: GameMode;
  p2pHosted: boolean;
  clients: Map<string, ConnectedClient>;
  inputs: Record<string, PlayerInput>;
  world: WorldState | null;
  lastBroadcastStage: number;
  recordedSummary: boolean;
}

const rooms = new Map<string, Room>();
let clientCounter = 1;

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(LEADERBOARD_FILE)) return [];
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLeaderboardEntries(newEntries: LeaderboardEntry[]): LeaderboardEntry[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    const existing = loadLeaderboard();
    const combined = [...existing, ...newEntries]
      .sort((a, b) => b.score - a.score)
      .slice(0, 60);
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(combined, null, 2), 'utf-8');
    return combined;
  } catch {
    return newEntries;
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `P${Math.floor(100 + Math.random() * 899)}`;
}

function pickAvailableColor(room: Room, preferred?: CharacterColor): CharacterColor {
  const used = new Set(Array.from(room.clients.values()).map((c) => c.color));
  if (preferred && !used.has(preferred)) return preferred;
  const open = COLOR_ORDER.find((c) => !used.has(c));
  return open ?? preferred ?? 'sakura';
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getLobbySnapshot(room: Room): LobbySnapshot {
  return {
    roomCode: room.code,
    mode: room.mode,
    hostId: room.hostId,
    status: room.world ? room.world.phase : 'lobby',
    players: Array.from(room.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isHost: c.id === room.hostId,
      ready: c.ready || c.id === room.hostId,
    })),
  };
}

function broadcastLobby(room: Room) {
  const snapshot = getLobbySnapshot(room);
  for (const c of room.clients.values()) {
    sendJson(c.ws, {type: 'lobby_state', lobby: snapshot});
  }
}

function leaveCurrentRoom(client: ConnectedClient) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  client.roomCode = null;
  if (!room) return;

  room.clients.delete(client.id);
  delete room.inputs[client.id];

  if (room.clients.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === client.id) {
    const nextHost = room.clients.values().next().value;
    if (nextHost) {
      room.hostId = nextHost.id;
      nextHost.ready = true;
    }
  }

  broadcastLobby(room);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Persistent All-Time Leaderboard REST API
  app.get('/api/leaderboard', (req, res) => {
    const mode = req.query.mode;
    let entries = loadLeaderboard();
    if (mode === 'coop' || mode === 'battle') {
      entries = entries.filter((e) => e.mode === mode);
    }
    res.json({entries: entries.slice(0, 25)});
  });

  app.post('/api/leaderboard', (req, res) => {
    const body = req.body ?? {};
    const playerName = String(body.playerName ?? 'Starhop').trim().slice(0, 16) || 'Starhop';
    const mode: GameMode = body.mode === 'battle' ? 'battle' : 'coop';
    const color: CharacterColor = COLOR_ORDER.includes(body.color) ? body.color : 'sakura';
    const score = Math.max(0, Math.min(99999, Math.floor(Number(body.score) || 0)));
    const coins = Math.max(0, Math.min(9999, Math.floor(Number(body.coins) || 0)));
    const kos = Math.max(0, Math.min(999, Math.floor(Number(body.kos) || 0)));
    const stagesCleared = Math.max(0, Math.min(3, Math.floor(Number(body.stagesCleared) || 0)));

    const entry: LeaderboardEntry = {
      id: `lb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      playerName,
      color,
      mode,
      score,
      coins,
      kos,
      stagesCleared,
      createdAt: new Date().toISOString(),
    };
    const updated = saveLeaderboardEntries([entry]);
    res.json({entry, entries: updated.slice(0, 25)});
  });

  app.get('/api/health', (_req, res) => {
    res.json({ok: true, rooms: rooms.size});
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({server, path: '/ws'});

  wss.on('connection', (ws) => {
    const client: ConnectedClient = {
      id: `p_${clientCounter++}_${Math.random().toString(36).slice(2, 5)}`,
      ws,
      roomCode: null,
      name: 'Player',
      color: 'sakura',
      ready: false,
    };

    sendJson(ws, {type: 'welcome', playerId: client.id});

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(client, msg);
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(client);
    });
  });

  // Authoritative multiplayer simulation loop:
  // Physics runs at 60Hz (2 substeps per 33.3ms tick) and broadcasts compact deltas at 30Hz!
  const FIXED_DT = 1 / 60;
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.p2pHosted || !room.world || room.world.phase === 'lobby') continue;

      const world = room.world;
      const prevStage = room.lastBroadcastStage;

      // Substep 1 (consumes edge-triggered jumpPressed / grabPressed)
      const changes1 = stepSimulation(world, room.inputs, FIXED_DT);
      const events1 = [...world.events];

      // Clear edge triggers for substep 2
      for (const pid of Object.keys(room.inputs)) {
        room.inputs[pid].jumpPressed = false;
        room.inputs[pid].grabPressed = false;
      }

      // Substep 2
      const changes2 = stepSimulation(world, room.inputs, FIXED_DT);
      const allEvents = [...events1, ...world.events];
      const allChanges = [...changes1, ...changes2];

      const stageChanged = world.stageIndex !== prevStage;
      if (stageChanged) {
        room.lastBroadcastStage = world.stageIndex;
      }

      // Record match rankings to persistent All-Time Leaderboard once when podium is reached
      if (world.phase === 'podium' && world.summary && !room.recordedSummary) {
        room.recordedSummary = true;
        const newRecords: LeaderboardEntry[] = world.summary.rankings.map((r) => ({
          id: `lb_${Date.now()}_${r.id}`,
          playerName: r.name,
          color: r.color,
          mode: world.mode,
          score: r.score,
          coins: r.coins,
          kos: r.kos,
          stagesCleared: world.summary?.stagesCleared ?? 3,
          createdAt: new Date().toISOString(),
        }));
        saveLeaderboardEntries(newRecords);
      }

      const snapshot: CompactWorldSnapshot = {
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
        tileChanges: !stageChanged && allChanges.length > 0 ? allChanges : undefined,
        players: world.players,
        items: world.items,
        enemies: world.enemies,
        projectiles: world.projectiles,
        boss: world.boss,
        timeRemaining: world.timeRemaining,
        stageClearTimer: world.stageClearTimer,
        tick: world.tick,
        intensity: world.intensity,
        events: allEvents,
        summary: world.summary,
      };

      const payload = JSON.stringify({type: 'world_state', state: snapshot});
      for (const c of room.clients.values()) {
        if (c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(payload);
        }
      }
    }
  }, 33);

  // Mount Vite middleware in development, or static dist in production
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd =
    (process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start') &&
    fs.existsSync(distDir);

  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Starhop Party server listening on http://0.0.0.0:${PORT}`);
  });
}

function handleClientMessage(client: ConnectedClient, msg: Record<string, unknown>) {
  const type = String(msg.type ?? '');

  if (type === 'create_room') {
    leaveCurrentRoom(client);
    const code = generateRoomCode();
    const mode: GameMode = msg.mode === 'battle' ? 'battle' : 'coop';
    client.name = String(msg.name ?? 'Host').trim().slice(0, 14) || 'Host';
    client.color = COLOR_ORDER.includes(msg.color as CharacterColor)
      ? (msg.color as CharacterColor)
      : 'sakura';
    client.ready = true;
    client.roomCode = code;

    const room: Room = {
      code,
      hostId: client.id,
      mode,
      p2pHosted: false,
      clients: new Map([[client.id, client]]),
      inputs: {[client.id]: {...EMPTY_INPUT}},
      world: null,
      lastBroadcastStage: -1,
      recordedSummary: false,
    };
    rooms.set(code, room);
    broadcastLobby(room);
    return;
  }

  if (type === 'join_room') {
    const code = String(msg.roomCode ?? '')
      .trim()
      .toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      sendJson(client.ws, {type: 'error', message: `Room "${code}" not found. Check the code or scan again.`});
      return;
    }
    if (room.clients.size >= 4) {
      sendJson(client.ws, {type: 'error', message: 'This party room is full (4/4 players).'});
      return;
    }
    if (room.world && room.world.phase === 'playing') {
      sendJson(client.ws, {type: 'error', message: 'Match already in progress! Wait for the next round.'});
      return;
    }

    leaveCurrentRoom(client);
    client.name = String(msg.name ?? 'Guest').trim().slice(0, 14) || 'Guest';
    const prefColor = COLOR_ORDER.includes(msg.color as CharacterColor)
      ? (msg.color as CharacterColor)
      : undefined;
    client.color = pickAvailableColor(room, prefColor);
    client.ready = true;
    client.roomCode = code;
    room.clients.set(client.id, client);
    room.inputs[client.id] = {...EMPTY_INPUT};
    broadcastLobby(room);
    return;
  }

  if (type === 'leave_room') {
    leaveCurrentRoom(client);
    return;
  }

  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;

  if (type === 'update_profile') {
    if (typeof msg.name === 'string') {
      client.name = msg.name.trim().slice(0, 14) || client.name;
    }
    if (COLOR_ORDER.includes(msg.color as CharacterColor)) {
      client.color = msg.color as CharacterColor;
    }
    if (typeof msg.ready === 'boolean') {
      client.ready = msg.ready;
    }
    broadcastLobby(room);
    return;
  }

  if (type === 'set_mode' && room.hostId === client.id) {
    room.mode = msg.mode === 'battle' ? 'battle' : 'coop';
    broadcastLobby(room);
    return;
  }

  if (type === 'rtc_signal') {
    const targetId = String(msg.targetId ?? '');
    const target = room.clients.get(targetId);
    if (target) {
      sendJson(target.ws, {
        type: 'rtc_signal',
        fromId: client.id,
        signal: msg.signal,
      });
    }
    return;
  }

  if (type === 'start_p2p_match' && room.hostId === client.id) {
    room.p2pHosted = true;
    room.world = null;
    room.recordedSummary = false;
    const seed = Math.floor(Math.random() * 899999) + 100000;
    const roster = Array.from(room.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isHost: c.id === room.hostId,
    }));
    const payload = {
      type: 'p2p_match_start',
      roomCode: room.code,
      mode: room.mode,
      seed,
      hostId: room.hostId,
      roster,
    };
    for (const c of room.clients.values()) {
      sendJson(c.ws, payload);
    }
    return;
  }

  // Hybrid relay fallback if any guest in a P2P-hosted room is behind a strict firewall
  if (type === 'p2p_relay_state' && room.hostId === client.id) {
    const targets = Array.isArray(msg.targetIds) ? (msg.targetIds as string[]) : [];
    const payload = JSON.stringify({type: 'world_state', state: msg.state});
    for (const tid of targets) {
      const target = room.clients.get(tid);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(payload);
      }
    }
    return;
  }

  if (type === 'p2p_relay_input' && room.p2pHosted) {
    const host = room.clients.get(room.hostId);
    if (host) {
      sendJson(host.ws, {type: 'p2p_guest_input', fromId: client.id, input: msg.input});
    }
    return;
  }

  if (type === 'p2p_record_summary' && room.hostId === client.id && !room.recordedSummary) {
    room.recordedSummary = true;
    const summary = msg.summary as {
      mode?: GameMode;
      stagesCleared?: number;
      rankings?: Array<{
        id: string;
        name: string;
        color: CharacterColor;
        score: number;
        coins: number;
        kos: number;
      }>;
    };
    if (summary && Array.isArray(summary.rankings)) {
      const newRecords: LeaderboardEntry[] = summary.rankings.map((r) => ({
        id: `lb_${Date.now()}_${r.id}`,
        playerName: String(r.name ?? 'Player').slice(0, 16),
        color: COLOR_ORDER.includes(r.color) ? r.color : 'sakura',
        mode: summary.mode === 'battle' ? 'battle' : 'coop',
        score: Math.max(0, Math.min(99999, Math.floor(Number(r.score) || 0))),
        coins: Math.max(0, Math.min(9999, Math.floor(Number(r.coins) || 0))),
        kos: Math.max(0, Math.min(999, Math.floor(Number(r.kos) || 0))),
        stagesCleared: Math.max(0, Math.min(3, Math.floor(Number(summary.stagesCleared) || 3))),
        createdAt: new Date().toISOString(),
      }));
      saveLeaderboardEntries(newRecords);
    }
    return;
  }

  if (type === 'start_match' && room.hostId === client.id) {
    room.p2pHosted = false;
    const seed = Math.floor(Math.random() * 899999) + 100000;
    const roster = Array.from(room.clients.values()).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isHost: c.id === room.hostId,
    }));
    room.world = createMatchWorld(room.code, room.mode, seed, roster);
    room.lastBroadcastStage = -1; // forces full tiles payload on first frame!
    room.recordedSummary = false;
    for (const c of room.clients.values()) {
      room.inputs[c.id] = {...EMPTY_INPUT};
    }
    broadcastLobby(room);
    return;
  }

  if (type === 'return_lobby' && room.hostId === client.id) {
    room.p2pHosted = false;
    room.world = null;
    room.lastBroadcastStage = -1;
    room.recordedSummary = false;
    broadcastLobby(room);
    return;
  }

  if (type === 'input') {
    const prev = room.inputs[client.id] ?? {...EMPTY_INPUT};
    const inc = (msg.input ?? {}) as Partial<PlayerInput>;
    room.inputs[client.id] = {
      left: !!inc.left,
      right: !!inc.right,
      up: !!inc.up,
      jump: !!inc.jump,
      // Latch edge triggers until physics consumes them!
      jumpPressed: prev.jumpPressed || !!inc.jumpPressed,
      grabPressed: prev.grabPressed || !!inc.grabPressed,
    };
  }
}

startServer().catch((err) => {
  console.error('Failed to start Starhop Party server:', err);
  process.exit(1);
});
