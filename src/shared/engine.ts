import {
  generateStage,
  makeBomb,
  makeCoin,
  makeEnemy,
  makePowerUp,
} from './levelGenerator.ts';
import type {
  BonusAward,
  CharacterColor,
  EnemyEntity,
  GameEvent,
  GameMode,
  ItemEntity,
  MatchSummary,
  PlayerInput,
  PlayerState,
  PowerUpType,
  RankedPlayer,
  TileChange,
  WorldState,
} from './types.ts';
import {
  TILE_BOMB_SPAWNER,
  TILE_BRICK,
  TILE_CRACKED,
  TILE_EMPTY,
  TILE_GOAL,
  TILE_GROUND,
  TILE_HAZARD,
  TILE_PLATFORM,
  TILE_QUESTION,
  TILE_SIZE,
  TILE_USED,
} from './types.ts';

const GRAVITY = 1480;
const MAX_FALL_SPEED = 700;
const PLAYER_ACCEL = 2350;
const PLAYER_MAX_SPEED = 290;
const PLAYER_FRICTION = 2050;
const JUMP_VELOCITY = -555;
// Second jump is a cute Kirby-style mini puff hop — just a little up!
const DOUBLE_JUMP_VELOCITY = -345;
const WING_CAP_DOUBLE_JUMP = -400;

let runtimeUid = 1;
function uid(prefix: string): string {
  return `${prefix}_${runtimeUid++}`;
}

function isSolidTile(t: number): boolean {
  return (
    t === TILE_GROUND ||
    t === TILE_BRICK ||
    t === TILE_CRACKED ||
    t === TILE_QUESTION ||
    t === TILE_USED
  );
}

function tileAt(state: WorldState, tx: number, ty: number): number {
  if (tx < 0 || tx >= state.width) return TILE_GROUND;
  if (ty < 0) return TILE_EMPTY;
  if (ty >= state.height) return TILE_EMPTY;
  return state.tiles[ty * state.width + tx];
}

function setWorldTile(
  state: WorldState,
  tileChanges: TileChange[],
  tx: number,
  ty: number,
  tile: number,
) {
  if (tx < 0 || tx >= state.width || ty < 0 || ty >= state.height) return;
  const idx = ty * state.width + tx;
  if (state.tiles[idx] !== tile) {
    state.tiles[idx] = tile;
    tileChanges.push({tx, ty, tile});
  }
}

function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createMatchWorld(
  roomCode: string,
  mode: GameMode,
  seed: number,
  roster: Array<{id: string; name: string; color: CharacterColor; isHost?: boolean}>,
): WorldState {
  const stage = generateStage(mode, 0, seed);
  const players: PlayerState[] = roster.map((r, i) => {
    const sp = stage.spawnPoints[i % stage.spawnPoints.length];
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      x: sp.x,
      y: sp.y,
      vx: 0,
      vy: 0,
      w: 26,
      h: 28,
      facing: i % 2 === 1 && mode === 'battle' ? -1 : 1,
      grounded: false,
      doubleJumpUsed: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      lives: 3,
      maxLives: 3,
      invulnTimer: 1.2,
      inBubble: false,
      stageFinished: false,
      heldItemId: null,
      heldByPlayerId: null,
      powerUp: 'none',
      powerUpTimer: 0,
      anim: 'idle',
      animTime: 0,
      score: 0,
      coins: 0,
      kos: 0,
      bossDamage: 0,
      bombHits: 0,
      deaths: 0,
      isHost: r.isHost,
    };
  });

  return {
    roomCode,
    mode,
    phase: 'playing',
    stageIndex: 0,
    totalStages: 3,
    stageName: stage.stageName,
    theme: stage.theme,
    seed,
    width: stage.width,
    height: stage.height,
    tiles: stage.tiles,
    spawnerCooldowns: {},
    players,
    items: stage.items,
    enemies: stage.enemies,
    projectiles: [],
    boss: stage.boss,
    timeRemaining: stage.timeLimit,
    stageClearTimer: 0,
    tick: 0,
    intensity: 0.25,
    events: [],
    summary: null,
  };
}

export function loadNextStage(state: WorldState): void {
  const nextIndex = state.stageIndex + 1;
  if (nextIndex >= state.totalStages) {
    state.phase = 'podium';
    state.summary = buildMatchSummary(state, state.totalStages);
    return;
  }

  const stage = generateStage(state.mode, nextIndex, state.seed);
  state.stageIndex = nextIndex;
  state.stageName = stage.stageName;
  state.theme = stage.theme;
  state.width = stage.width;
  state.height = stage.height;
  state.tiles = stage.tiles;
  state.spawnerCooldowns = {};
  state.items = stage.items;
  state.enemies = stage.enemies;
  state.projectiles = [];
  state.boss = stage.boss;
  state.timeRemaining = stage.timeLimit;
  state.stageClearTimer = 0;
  state.phase = 'playing';

  // Reset per-level lives to 3 while preserving scores, coins, KOs, and power-ups!
  state.players.forEach((p, i) => {
    const sp = stage.spawnPoints[i % stage.spawnPoints.length];
    p.x = sp.x;
    p.y = sp.y;
    p.vx = 0;
    p.vy = 0;
    p.facing = i % 2 === 1 && state.mode === 'battle' ? -1 : 1;
    p.grounded = false;
    p.doubleJumpUsed = false;
    p.lives = p.maxLives;
    p.invulnTimer = 1.6;
    p.inBubble = false;
    p.stageFinished = false;
    p.heldItemId = null;
    p.heldByPlayerId = null;
    p.anim = 'idle';
  });
}

export function buildMatchSummary(state: WorldState, stagesCleared: number): MatchSummary {
  const awards: BonusAward[] = [];
  const ps = state.players;
  if (ps.length > 0) {
    // Bomb Ace
    const topBomb = [...ps].sort((a, b) => b.bombHits - a.bombHits)[0];
    if (topBomb && topBomb.bombHits > 0) {
      awards.push({
        title: 'Bomb Ace',
        description: `${topBomb.bombHits} explosive blast hits`,
        playerId: topBomb.id,
        playerName: topBomb.name,
        color: topBomb.color,
        bonus: 150,
      });
    }
    // Star Magnet
    const topCoins = [...ps].sort((a, b) => b.coins - a.coins)[0];
    if (topCoins && topCoins.coins > 0) {
      awards.push({
        title: 'Star Collector',
        description: `${topCoins.coins} stars & coins gathered`,
        playerId: topCoins.id,
        playerName: topCoins.name,
        color: topCoins.color,
        bonus: 150,
      });
    }
    // Boss Slayer
    const topBoss = [...ps].sort((a, b) => b.bossDamage - a.bossDamage)[0];
    if (topBoss && topBoss.bossDamage > 0) {
      awards.push({
        title: 'Boss Slayer',
        description: `${topBoss.bossDamage} damage dealt to Baron Cinder-Crown`,
        playerId: topBoss.id,
        playerName: topBoss.name,
        color: topBoss.color,
        bonus: 200,
      });
    }
    // Survivor
    const fewestDeaths = [...ps].sort((a, b) => a.deaths - b.deaths)[0];
    if (fewestDeaths) {
      awards.push({
        title: 'Feather Foot',
        description:
          fewestDeaths.deaths === 0
            ? 'Zero knockouts all match!'
            : `Only ${fewestDeaths.deaths} knockout${fewestDeaths.deaths === 1 ? '' : 's'}`,
        playerId: fewestDeaths.id,
        playerName: fewestDeaths.name,
        color: fewestDeaths.color,
        bonus: 150,
      });
    }
  }

  const bonusMap = new Map<string, number>();
  for (const a of awards) {
    bonusMap.set(a.playerId, (bonusMap.get(a.playerId) ?? 0) + a.bonus);
  }

  const rankings: RankedPlayer[] = ps
    .map((p) => {
      const bonusPoints = bonusMap.get(p.id) ?? 0;
      return {
        rank: 1,
        id: p.id,
        name: p.name,
        color: p.color,
        score: p.score + bonusPoints,
        coins: p.coins,
        kos: p.kos,
        bossDamage: p.bossDamage,
        bombHits: p.bombHits,
        deaths: p.deaths,
        bonusPoints,
      };
    })
    .sort((a, b) => b.score - a.score || b.kos - a.kos)
    .map((entry, idx) => ({...entry, rank: idx + 1}));

  return {
    mode: state.mode,
    seed: state.seed,
    rankings,
    awards,
    stagesCleared,
  };
}

export function stepSimulation(
  state: WorldState,
  inputs: Record<string, PlayerInput>,
  dt: number,
): TileChange[] {
  const tileChanges: TileChange[] = [];
  state.events = [];
  state.tick++;

  if (state.phase === 'podium' || state.phase === 'lobby') {
    return tileChanges;
  }

  if (state.phase === 'stage_clear') {
    state.stageClearTimer -= dt;
    if (state.stageClearTimer <= 0) {
      loadNextStage(state);
    }
    return tileChanges;
  }

  state.timeRemaining = Math.max(0, state.timeRemaining - dt);

  // 1. Update bomb dispenser pedestals
  updateBombSpawners(state, dt);

  // 2. Update players
  for (const p of state.players) {
    const inp = inputs[p.id];
    updatePlayer(state, p, inp, dt, tileChanges);
  }

  // 3. Update items (bombs, crates, coins, stars, powerups)
  updateItems(state, dt, tileChanges);

  // 4. Update enemies
  updateEnemies(state, dt, tileChanges);

  // 5. Update boss
  if (state.boss) {
    updateBoss(state, dt, tileChanges);
  }

  // 6. Update projectiles
  updateProjectiles(state, dt);

  // 7. Check stage completion or round timeout
  checkStageCompletion(state);

  // 8. Compute dynamic music intensity (0..1)
  let intensity = state.boss ? 0.8 : 0.25;
  if (state.boss && state.boss.phase === 2) intensity = 1.0;
  else {
    const hasLiveBomb = state.items.some(
      (it) => (it.kind === 'bomb' || it.kind === 'mega_bomb') && it.fuse > 0 && it.fuse < 1.6,
    );
    const lowLives = state.players.some((p) => p.lives <= 1 && !p.inBubble);
    if (state.timeRemaining < 25 || hasLiveBomb || lowLives) {
      intensity = Math.max(intensity, 0.72);
    } else if (state.mode === 'battle') {
      intensity = Math.max(intensity, 0.55);
    }
  }
  state.intensity = intensity;

  return tileChanges;
}

function updateBombSpawners(state: WorldState, dt: number) {
  for (let ty = 0; ty < state.height; ty++) {
    for (let tx = 0; tx < state.width; tx++) {
      if (state.tiles[ty * state.width + tx] !== TILE_BOMB_SPAWNER) continue;
      const key = `${tx}_${ty}`;
      const cd = (state.spawnerCooldowns[key] ?? 0) - dt;
      if (cd > 0) {
        state.spawnerCooldowns[key] = cd;
        continue;
      }
      const wx = tx * TILE_SIZE + 5;
      const wy = ty * TILE_SIZE - 14;
      const nearbyBomb = state.items.some(
        (it) =>
          (it.kind === 'bomb' || it.kind === 'mega_bomb') &&
          !it.carriedById &&
          Math.hypot(it.x - wx, it.y - wy) < 42,
      );
      if (!nearbyBomb) {
        const b = makeBomb(uid('bomb'), wx, wy, false, null);
        // Idle dispenser bombs wait until grabbed or bumped to tick fast!
        b.fuse = 0;
        state.items.push(b);
        state.spawnerCooldowns[key] = 3.2;
      }
    }
  }
}

function updatePlayer(
  state: WorldState,
  p: PlayerState,
  inp: PlayerInput | undefined,
  dt: number,
  tileChanges: TileChange[],
) {
  p.animTime += dt;
  if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  if (p.powerUpTimer > 0) {
    p.powerUpTimer -= dt;
    if (p.powerUpTimer <= 0 && p.powerUp !== 'star_shield') {
      p.powerUp = 'none';
    }
  }

  if (p.stageFinished) {
    p.vx *= 0.85;
    p.vy = Math.sin(p.animTime * 6) * 18;
    p.anim = 'victory';
    return;
  }

  // Co-op Kirby Rescue Bubble: float gently toward nearest active teammate
  if (p.inBubble) {
    p.anim = 'bubble';
    const aliveFriend = state.players.find((o) => o.id !== p.id && !o.inBubble && !o.stageFinished);
    if (aliveFriend) {
      const dx = aliveFriend.x - p.x;
      const dy = aliveFriend.y - 24 - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      p.x += (dx / dist) * 105 * dt;
      p.y += (dy / dist) * 105 * dt + Math.sin(p.animTime * 5) * 20 * dt;
      if (dist < 30) {
        p.inBubble = false;
        p.lives = 1;
        p.invulnTimer = 2.0;
        p.vy = -220;
        emit(state, {type: 'revive', x: p.x + p.w / 2, y: p.y + p.h / 2, playerId: p.id, label: 'REVIVED!'});
      }
    }
    return;
  }

  // If carried by another player!
  if (p.heldByPlayerId) {
    const carrier = state.players.find((o) => o.id === p.heldByPlayerId);
    if (!carrier || carrier.inBubble || carrier.heldItemId !== p.id) {
      p.heldByPlayerId = null;
    } else {
      p.x = carrier.x;
      p.y = carrier.y - p.h - 2;
      p.vx = carrier.vx;
      p.vy = carrier.vy;
      p.facing = carrier.facing;
      p.grounded = false;
      p.anim = 'jump';
      // Allow carried player to jump free!
      if (inp?.jumpPressed) {
        carrier.heldItemId = null;
        p.heldByPlayerId = null;
        p.vy = JUMP_VELOCITY * 0.92;
        emit(state, {type: 'jump', x: p.x + p.w / 2, y: p.y + p.h, playerId: p.id});
      }
      return;
    }
  }

  const speedMult = p.powerUp === 'wing_cap' ? 1.24 : 1.0;
  const maxSpeed = PLAYER_MAX_SPEED * speedMult;

  const moveDir = (inp?.right ? 1 : 0) - (inp?.left ? 1 : 0);
  if (moveDir !== 0) {
    p.facing = moveDir as 1 | -1;
    p.vx += moveDir * PLAYER_ACCEL * speedMult * dt;
    if (Math.abs(p.vx) > maxSpeed) {
      p.vx = Math.sign(p.vx) * maxSpeed;
    }
  } else {
    const decel = PLAYER_FRICTION * dt * (p.grounded ? 1 : 0.45);
    if (Math.abs(p.vx) <= decel) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * decel;
  }

  // Coyote time & jump buffer for silky platformer feel
  if (p.grounded) {
    p.coyoteTimer = 0.11;
    p.doubleJumpUsed = false;
  } else {
    p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
  }

  if (inp?.jumpPressed) {
    p.jumpBufferTimer = 0.12;
  } else {
    p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
  }

  // Execute primary jump OR mini puff double-jump
  if (p.jumpBufferTimer > 0) {
    if (p.coyoteTimer > 0) {
      p.vy = JUMP_VELOCITY;
      p.grounded = false;
      p.coyoteTimer = 0;
      p.jumpBufferTimer = 0;
      p.anim = 'jump';
      emit(state, {type: 'jump', x: p.x + p.w / 2, y: p.y + p.h, playerId: p.id});
    } else if (!p.doubleJumpUsed) {
      // Kirby-style mini puff hop — just a little upward boost!
      p.vy = p.powerUp === 'wing_cap' ? WING_CAP_DOUBLE_JUMP : DOUBLE_JUMP_VELOCITY;
      p.doubleJumpUsed = true;
      p.jumpBufferTimer = 0;
      p.anim = 'puff';
      p.animTime = 0;
      emit(state, {type: 'double_jump', x: p.x + p.w / 2, y: p.y + p.h, playerId: p.id});
    }
  }

  // Variable jump height when Jump released early
  if (inp && !inp.jump && p.vy < -220) {
    p.vy *= 0.86;
  }

  // Grab / Throw button handling
  if (inp?.grabPressed) {
    handleGrabOrThrow(state, p, inp.up);
  }

  // Gravity
  p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);

  // Move X & collide solid tiles
  p.x += p.vx * dt;
  resolveEntityHorizontal(state, p);

  // Move Y & collide solid / one-way platform tiles
  const prevBottom = p.y + p.h;
  p.y += p.vy * dt;
  p.grounded = false;
  resolvePlayerVertical(state, p, prevBottom, tileChanges);

  // Check special tile overlaps (hazards, goal)
  checkPlayerTileTriggers(state, p);

  // Fell into bottom pit!
  if (p.y > state.height * TILE_SIZE + 48) {
    damagePlayer(state, p, true, null);
  }

  // Animation state
  if (p.invulnTimer > 1.1) p.anim = 'hurt';
  else if (!p.grounded) {
    if (p.anim === 'puff' && p.animTime < 0.25) p.anim = 'puff';
    else p.anim = p.vy < 0 ? 'jump' : 'fall';
  } else if (Math.abs(p.vx) > 22) {
    p.anim = 'run';
  } else {
    p.anim = 'idle';
  }
}

function handleGrabOrThrow(state: WorldState, p: PlayerState, aimUp: boolean) {
  // THROW if currently holding something
  if (p.heldItemId) {
    const throwVx = p.facing * (aimUp ? 220 : 410) + p.vx * 0.4;
    const throwVy = aimUp ? -450 : -235;

    // Check held item
    const item = state.items.find((it) => it.id === p.heldItemId);
    if (item) {
      item.carriedById = null;
      item.thrown = true;
      item.ownerId = p.id;
      item.x = p.x + (p.facing > 0 ? p.w - 4 : -item.w + 4);
      item.y = p.y - 4;
      item.vx = throwVx;
      item.vy = throwVy;
      if ((item.kind === 'bomb' || item.kind === 'mega_bomb') && item.fuse <= 0) {
        item.fuse = 2.0;
      }
      p.heldItemId = null;
      emit(state, {type: 'throw', x: p.x + p.w / 2, y: p.y + p.h / 2, playerId: p.id});
      return;
    }

    // Check held stunned enemy
    const enemy = state.enemies.find((en) => en.id === p.heldItemId);
    if (enemy) {
      enemy.carriedById = null;
      enemy.thrown = true;
      enemy.throwOwnerId = p.id;
      enemy.x = p.x + (p.facing > 0 ? p.w - 2 : -enemy.w + 2);
      enemy.y = p.y - 4;
      enemy.vx = throwVx * 1.08;
      enemy.vy = throwVy;
      p.heldItemId = null;
      emit(state, {type: 'throw', x: p.x + p.w / 2, y: p.y + p.h / 2, playerId: p.id});
      return;
    }

    // Check held teammate / rival player
    const other = state.players.find((o) => o.id === p.heldItemId);
    if (other) {
      other.heldByPlayerId = null;
      other.x = p.x + p.facing * 12;
      other.y = p.y - 10;
      other.vx = throwVx * 0.92;
      other.vy = aimUp ? -520 : -340;
      p.heldItemId = null;
      emit(state, {type: 'throw', x: p.x + p.w / 2, y: p.y + p.h / 2, playerId: p.id});
      return;
    }

    p.heldItemId = null;
    return;
  }

  // GRAB search box (generous reach in front + around player)
  const gx = p.facing > 0 ? p.x - 10 : p.x - 30;
  const gy = p.y - 12;
  const gw = p.w + 40;
  const gh = p.h + 24;

  // Priority 1: Bombs & Crates
  const grabbableItem = state.items.find(
    (it) =>
      (it.kind === 'bomb' || it.kind === 'mega_bomb' || it.kind === 'crate') &&
      !it.carriedById &&
      aabb(gx, gy, gw, gh, it.x, it.y, it.w, it.h),
  );
  if (grabbableItem) {
    grabbableItem.carriedById = p.id;
    grabbableItem.ownerId = p.id;
    grabbableItem.thrown = false;
    if ((grabbableItem.kind === 'bomb' || grabbableItem.kind === 'mega_bomb') && grabbableItem.fuse <= 0) {
      grabbableItem.fuse = 2.6;
    }
    p.heldItemId = grabbableItem.id;
    emit(state, {type: 'grab', x: p.x + p.w / 2, y: p.y, playerId: p.id});
    return;
  }

  // Priority 2: Stunned Enemies
  const stunnedEnemy = state.enemies.find(
    (en) =>
      en.stunnedTimer > 0 &&
      !en.carriedById &&
      aabb(gx, gy, gw, gh, en.x, en.y, en.w, en.h),
  );
  if (stunnedEnemy) {
    stunnedEnemy.carriedById = p.id;
    stunnedEnemy.stunnedTimer = Math.max(stunnedEnemy.stunnedTimer, 4.0);
    p.heldItemId = stunnedEnemy.id;
    emit(state, {type: 'grab', x: p.x + p.w / 2, y: p.y, playerId: p.id});
    return;
  }

  // Priority 3: Nearby Bomb Dispenser tile -> pull a fresh bomb directly!
  const ptx = Math.floor((p.x + p.w / 2) / TILE_SIZE);
  const pty = Math.floor((p.y + p.h / 2) / TILE_SIZE);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (tileAt(state, ptx + dx, pty + dy) === TILE_BOMB_SPAWNER) {
        const fresh = makeBomb(uid('bomb'), p.x, p.y - 24, p.powerUp === 'mega_bomb', p.id);
        fresh.carriedById = p.id;
        state.items.push(fresh);
        p.heldItemId = fresh.id;
        emit(state, {type: 'grab', x: p.x + p.w / 2, y: p.y, playerId: p.id});
        return;
      }
    }
  }

  // Priority 4: Grab another player (fun Mario/Kirby party toss!)
  const otherPlayer = state.players.find(
    (o) =>
      o.id !== p.id &&
      !o.inBubble &&
      !o.stageFinished &&
      !o.heldByPlayerId &&
      aabb(gx, gy, gw, gh, o.x, o.y, o.w, o.h),
  );
  if (otherPlayer) {
    otherPlayer.heldByPlayerId = p.id;
    p.heldItemId = otherPlayer.id;
    emit(state, {type: 'grab', x: p.x + p.w / 2, y: p.y, playerId: p.id});
    return;
  }

  // Priority 5: Mega Bomb Pouch power-up lets you summon a pocket Mega Bomb anywhere!
  if (p.powerUp === 'mega_bomb') {
    const mega = makeBomb(uid('mbomb'), p.x, p.y - 26, true, p.id);
    mega.carriedById = p.id;
    state.items.push(mega);
    p.heldItemId = mega.id;
    emit(state, {type: 'grab', x: p.x + p.w / 2, y: p.y, playerId: p.id});
  }
}

function resolveEntityHorizontal(
  state: WorldState,
  ent: {x: number; y: number; vx: number; w: number; h: number},
): boolean {
  let hitWall = false;
  const topTile = Math.floor((ent.y + 3) / TILE_SIZE);
  const botTile = Math.floor((ent.y + ent.h - 3) / TILE_SIZE);
  if (ent.vx > 0) {
    const rightTile = Math.floor((ent.x + ent.w) / TILE_SIZE);
    for (let ty = topTile; ty <= botTile; ty++) {
      if (isSolidTile(tileAt(state, rightTile, ty))) {
        ent.x = rightTile * TILE_SIZE - ent.w - 0.01;
        ent.vx = 0;
        hitWall = true;
        break;
      }
    }
  } else if (ent.vx < 0) {
    const leftTile = Math.floor(ent.x / TILE_SIZE);
    for (let ty = topTile; ty <= botTile; ty++) {
      if (isSolidTile(tileAt(state, leftTile, ty))) {
        ent.x = (leftTile + 1) * TILE_SIZE + 0.01;
        ent.vx = 0;
        hitWall = true;
        break;
      }
    }
  }
  return hitWall;
}

function resolvePlayerVertical(
  state: WorldState,
  p: PlayerState,
  prevBottom: number,
  tileChanges: TileChange[],
) {
  const leftTile = Math.floor((p.x + 4) / TILE_SIZE);
  const rightTile = Math.floor((p.x + p.w - 4) / TILE_SIZE);

  if (p.vy >= 0) {
    const botTile = Math.floor((p.y + p.h) / TILE_SIZE);
    for (let tx = leftTile; tx <= rightTile; tx++) {
      const t = tileAt(state, tx, botTile);
      if (isSolidTile(t)) {
        p.y = botTile * TILE_SIZE - p.h;
        p.vy = 0;
        p.grounded = true;
        break;
      }
      if (t === TILE_PLATFORM) {
        const platTop = botTile * TILE_SIZE;
        if (prevBottom <= platTop + 8) {
          p.y = platTop - p.h;
          p.vy = 0;
          p.grounded = true;
          break;
        }
      }
    }
  } else {
    const topTile = Math.floor(p.y / TILE_SIZE);
    for (let tx = leftTile; tx <= rightTile; tx++) {
      const t = tileAt(state, tx, topTile);
      if (isSolidTile(t)) {
        p.y = (topTile + 1) * TILE_SIZE + 0.01;
        p.vy = 0;
        if (t === TILE_QUESTION) {
          triggerQuestionBlock(state, tileChanges, tx, topTile, p);
        }
        break;
      }
    }
  }
}

function triggerQuestionBlock(
  state: WorldState,
  tileChanges: TileChange[],
  tx: number,
  ty: number,
  player: PlayerState | null,
) {
  setWorldTile(state, tileChanges, tx, ty, TILE_USED);
  const pool: PowerUpType[] = ['mega_bomb', 'wing_cap', 'star_shield', 'gold_magnet'];
  const chosen = pool[(tx + ty + state.tick) % pool.length];
  const pu = makePowerUp(uid('pu'), tx * TILE_SIZE + 4, (ty - 1) * TILE_SIZE, chosen);
  state.items.push(pu);
  if (player) {
    player.score += 30;
  }
  emit(state, {
    type: 'powerup',
    x: tx * TILE_SIZE + 16,
    y: ty * TILE_SIZE,
    playerId: player?.id,
  });
}

function checkPlayerTileTriggers(state: WorldState, p: PlayerState) {
  const leftTile = Math.floor((p.x + 5) / TILE_SIZE);
  const rightTile = Math.floor((p.x + p.w - 5) / TILE_SIZE);
  const topTile = Math.floor((p.y + 4) / TILE_SIZE);
  const botTile = Math.floor((p.y + p.h - 2) / TILE_SIZE);

  for (let ty = topTile; ty <= botTile; ty++) {
    for (let tx = leftTile; tx <= rightTile; tx++) {
      const t = tileAt(state, tx, ty);
      if (t === TILE_HAZARD) {
        damagePlayer(state, p, false, null);
        return;
      }
      if (t === TILE_GOAL && state.mode === 'coop' && !p.stageFinished) {
        p.stageFinished = true;
        const finishOrder = state.players.filter((o) => o.stageFinished).length;
        const finishBonus = Math.max(100, 300 - (finishOrder - 1) * 60);
        p.score += finishBonus;
        emit(state, {
          type: 'stage_clear',
          x: p.x + p.w / 2,
          y: p.y,
          playerId: p.id,
          value: finishBonus,
          label: `+${finishBonus} GOAL!`,
        });
      }
    }
  }
}

function damagePlayer(
  state: WorldState,
  p: PlayerState,
  fellInPit: boolean,
  attackerId: string | null,
) {
  if (p.inBubble || p.stageFinished) return;
  if (!fellInPit && p.invulnTimer > 0) return;

  // Star Shield absorbs 1 non-pit hit!
  if (!fellInPit && p.powerUp === 'star_shield') {
    p.powerUp = 'none';
    p.powerUpTimer = 0;
    p.invulnTimer = 1.4;
    p.vy = -260;
    emit(state, {type: 'hurt', x: p.x + p.w / 2, y: p.y + p.h / 2, playerId: p.id, label: 'SHIELDED'});
    return;
  }

  p.lives = Math.max(0, p.lives - 1);
  p.invulnTimer = 1.8;
  emit(state, {type: 'hurt', x: p.x + p.w / 2, y: p.y + p.h / 2, playerId: p.id});

  if (attackerId && attackerId !== p.id) {
    const attacker = state.players.find((o) => o.id === attackerId);
    if (attacker) {
      attacker.bombHits++;
      attacker.score += state.mode === 'battle' ? 120 : 25;
      if (p.lives === 0) {
        attacker.kos++;
        attacker.score += state.mode === 'battle' ? 200 : 0;
      }
    }
  }

  if (p.lives <= 0) {
    p.deaths++;
    p.heldItemId = null;
    if (state.mode === 'coop') {
      const anyTeammateAlive = state.players.some(
        (o) => o.id !== p.id && !o.inBubble && !o.stageFinished,
      );
      if (anyTeammateAlive) {
        p.inBubble = true;
        p.y = Math.min(p.y, (state.height - 5) * TILE_SIZE);
      } else {
        // Solo or full wipe: quick stage checkpoint respawn with 3 fresh lives & small score penalty
        respawnPlayerSafe(state, p);
        p.lives = p.maxLives;
        p.score = Math.max(0, p.score - 50);
      }
    } else {
      // Bomb Battle: respawn safely after KO with full lives so party action stays lively
      respawnPlayerSafe(state, p);
      p.lives = p.maxLives;
    }
  } else if (fellInPit) {
    respawnPlayerSafe(state, p);
  } else {
    p.vy = -310;
    p.vx = -p.facing * 180;
  }
}

function respawnPlayerSafe(state: WorldState, p: PlayerState) {
  const safeFriend = state.players.find((o) => o.id !== p.id && !o.inBubble && o.grounded);
  if (safeFriend && state.mode === 'coop') {
    p.x = safeFriend.x;
    p.y = safeFriend.y - 32;
  } else {
    p.x = Math.max(2 * TILE_SIZE, Math.min((state.width - 4) * TILE_SIZE, state.mode === 'battle' ? (4 + ((state.tick * 7) % (state.width - 8))) * TILE_SIZE : 3 * TILE_SIZE));
    p.y = 6 * TILE_SIZE;
  }
  p.vx = 0;
  p.vy = 0;
  p.invulnTimer = 2.0;
}

function updateItems(state: WorldState, dt: number, tileChanges: TileChange[]) {
  const toRemove = new Set<string>();

  for (const it of state.items) {
    it.bobPhase += dt * 4.5;

    // Collectibles: Coin, Star, Power-Up
    if (it.kind === 'coin' || it.kind === 'star' || it.kind === 'powerup') {
      if (it.kind === 'powerup') {
        it.vy = Math.min(MAX_FALL_SPEED, it.vy + GRAVITY * 0.85 * dt);
        it.x += it.vx * dt;
        if (resolveEntityHorizontal(state, it)) it.vx = -it.vx;
        const prevB = it.y + it.h;
        it.y += it.vy * dt;
        resolveSimpleVertical(state, it, prevB, false);
      } else {
        // Golden Magnet pulls nearby coins & stars!
        for (const p of state.players) {
          if (p.powerUp === 'gold_magnet' && !p.inBubble) {
            const dx = p.x + p.w / 2 - (it.x + it.w / 2);
            const dy = p.y + p.h / 2 - (it.y + it.h / 2);
            const dist = Math.hypot(dx, dy);
            if (dist < 175 && dist > 1) {
              it.x += (dx / dist) * 290 * dt;
              it.y += (dy / dist) * 290 * dt;
            }
          }
        }
      }

      for (const p of state.players) {
        if (p.inBubble || p.stageFinished) continue;
        if (aabb(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) {
          const mult = p.powerUp === 'gold_magnet' ? 2 : 1;
          if (it.kind === 'coin') {
            p.coins += 1;
            p.score += 20 * mult;
            emit(state, {type: 'coin', x: it.x + 9, y: it.y + 9, playerId: p.id, value: 20 * mult});
          } else if (it.kind === 'star') {
            p.coins += 5;
            p.score += 120 * mult;
            emit(state, {
              type: 'star',
              x: it.x + 13,
              y: it.y + 13,
              playerId: p.id,
              value: 120 * mult,
              label: `+${120 * mult} STAR!`,
            });
          } else if (it.kind === 'powerup' && it.powerUpKind) {
            p.powerUp = it.powerUpKind;
            p.powerUpTimer = it.powerUpKind === 'star_shield' ? 999 : 14;
            p.score += 50;
            const labels: Record<PowerUpType, string> = {
              none: '',
              mega_bomb: 'MEGA BOMBS!',
              wing_cap: 'WINGED CAP!',
              star_shield: 'STAR SHIELD!',
              gold_magnet: '2X MAGNET!',
            };
            emit(state, {
              type: 'powerup',
              x: p.x + p.w / 2,
              y: p.y,
              playerId: p.id,
              label: labels[it.powerUpKind],
            });
          }
          toRemove.add(it.id);
          break;
        }
      }
      continue;
    }

    // Carried Bombs & Crates follow carrier overhead
    if (it.carriedById) {
      const carrier = state.players.find((p) => p.id === it.carriedById);
      if (!carrier || carrier.inBubble || carrier.heldItemId !== it.id) {
        it.carriedById = null;
      } else {
        it.x = carrier.x + carrier.w / 2 - it.w / 2;
        it.y = carrier.y - it.h - 2;
        it.vx = carrier.vx;
        it.vy = carrier.vy;
      }
    } else {
      // Free physics for bombs & crates
      it.vy = Math.min(MAX_FALL_SPEED, it.vy + GRAVITY * dt);
      it.x += it.vx * dt;
      const hitWall = resolveEntityHorizontal(state, it);
      if (hitWall) {
        // Thrown bomb explodes immediately if it slams into a cracked wall!
        if (it.thrown && (it.kind === 'bomb' || it.kind === 'mega_bomb')) {
          const checkTx = Math.floor((it.x + it.w / 2 + Math.sign(it.vx || 1) * 16) / TILE_SIZE);
          const checkTy = Math.floor((it.y + it.h / 2) / TILE_SIZE);
          if (
            tileAt(state, checkTx, checkTy) === TILE_CRACKED ||
            tileAt(state, checkTx - 1, checkTy) === TILE_CRACKED ||
            tileAt(state, checkTx + 1, checkTy) === TILE_CRACKED
          ) {
            explodeBomb(state, it, tileChanges);
            toRemove.add(it.id);
            continue;
          }
        }
        // Thrown crate shatters a cracked wall block on high-speed impact!
        if (it.thrown && it.kind === 'crate') {
          const nearTx = Math.floor((it.x + it.w / 2) / TILE_SIZE);
          const nearTy = Math.floor((it.y + it.h / 2) / TILE_SIZE);
          for (const ox of [-1, 0, 1]) {
            if (tileAt(state, nearTx + ox, nearTy) === TILE_CRACKED) {
              setWorldTile(state, tileChanges, nearTx + ox, nearTy, TILE_EMPTY);
              emit(state, {
                type: 'brick_break',
                x: (nearTx + ox) * TILE_SIZE + 16,
                y: nearTy * TILE_SIZE + 16,
                playerId: it.ownerId ?? undefined,
              });
              toRemove.add(it.id);
              break;
            }
          }
          if (toRemove.has(it.id)) continue;
        }
        it.vx = -it.vx * 0.45;
      }

      const prevB = it.y + it.h;
      it.y += it.vy * dt;
      const landed = resolveSimpleVertical(state, it, prevB, true);
      if (landed) {
        it.vx *= 0.82;
        if (Math.abs(it.vx) < 20) it.thrown = false;
      }

      if (it.y > state.height * TILE_SIZE + 60) {
        toRemove.add(it.id);
        continue;
      }
    }

    // Thrown bomb / crate hitting enemies, boss, or rival players!
    if (it.thrown && !it.carriedById) {
      // Check enemies
      for (const en of state.enemies) {
        if (en.carriedById) continue;
        if (aabb(it.x, it.y, it.w, it.h, en.x, en.y, en.w, en.h)) {
          if (it.kind === 'bomb' || it.kind === 'mega_bomb') {
            explodeBomb(state, it, tileChanges);
            toRemove.add(it.id);
            break;
          } else {
            // Crate slams enemy!
            en.hp -= 2;
            en.hitFlash = 0.25;
            en.vx = Math.sign(it.vx || 1) * 180;
            en.vy = -220;
            const owner = state.players.find((p) => p.id === it.ownerId);
            if (owner && en.hp <= 0) {
              owner.kos++;
              owner.score += 100;
            }
            emit(state, {type: 'brick_break', x: it.x + 13, y: it.y + 13, playerId: it.ownerId ?? undefined});
            toRemove.add(it.id);
            break;
          }
        }
      }
      if (toRemove.has(it.id)) continue;

      // Check Boss
      if (state.boss && state.boss.action !== 'defeated') {
        const b = state.boss;
        if (aabb(it.x, it.y, it.w, it.h, b.x, b.y, b.w, b.h)) {
          if (it.kind === 'bomb' || it.kind === 'mega_bomb') {
            explodeBomb(state, it, tileChanges);
            toRemove.add(it.id);
            continue;
          } else {
            damageBoss(state, b, 10, it.ownerId);
            emit(state, {type: 'brick_break', x: it.x + 13, y: it.y + 13, playerId: it.ownerId ?? undefined});
            toRemove.add(it.id);
            continue;
          }
        }
      }

      // Check rival players in Bomb Battle (direct hit detonates bomb!)
      if (state.mode === 'battle') {
        for (const target of state.players) {
          if (target.id === it.ownerId || target.inBubble) continue;
          if (aabb(it.x, it.y, it.w, it.h, target.x, target.y, target.w, target.h)) {
            if (it.kind === 'bomb' || it.kind === 'mega_bomb') {
              explodeBomb(state, it, tileChanges);
              toRemove.add(it.id);
              break;
            } else {
              damagePlayer(state, target, false, it.ownerId);
              emit(state, {type: 'brick_break', x: it.x + 13, y: it.y + 13});
              toRemove.add(it.id);
              break;
            }
          }
        }
        if (toRemove.has(it.id)) continue;
      }
    }

    // Fuse countdown on lit bombs
    if ((it.kind === 'bomb' || it.kind === 'mega_bomb') && it.fuse > 0) {
      it.fuse -= dt;
      if (it.fuse <= 0) {
        if (it.carriedById) {
          const holder = state.players.find((p) => p.id === it.carriedById);
          if (holder && holder.heldItemId === it.id) holder.heldItemId = null;
          it.carriedById = null;
        }
        explodeBomb(state, it, tileChanges);
        toRemove.add(it.id);
      }
    }
  }

  if (toRemove.size > 0) {
    state.items = state.items.filter((it) => !toRemove.has(it.id));
  }
}

function explodeBomb(state: WorldState, bomb: ItemEntity, tileChanges: TileChange[]) {
  const isMega = bomb.kind === 'mega_bomb';
  const cx = bomb.x + bomb.w / 2;
  const cy = bomb.y + bomb.h / 2;
  const radius = isMega ? 116 : 82;

  emit(state, {
    type: isMega ? 'mega_explode' : 'explode',
    x: cx,
    y: cy,
    playerId: bomb.ownerId ?? undefined,
  });

  // 1. Destroy Cracked Walls & trigger ? Blocks within blast radius
  const minTx = Math.max(1, Math.floor((cx - radius) / TILE_SIZE));
  const maxTx = Math.min(state.width - 2, Math.floor((cx + radius) / TILE_SIZE));
  const minTy = Math.max(0, Math.floor((cy - radius) / TILE_SIZE));
  const maxTy = Math.min(state.height - 1, Math.floor((cy + radius) / TILE_SIZE));

  const owner = bomb.ownerId ? state.players.find((p) => p.id === bomb.ownerId) ?? null : null;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const txCx = tx * TILE_SIZE + TILE_SIZE / 2;
      const tyCy = ty * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(txCx - cx, tyCy - cy) <= radius) {
        const t = tileAt(state, tx, ty);
        if (t === TILE_CRACKED) {
          setWorldTile(state, tileChanges, tx, ty, TILE_EMPTY);
          if (owner) owner.score += 35;
          emit(state, {type: 'brick_break', x: txCx, y: tyCy, playerId: owner?.id});
        } else if (t === TILE_QUESTION) {
          triggerQuestionBlock(state, tileChanges, tx, ty, owner);
        }
      }
    }
  }

  // 2. Blast enemies
  for (const en of state.enemies) {
    const dist = Math.hypot(en.x + en.w / 2 - cx, en.y + en.h / 2 - cy);
    if (dist <= radius + 14) {
      en.hp -= isMega ? 4 : 2;
      en.hitFlash = 0.3;
      if (owner) {
        owner.bombHits++;
        if (en.hp <= 0) {
          owner.kos++;
          owner.score += 110;
        }
      }
    }
  }

  // 3. Blast Boss!
  if (state.boss && state.boss.action !== 'defeated') {
    const b = state.boss;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    if (Math.hypot(bx - cx, by - cy) <= radius + 42) {
      const dmg = isMega ? 22 : 14;
      damageBoss(state, b, dmg, bomb.ownerId);
      if (owner) owner.bombHits++;
    }
  }

  // 4. Knockback / damage players (competitive damage in Bomb Battle; playful bounce in Co-op!)
  for (const p of state.players) {
    if (p.inBubble || p.stageFinished) continue;
    const dx = p.x + p.w / 2 - cx;
    const dy = p.y + p.h / 2 - cy;
    const dist = Math.hypot(dx, dy);
    if (dist <= radius + 12) {
      const nx = dist > 1 ? dx / dist : 0;
      const ny = dist > 1 ? dy / dist : -1;
      p.vx += nx * 320;
      p.vy = Math.min(p.vy, -320 + ny * 120);
      if (state.mode === 'battle') {
        if (p.id !== bomb.ownerId || dist < 34) {
          damagePlayer(state, p, false, bomb.ownerId);
        }
      }
    }
  }
}

function resolveSimpleVertical(
  state: WorldState,
  ent: {x: number; y: number; vy: number; w: number; h: number},
  prevBottom: number,
  bounce: boolean,
): boolean {
  const leftTile = Math.floor((ent.x + 2) / TILE_SIZE);
  const rightTile = Math.floor((ent.x + ent.w - 2) / TILE_SIZE);
  if (ent.vy >= 0) {
    const botTile = Math.floor((ent.y + ent.h) / TILE_SIZE);
    for (let tx = leftTile; tx <= rightTile; tx++) {
      const t = tileAt(state, tx, botTile);
      if (isSolidTile(t) || (t === TILE_PLATFORM && prevBottom <= botTile * TILE_SIZE + 8)) {
        ent.y = botTile * TILE_SIZE - ent.h;
        if (bounce && ent.vy > 140) {
          ent.vy = -ent.vy * 0.42;
          return false;
        }
        ent.vy = 0;
        return true;
      }
    }
  } else {
    const topTile = Math.floor(ent.y / TILE_SIZE);
    for (let tx = leftTile; tx <= rightTile; tx++) {
      if (isSolidTile(tileAt(state, tx, topTile))) {
        ent.y = (topTile + 1) * TILE_SIZE + 0.01;
        ent.vy = 0;
        break;
      }
    }
  }
  return false;
}

function updateEnemies(state: WorldState, dt: number, tileChanges: TileChange[]) {
  const alive: EnemyEntity[] = [];

  for (const en of state.enemies) {
    if (en.hp <= 0) {
      // Drop a celebratory coin on defeat!
      state.items.push(makeCoin(uid('coin'), en.x + 5, en.y + 4));
      continue;
    }

    if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt);

    // Carried stunned enemy
    if (en.carriedById) {
      const carrier = state.players.find((p) => p.id === en.carriedById);
      if (!carrier || carrier.inBubble || carrier.heldItemId !== en.id) {
        en.carriedById = null;
      } else {
        en.x = carrier.x + carrier.w / 2 - en.w / 2;
        en.y = carrier.y - en.h - 2;
        alive.push(en);
        continue;
      }
    }

    // Thrown enemy projectile!
    if (en.thrown) {
      en.vy = Math.min(MAX_FALL_SPEED, en.vy + GRAVITY * dt);
      en.x += en.vx * dt;
      const hitWall = resolveEntityHorizontal(state, en);
      const prevB = en.y + en.h;
      en.y += en.vy * dt;
      resolveSimpleVertical(state, en, prevB, true);

      // Smash other enemies
      for (const other of state.enemies) {
        if (other.id !== en.id && other.hp > 0 && aabb(en.x, en.y, en.w, en.h, other.x, other.y, other.w, other.h)) {
          other.hp = 0;
          en.hp = 0;
          const owner = state.players.find((p) => p.id === en.throwOwnerId);
          if (owner) {
            owner.kos += 2;
            owner.score += 180;
          }
          emit(state, {type: 'stomp', x: other.x + 14, y: other.y + 14, playerId: en.throwOwnerId ?? undefined, label: 'STRIKE!'});
          break;
        }
      }

      // Smash Boss!
      if (state.boss && state.boss.action !== 'defeated' && aabb(en.x, en.y, en.w, en.h, state.boss.x, state.boss.y, state.boss.w, state.boss.h)) {
        damageBoss(state, state.boss, 14, en.throwOwnerId);
        en.hp = 0;
      }

      // Smash cracked wall
      if (hitWall) {
        const tx = Math.floor((en.x + en.w / 2) / TILE_SIZE);
        const ty = Math.floor((en.y + en.h / 2) / TILE_SIZE);
        for (const ox of [-1, 0, 1]) {
          if (tileAt(state, tx + ox, ty) === TILE_CRACKED) {
            setWorldTile(state, tileChanges, tx + ox, ty, TILE_EMPTY);
            emit(state, {type: 'brick_break', x: (tx + ox) * TILE_SIZE + 16, y: ty * TILE_SIZE + 16});
          }
        }
        en.hp = 0;
      }

      if (en.hp > 0 && en.y < state.height * TILE_SIZE + 40) alive.push(en);
      continue;
    }

    // Stunned state (ready to be grabbed & thrown!)
    if (en.stunnedTimer > 0) {
      en.stunnedTimer -= dt;
      en.vx *= 0.85;
      en.vy = Math.min(MAX_FALL_SPEED, en.vy + GRAVITY * dt);
      const prevB = en.y + en.h;
      en.y += en.vy * dt;
      resolveSimpleVertical(state, en, prevB, false);
      alive.push(en);
      continue;
    }

    // AI Patterns per enemy archetype!
    en.aiTimer -= dt;

    if (en.kind === 'swooper') {
      // Aerial sine-wave patrol & spark drop
      en.x += en.vx * dt;
      en.y = en.baseY + Math.sin(state.tick * 0.08 + en.baseY) * 28;
      if (resolveEntityHorizontal(state, en)) {
        en.facing = (en.facing * -1) as 1 | -1;
        en.vx = en.facing * 84;
      }
      if (en.aiTimer <= 0) {
        en.aiTimer = 2.6;
        const nearP = findNearestPlayer(state, en.x, en.y, 240);
        if (nearP) {
          state.projectiles.push({
            id: uid('proj'),
            kind: 'ember',
            x: en.x + en.w / 2,
            y: en.y + en.h,
            vx: 0,
            vy: 195,
            radius: 7,
            life: 2.2,
          });
        }
      }
    } else if (en.kind === 'turret') {
      // Stationary ranged Flame Chomper firing telegraphed fireballs
      en.vy = Math.min(MAX_FALL_SPEED, en.vy + GRAVITY * dt);
      const prevB = en.y + en.h;
      en.y += en.vy * dt;
      resolveSimpleVertical(state, en, prevB, false);
      const nearP = findNearestPlayer(state, en.x, en.y, 340);
      if (nearP) {
        en.facing = nearP.x < en.x ? -1 : 1;
        if (en.aiTimer <= 0) {
          en.aiTimer = 2.2;
          state.projectiles.push({
            id: uid('proj'),
            kind: 'fireball',
            x: en.x + (en.facing > 0 ? en.w : 0),
            y: en.y + 10,
            vx: en.facing * 190,
            vy: -40,
            radius: 8,
            life: 2.6,
          });
        }
      }
    } else {
      // Hopper (classic patroller) & Shellback (spiky rusher)
      const nearP = en.kind === 'shellback' ? findNearestPlayer(state, en.x, en.y, 260) : null;
      if (en.kind === 'shellback' && nearP && Math.abs(nearP.y - en.y) < 42) {
        en.facing = nearP.x < en.x ? -1 : 1;
        en.vx = en.facing * 145;
      } else {
        en.vx = en.facing * (en.kind === 'shellback' ? 88 : 68);
      }

      en.vy = Math.min(MAX_FALL_SPEED, en.vy + GRAVITY * dt);
      en.x += en.vx * dt;
      const hitWall = resolveEntityHorizontal(state, en);

      // Ledge edge turnaround
      const probeTx = Math.floor((en.facing > 0 ? en.x + en.w + 4 : en.x - 4) / TILE_SIZE);
      const probeTy = Math.floor((en.y + en.h + 4) / TILE_SIZE);
      const aheadTile = tileAt(state, probeTx, probeTy);
      if (hitWall || (aheadTile === TILE_EMPTY && en.vy === 0) || aheadTile === TILE_HAZARD) {
        en.facing = (en.facing * -1) as 1 | -1;
        en.vx = en.facing * 70;
      }

      const prevB = en.y + en.h;
      en.y += en.vy * dt;
      resolveSimpleVertical(state, en, prevB, false);
    }

    // Player collision with active enemy (Mario stomp vs hurt!)
    for (const p of state.players) {
      if (p.inBubble || p.stageFinished || p.heldByPlayerId) continue;
      if (aabb(p.x, p.y, p.w, p.h, en.x, en.y, en.w, en.h)) {
        const stomping = p.vy > 40 && p.y + p.h - p.vy * dt <= en.y + 14;
        if (stomping && en.kind !== 'shellback') {
          p.vy = -370;
          p.doubleJumpUsed = false;
          if (en.kind === 'hopper') {
            // Stun hopper so player can GRAB & THROW it!
            en.stunnedTimer = 4.2;
            en.vx = 0;
            p.score += 40;
            emit(state, {type: 'stomp', x: en.x + 14, y: en.y, playerId: p.id, label: 'STUNNED!'});
          } else {
            en.hp = 0;
            p.kos++;
            p.score += 90;
            emit(state, {type: 'stomp', x: en.x + 14, y: en.y, playerId: p.id, value: 90});
          }
        } else {
          damagePlayer(state, p, false, null);
        }
      }
    }

    if (en.hp > 0 && en.y < state.height * TILE_SIZE + 50) {
      alive.push(en);
    } else if (en.hp <= 0) {
      state.items.push(makeCoin(uid('coin'), en.x + 5, en.y + 4));
    }
  }

  state.enemies = alive;
}

function updateBoss(state: WorldState, dt: number, tileChanges: TileChange[]) {
  const b = state.boss;
  if (!b) return;
  if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);

  if (b.action === 'defeated') {
    b.actionTimer -= dt;
    b.vy += GRAVITY * 0.5 * dt;
    b.y += b.vy * dt;
    return;
  }

  // Phase 2 transition at <= 50% HP!
  if (b.phase === 1 && b.hp <= b.maxHp * 0.5) {
    b.phase = 2;
    b.hitFlash = 0.5;
    emit(state, {type: 'boss_slam', x: b.x + b.w / 2, y: b.y + b.h / 2, label: 'ENRAGED PHASE 2!'});
  }

  const target = findNearestPlayer(state, b.x + b.w / 2, b.y + b.h / 2, 2000);
  b.actionTimer -= dt;

  const speedScale = b.phase === 2 ? 1.25 : 1.0;

  switch (b.action) {
    case 'intro':
      if (b.actionTimer <= 0) {
        b.action = 'patrol';
        b.actionTimer = 2.0;
      }
      break;

    case 'patrol':
      if (target) b.facing = target.x < b.x ? -1 : 1;
      b.vx = b.facing * 92 * speedScale;
      if (b.actionTimer <= 0) {
        const roll = (state.tick + Math.floor(b.hp)) % 3;
        if (roll === 0) {
          b.action = 'telegraph_slam';
          b.actionTimer = 0.65;
          b.vx = 0;
        } else if (roll === 1) {
          b.action = 'fire_barrage';
          b.actionTimer = 1.6;
          b.vx = 0;
        } else {
          b.action = b.phase === 2 ? 'charge' : 'summon';
          b.actionTimer = b.phase === 2 ? 1.5 : 1.2;
        }
      }
      break;

    case 'telegraph_slam':
      b.vx = 0;
      if (b.actionTimer <= 0) {
        b.action = 'slam';
        b.vy = -560;
        b.vx = target ? Math.sign(target.x - b.x) * 165 : b.facing * 150;
        b.actionTimer = 1.8;
      }
      break;

    case 'slam':
      if (b.grounded && b.actionTimer < 1.5) {
        b.vx = 0;
        emit(state, {type: 'boss_slam', x: b.x + b.w / 2, y: b.y + b.h});
        // Spawn twin ground shockwaves left & right!
        for (const dir of [-1, 1]) {
          state.projectiles.push({
            id: uid('shock'),
            kind: 'shockwave',
            x: b.x + b.w / 2 + dir * 24,
            y: b.y + b.h - 12,
            vx: dir * (215 * speedScale),
            vy: 0,
            radius: 13,
            life: 2.2,
            fromBoss: true,
          });
        }
        b.action = 'patrol';
        b.actionTimer = 1.6;
      }
      break;

    case 'fire_barrage':
      if (target) b.facing = target.x < b.x ? -1 : 1;
      if (Math.floor((b.actionTimer + dt) * 2.5) !== Math.floor(b.actionTimer * 2.5)) {
        const spread = b.phase === 2 ? [-95, -20, 45] : [-60, 15];
        for (const vy of spread) {
          state.projectiles.push({
            id: uid('bfire'),
            kind: 'fireball',
            x: b.x + (b.facing > 0 ? b.w : 0),
            y: b.y + 28,
            vx: b.facing * 230 * speedScale,
            vy,
            radius: 9,
            life: 2.6,
            fromBoss: true,
          });
        }
      }
      if (b.actionTimer <= 0) {
        b.action = 'patrol';
        b.actionTimer = 1.5;
      }
      break;

    case 'summon':
      b.vx = 0;
      if (b.actionTimer <= 0.6 && state.enemies.length < 3) {
        state.enemies.push(makeEnemy(uid('ben'), 'hopper', b.x - 36, b.y + 24));
        state.enemies.push(makeEnemy(uid('ben'), 'hopper', b.x + b.w + 12, b.y + 24));
        // Drop a helpful bomb onto the arena floor too!
        const dropBomb = makeBomb(uid('bbomb'), b.x + b.w / 2, b.y - 16, false, null);
        dropBomb.vx = -b.facing * 140;
        dropBomb.vy = -220;
        dropBomb.fuse = 0;
        state.items.push(dropBomb);
        b.action = 'patrol';
        b.actionTimer = 2.0;
      } else if (b.actionTimer <= 0) {
        b.action = 'patrol';
        b.actionTimer = 1.5;
      }
      break;

    case 'charge':
      b.vx = b.facing * 290;
      if (b.actionTimer <= 0) {
        b.action = 'dizzy';
        b.vx = 0;
        b.actionTimer = 2.6;
      }
      break;

    case 'dizzy':
      b.vx = 0;
      if (b.actionTimer <= 0) {
        b.action = 'patrol';
        b.actionTimer = 1.4;
      }
      break;
  }

  // Boss physics
  b.vy = Math.min(MAX_FALL_SPEED, b.vy + GRAVITY * dt);
  b.x += b.vx * dt;
  const hitWall = resolveEntityHorizontal(state, b);
  if (hitWall) {
    b.facing = (b.facing * -1) as 1 | -1;
    if (b.action === 'charge') {
      // Crashing into the arena wall makes Baron Cinder-Crown dizzy!
      b.action = 'dizzy';
      b.actionTimer = 2.8;
      emit(state, {type: 'boss_slam', x: b.x + b.w / 2, y: b.y + b.h / 2, label: 'DIZZY!'});
    }
  }
  const prevB = b.y + b.h;
  b.y += b.vy * dt;
  b.grounded = resolveSimpleVertical(state, b, prevB, false);

  // Player contact with boss (can stomp when Dizzy, otherwise hurts!)
  for (const p of state.players) {
    if (p.inBubble || p.stageFinished) continue;
    if (aabb(p.x, p.y, p.w, p.h, b.x + 6, b.y + 6, b.w - 12, b.h - 8)) {
      const stomping = p.vy > 30 && p.y + p.h - p.vy * dt <= b.y + 22;
      if (stomping && b.action === 'dizzy') {
        p.vy = -440;
        p.doubleJumpUsed = false;
        damageBoss(state, b, 12, p.id);
      } else {
        damagePlayer(state, p, false, null);
      }
    }
  }
  void tileChanges;
}

function damageBoss(state: WorldState, b: NonNullable<WorldState['boss']>, amount: number, attackerId: string | null) {
  if (b.action === 'defeated') return;
  b.hp = Math.max(0, b.hp - amount);
  b.hitFlash = 0.28;
  const attacker = attackerId ? state.players.find((p) => p.id === attackerId) : null;
  if (attacker) {
    attacker.bossDamage += amount;
    attacker.score += amount * 12;
  }
  emit(state, {
    type: 'boss_hit',
    x: b.x + b.w / 2,
    y: b.y + 18,
    playerId: attackerId ?? undefined,
    value: amount,
    label: `-${amount}`,
  });

  if (b.hp <= 0) {
    b.action = 'defeated';
    b.actionTimer = 2.4;
    b.vy = -300;
    if (attacker) {
      attacker.kos++;
      attacker.score += 350;
    }
    emit(state, {
      type: 'boss_defeat',
      x: b.x + b.w / 2,
      y: b.y + b.h / 2,
      playerId: attackerId ?? undefined,
      label: 'BOSS DEFEATED!',
    });
    if (state.mode === 'coop') {
      state.phase = 'stage_clear';
      state.stageClearTimer = 2.6;
    }
  }
}

function updateProjectiles(state: WorldState, dt: number) {
  const active = [];
  for (const pr of state.projectiles) {
    pr.life -= dt;
    if (pr.life <= 0) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.kind === 'fireball') {
      pr.vy += 120 * dt;
    }

    const tx = Math.floor(pr.x / TILE_SIZE);
    const ty = Math.floor(pr.y / TILE_SIZE);
    if (pr.kind !== 'shockwave' && isSolidTile(tileAt(state, tx, ty))) {
      continue;
    }

    let hitPlayer = false;
    for (const p of state.players) {
      if (p.inBubble || p.stageFinished) continue;
      if (
        aabb(
          pr.x - pr.radius,
          pr.y - pr.radius,
          pr.radius * 2,
          pr.radius * 2,
          p.x,
          p.y,
          p.w,
          p.h,
        )
      ) {
        damagePlayer(state, p, false, null);
        hitPlayer = true;
        break;
      }
    }
    if (!hitPlayer) active.push(pr);
  }
  state.projectiles = active;
}

function checkStageCompletion(state: WorldState) {
  if (state.phase !== 'playing') return;

  if (state.mode === 'coop') {
    // Stage 1 & 2 clear when all active players reach the Goal Warp Star (or at least 1 finished & timer expires)
    if (!state.boss) {
      const activePlayers = state.players.filter((p) => !p.inBubble);
      const finishedCount = state.players.filter((p) => p.stageFinished).length;
      if (
        (activePlayers.length > 0 && activePlayers.every((p) => p.stageFinished)) ||
        (finishedCount > 0 && state.timeRemaining <= 0)
      ) {
        state.phase = 'stage_clear';
        state.stageClearTimer = 2.4;
      } else if (state.timeRemaining <= 0) {
        // Time ran out — advance to keep party match brisk!
        state.phase = 'stage_clear';
        state.stageClearTimer = 2.0;
      }
    }
  } else {
    // Bomb Battle: round finishes when timer reaches 0 (or Boss is defeated in Round 3!)
    if (state.timeRemaining <= 0 || (state.boss && state.boss.action === 'defeated' && state.boss.actionTimer <= 0.5)) {
      state.phase = 'stage_clear';
      state.stageClearTimer = 2.4;
    }
  }
}

function findNearestPlayer(state: WorldState, x: number, y: number, maxRange: number): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDist = maxRange;
  for (const p of state.players) {
    if (p.inBubble || p.stageFinished) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function emit(state: WorldState, ev: GameEvent) {
  state.events.push(ev);
}
