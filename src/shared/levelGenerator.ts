import type {
  BossEntity,
  EnemyEntity,
  GameMode,
  ItemEntity,
  PowerUpType,
  StageTheme,
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
} from './types.ts';

export interface GeneratedStage {
  stageName: string;
  theme: StageTheme;
  width: number;
  height: number;
  tiles: number[];
  spawnPoints: Array<{x: number; y: number}>;
  items: ItemEntity[];
  enemies: EnemyEntity[];
  boss: BossEntity | null;
  timeLimit: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setTile(tiles: number[], w: number, h: number, tx: number, ty: number, tile: number) {
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return;
  tiles[ty * w + tx] = tile;
}

function getTile(tiles: number[], w: number, h: number, tx: number, ty: number): number {
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return TILE_GROUND;
  return tiles[ty * w + tx];
}

function fillRect(
  tiles: number[],
  w: number,
  h: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  tile: number,
) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      setTile(tiles, w, h, x, y, tile);
    }
  }
}

export function generateStage(mode: GameMode, stageIndex: number, seed: number): GeneratedStage {
  const rng = mulberry32(seed + stageIndex * 7919 + (mode === 'battle' ? 1337 : 17));
  if (mode === 'battle') {
    return generateBattleArena(stageIndex, rng);
  }
  if (stageIndex >= 2) {
    return generateBossArena(rng);
  }
  return generateAdventureStage(stageIndex, rng);
}

function generateAdventureStage(stageIndex: number, rng: () => number): GeneratedStage {
  const isRuins = stageIndex === 1;
  const theme: StageTheme = isRuins ? 'ruins' : 'meadow';
  const stageName = isRuins ? 'World 2 · Crystal Sky Ruins' : 'World 1 · Clover Meadow';
  // Expanded large procedural maps with upper & lower branching sky routes!
  const width = isRuins ? 164 : 148;
  const height = isRuins ? 22 : 20;
  const tiles = new Array<number>(width * height).fill(TILE_EMPTY);
  const items: ItemEntity[] = [];
  const enemies: EnemyEntity[] = [];
  let entityCounter = 1;

  const nextId = (prefix: string) => `${prefix}_${stageIndex}_${entityCounter++}`;

  // Outer boundary walls (left/right)
  fillRect(tiles, width, height, 0, 0, 1, height, TILE_GROUND);
  fillRect(tiles, width, height, width - 1, 0, 1, height, TILE_GROUND);

  // Starting safe meadow / ruin terrace (x: 1..12)
  const baseFloorY = height - 4;
  fillRect(tiles, width, height, 1, baseFloorY, 12, height - baseFloorY, TILE_GROUND);

  // Starter ? block, throwable crate & starter bomb dispenser
  setTile(tiles, width, height, 6, baseFloorY - 4, TILE_QUESTION);
  setTile(tiles, width, height, 10, baseFloorY - 1, TILE_BOMB_SPAWNER);
  items.push(makeCrate(nextId('crate'), 8 * TILE_SIZE, (baseFloorY - 1) * TILE_SIZE));

  // Welcome coin trail
  for (let i = 0; i < 4; i++) {
    items.push(makeCoin(nextId('coin'), (4 + i) * TILE_SIZE + 8, (baseFloorY - 2) * TILE_SIZE));
  }

  let cursorX = 13;
  let floorY = baseFloorY;
  let puzzlePlaced = 0;

  while (cursorX < width - 16) {
    const roll = rng();

    // Place 4+ Environmental Cracked-Wall Bomb Puzzles across each large world!
    if (
      (puzzlePlaced < 4 && cursorX > 20 + puzzlePlaced * 26 && roll < 0.38) ||
      (puzzlePlaced < 2 && cursorX > 50 + puzzlePlaced * 30)
    ) {
      puzzlePlaced++;
      const segW = 16;
      fillRect(tiles, width, height, cursorX, floorY, segW, height - floorY, TILE_GROUND);

      // Bomb dispenser right outside the stone vault
      setTile(tiles, width, height, cursorX + 2, floorY - 1, TILE_BOMB_SPAWNER);

      // Multi-layer Cracked Stone Star Vault + Upper Sky Bypass
      const wallX = cursorX + 6;
      fillRect(tiles, width, height, wallX, floorY - 4, 2, 4, TILE_CRACKED);
      fillRect(tiles, width, height, wallX, floorY - 5, 7, 1, TILE_BRICK);
      fillRect(tiles, width, height, wallX + 6, floorY - 4, 1, 4, TILE_CRACKED);

      // Vault treasure: Double Stars + Coin stash
      items.push(makeStar(nextId('star'), (wallX + 3) * TILE_SIZE, (floorY - 2) * TILE_SIZE));
      items.push(makeStar(nextId('star'), (wallX + 4.5) * TILE_SIZE, (floorY - 2) * TILE_SIZE));
      for (let c = 0; c < 3; c++) {
        items.push(
          makeCoin(nextId('coin'), (wallX + 2 + c) * TILE_SIZE + 6, (floorY - 1) * TILE_SIZE),
        );
      }

      // Upper sky route over the vault with power-up ? block & elevated coins
      fillRect(tiles, width, height, cursorX + 1, floorY - 4, 3, 1, TILE_PLATFORM);
      fillRect(tiles, width, height, wallX + 1, floorY - 8, 5, 1, TILE_PLATFORM);
      setTile(tiles, width, height, wallX + 3, floorY - 11, TILE_QUESTION);
      items.push(makeCoin(nextId('coin'), (wallX + 1) * TILE_SIZE + 6, (floorY - 9) * TILE_SIZE));
      items.push(makeCoin(nextId('coin'), (wallX + 4) * TILE_SIZE + 6, (floorY - 9) * TILE_SIZE));

      enemies.push(
        makeEnemy(
          nextId('en'),
          isRuins ? 'shellback' : 'hopper',
          (wallX + 2) * TILE_SIZE,
          (floorY - 6) * TILE_SIZE,
        ),
      );
      if (isRuins) {
        enemies.push(
          makeEnemy(nextId('en'), 'swooper', (wallX + 5) * TILE_SIZE, (floorY - 10) * TILE_SIZE),
        );
      }

      cursorX += segW;
      continue;
    }

    if (roll < 0.28) {
      // Wide Sky Canyon with multi-tier cloud stepping stones (high risk / high reward!)
      const gapW = 4 + Math.floor(rng() * 3); // 4..6 tiles with stepping platforms
      const landW = 9 + Math.floor(rng() * 4);
      const minY = 9;
      const maxY = height - 3;
      const nextFloorY = Math.max(minY, Math.min(maxY, floorY + (rng() < 0.5 ? -2 : 1)));

      // Guaranteed reachable cloud bridge across gap
      const midY = Math.min(floorY, nextFloorY) - 1;
      fillRect(tiles, width, height, cursorX + 1, midY, Math.max(2, gapW - 2), 1, TILE_PLATFORM);
      // High bonus cloud shelf above the gap!
      fillRect(tiles, width, height, cursorX + 1, Math.max(4, midY - 4), 3, 1, TILE_PLATFORM);
      items.push(makeStar(nextId('star'), (cursorX + 2) * TILE_SIZE, Math.max(3, midY - 5) * TILE_SIZE));

      for (let g = 0; g < gapW; g++) {
        items.push(
          makeCoin(nextId('coin'), (cursorX + g) * TILE_SIZE + 8, (midY - 2) * TILE_SIZE),
        );
      }

      enemies.push(
        makeEnemy(
          nextId('en'),
          'swooper',
          (cursorX + Math.floor(gapW / 2)) * TILE_SIZE,
          Math.max(4, midY - 4) * TILE_SIZE,
        ),
      );

      cursorX += gapW;
      floorY = nextFloorY;
      fillRect(tiles, width, height, cursorX, floorY, landW, height - floorY, TILE_GROUND);

      enemies.push(
        makeEnemy(
          nextId('en'),
          rng() < 0.45 ? 'shellback' : 'hopper',
          (cursorX + Math.floor(landW / 2)) * TILE_SIZE,
          (floorY - 1) * TILE_SIZE,
        ),
      );
      if (rng() < 0.55) {
        items.push(makeCrate(nextId('crate'), (cursorX + 1) * TILE_SIZE, (floorY - 1) * TILE_SIZE));
      }
      if (rng() < 0.55) {
        setTile(tiles, width, height, cursorX + Math.floor(landW / 2), floorY - 4, TILE_QUESTION);
      }

      cursorX += landW;
    } else if (roll < 0.62) {
      // Multi-Story Platforming Tower / Garden with Turret, Spikes & Sky Route!
      const segW = 14 + Math.floor(rng() * 4);
      fillRect(tiles, width, height, cursorX, floorY, segW, height - floorY, TILE_GROUND);

      // Spike / lava trap on lower floor
      const hazX = cursorX + 5;
      setTile(tiles, width, height, hazX, floorY - 1, TILE_HAZARD);
      setTile(tiles, width, height, hazX + 1, floorY - 1, TILE_HAZARD);
      setTile(tiles, width, height, hazX + 2, floorY - 1, TILE_HAZARD);

      // 3-tier vertical cloud platforms
      fillRect(tiles, width, height, cursorX + 2, floorY - 3, 5, 1, TILE_PLATFORM);
      fillRect(tiles, width, height, cursorX + 7, floorY - 6, 5, 1, TILE_PLATFORM);
      fillRect(tiles, width, height, cursorX + 3, Math.max(4, floorY - 9), 5, 1, TILE_PLATFORM);

      setTile(tiles, width, height, cursorX + 1, floorY - 1, TILE_BOMB_SPAWNER);
      setTile(tiles, width, height, cursorX + 5, Math.max(2, floorY - 12), TILE_QUESTION);
      items.push(
        makeStar(nextId('star'), (cursorX + 5) * TILE_SIZE, Math.max(3, floorY - 10) * TILE_SIZE),
      );

      enemies.push(
        makeEnemy(
          nextId('en'),
          rng() < 0.65 ? 'turret' : 'shellback',
          (cursorX + segW - 3) * TILE_SIZE,
          (floorY - 1) * TILE_SIZE,
        ),
      );
      enemies.push(
        makeEnemy(nextId('en'), 'hopper', (cursorX + 8) * TILE_SIZE, (floorY - 7) * TILE_SIZE),
      );

      for (let c = 0; c < 5; c++) {
        items.push(makeCoin(nextId('coin'), (cursorX + 2 + c) * TILE_SIZE + 8, (floorY - 4) * TILE_SIZE));
      }

      cursorX += segW;
    } else {
      // Fortress Battlements with Destructible Shortcut, Crates & Patrol Squad
      const segW = 13;
      fillRect(tiles, width, height, cursorX, floorY, segW, height - floorY, TILE_GROUND);
      fillRect(tiles, width, height, cursorX + 3, floorY - 3, 6, 3, TILE_BRICK);
      // Cracked tunnel through the middle of the battlement!
      fillRect(tiles, width, height, cursorX + 3, floorY - 2, 6, 2, TILE_CRACKED);
      setTile(tiles, width, height, cursorX + 1, floorY - 1, TILE_BOMB_SPAWNER);
      setTile(tiles, width, height, cursorX + 5, floorY - 6, TILE_QUESTION);
      setTile(tiles, width, height, cursorX + 6, floorY - 6, TILE_BRICK);

      items.push(makeCrate(nextId('crate'), (cursorX + 2) * TILE_SIZE, (floorY - 1) * TILE_SIZE));
      items.push(makeCoin(nextId('coin'), (cursorX + 4) * TILE_SIZE + 8, (floorY - 4) * TILE_SIZE));
      items.push(makeCoin(nextId('coin'), (cursorX + 6) * TILE_SIZE + 8, (floorY - 4) * TILE_SIZE));
      items.push(makeCoin(nextId('coin'), (cursorX + 7) * TILE_SIZE + 8, (floorY - 4) * TILE_SIZE));

      enemies.push(makeEnemy(nextId('en'), 'hopper', (cursorX + 5) * TILE_SIZE, (floorY - 4) * TILE_SIZE));
      enemies.push(
        makeEnemy(
          nextId('en'),
          isRuins ? 'swooper' : 'shellback',
          (cursorX + 10) * TILE_SIZE,
          (isRuins ? floorY - 6 : floorY - 1) * TILE_SIZE,
        ),
      );

      cursorX += segW;
    }
  }

  // Final Goal Sanctuary
  const goalStart = cursorX;
  const goalFloorY = height - 4;
  fillRect(tiles, width, height, goalStart, goalFloorY, width - goalStart - 1, height - goalFloorY, TILE_GROUND);

  const goalX = width - 6;
  fillRect(tiles, width, height, goalX - 3, goalFloorY - 1, 7, 1, TILE_BRICK);
  fillRect(tiles, width, height, goalX - 2, goalFloorY - 2, 5, 1, TILE_BRICK);
  setTile(tiles, width, height, goalX, goalFloorY - 3, TILE_GOAL);
  setTile(tiles, width, height, goalX, goalFloorY - 4, TILE_GOAL);

  items.push(makeStar(nextId('star'), (goalX - 5) * TILE_SIZE, (goalFloorY - 4) * TILE_SIZE));

  const spawnPoints = [
    {x: 2 * TILE_SIZE, y: (baseFloorY - 2) * TILE_SIZE},
    {x: 3.5 * TILE_SIZE, y: (baseFloorY - 2) * TILE_SIZE},
    {x: 5 * TILE_SIZE, y: (baseFloorY - 2) * TILE_SIZE},
    {x: 6.5 * TILE_SIZE, y: (baseFloorY - 2) * TILE_SIZE},
  ];

  for (const sp of spawnPoints) {
    const tx = Math.floor(sp.x / TILE_SIZE);
    const ty = Math.floor(sp.y / TILE_SIZE);
    if (getTile(tiles, width, height, tx, ty) !== TILE_EMPTY) {
      setTile(tiles, width, height, tx, ty, TILE_EMPTY);
    }
  }

  return {
    stageName,
    theme,
    width,
    height,
    tiles,
    spawnPoints,
    items,
    enemies,
    boss: null,
    timeLimit: isRuins ? 180 : 165,
  };
}

function generateBossArena(rng: () => number): GeneratedStage {
  // Grand multi-tier Citadel Boss Arena (52x20)
  const width = 52;
  const height = 20;
  const tiles = new Array<number>(width * height).fill(TILE_EMPTY);
  const items: ItemEntity[] = [];
  const enemies: EnemyEntity[] = [];

  fillRect(tiles, width, height, 0, 0, 1, height, TILE_GROUND);
  fillRect(tiles, width, height, width - 1, 0, 1, height, TILE_GROUND);
  fillRect(tiles, width, height, 1, height - 3, width - 2, 3, TILE_GROUND);

  // Two magma channels with flanking bridges
  setTile(tiles, width, height, 14, height - 3, TILE_HAZARD);
  setTile(tiles, width, height, 15, height - 3, TILE_HAZARD);
  setTile(tiles, width, height, width - 16, height - 3, TILE_HAZARD);
  setTile(tiles, width, height, width - 15, height - 3, TILE_HAZARD);

  // Multi-level tactical cloud/grate catwalks
  fillRect(tiles, width, height, 4, 13, 8, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, width - 12, 13, 8, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, 19, 10, 14, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, 8, 7, 7, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, width - 15, 7, 7, 1, TILE_PLATFORM);

  // 4 Bomb dispensers around the arena!
  setTile(tiles, width, height, 3, height - 4, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, width - 4, height - 4, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, 25, 9, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, 11, 6, TILE_BOMB_SPAWNER);

  // Power-up ? blocks on high perches
  setTile(tiles, width, height, 6, 9, TILE_QUESTION);
  setTile(tiles, width, height, width - 7, 9, TILE_QUESTION);
  setTile(tiles, width, height, 26, 5, TILE_QUESTION);

  // Destructible cover pillars
  const pillarOffset = rng() < 0.5 ? 0 : 1;
  fillRect(tiles, width, height, 11 + pillarOffset, height - 6, 1, 3, TILE_CRACKED);
  fillRect(tiles, width, height, width - 12 - pillarOffset, height - 6, 1, 3, TILE_CRACKED);

  items.push(makeCrate('boss_crate_1', 7 * TILE_SIZE, (height - 4) * TILE_SIZE));
  items.push(makeCrate('boss_crate_2', (width - 8) * TILE_SIZE, (height - 4) * TILE_SIZE));
  items.push(makeStar('boss_star_top', 26 * TILE_SIZE, 8 * TILE_SIZE));

  const boss: BossEntity = {
    name: 'Baron Cinder-Crown',
    x: (width - 14) * TILE_SIZE,
    y: 12 * TILE_SIZE,
    vx: 0,
    vy: 0,
    w: 78,
    h: 78,
    facing: -1,
    hp: 120,
    maxHp: 120,
    phase: 1,
    action: 'intro',
    actionTimer: 1.5,
    hitFlash: 0,
    grounded: false,
  };

  return {
    stageName: 'World 3 · Baron Cinder-Crown',
    theme: 'citadel',
    width,
    height,
    tiles,
    spawnPoints: [
      {x: 4 * TILE_SIZE, y: 14 * TILE_SIZE},
      {x: 6 * TILE_SIZE, y: 14 * TILE_SIZE},
      {x: 8 * TILE_SIZE, y: 11 * TILE_SIZE},
      {x: 10 * TILE_SIZE, y: 14 * TILE_SIZE},
    ],
    items,
    enemies,
    boss,
    timeLimit: 180,
  };
}

function generateBattleArena(stageIndex: number, rng: () => number): GeneratedStage {
  const themes: StageTheme[] = ['meadow', 'ruins', 'citadel'];
  const names = [
    'Round 1 · Clover Clash Arena',
    'Round 2 · Sky Vault Brawl',
    'Round 3 · Magma Finale Chaos',
  ];
  const theme = themes[stageIndex % 3];
  const stageName = names[stageIndex % 3];
  // Expanded multi-tiered party battleground (48x20)!
  const width = 48;
  const height = 20;
  const tiles = new Array<number>(width * height).fill(TILE_EMPTY);
  const items: ItemEntity[] = [];
  const enemies: EnemyEntity[] = [];
  let c = 1;
  const nextId = (p: string) => `${p}_b${stageIndex}_${c++}`;

  fillRect(tiles, width, height, 0, 0, 1, height, TILE_GROUND);
  fillRect(tiles, width, height, width - 1, 0, 1, height, TILE_GROUND);
  fillRect(tiles, width, height, 1, height - 3, width - 2, 3, TILE_GROUND);

  if (stageIndex >= 1) {
    // Center hazard chasm with destructible cracked bridge!
    fillRect(tiles, width, height, 20, height - 3, 8, 3, TILE_EMPTY);
    fillRect(tiles, width, height, 20, height - 1, 8, 1, TILE_HAZARD);
    fillRect(tiles, width, height, 20, height - 3, 8, 1, TILE_CRACKED);
  }

  // Spacious 3-level symmetrical arena with flank towers & central fortress
  const midY = rng() < 0.5 ? 13 : 14;
  fillRect(tiles, width, height, 3, midY, 10, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, width - 13, midY, 10, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, 17, 11, 14, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, 7, 8, 8, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, width - 15, 8, 8, 1, TILE_PLATFORM);
  fillRect(tiles, width, height, 20, 6, 8, 1, TILE_PLATFORM);

  // Destructible cracked cover bunkers hiding bonus stars
  fillRect(tiles, width, height, 14, height - 6, 1, 3, TILE_CRACKED);
  fillRect(tiles, width, height, width - 15, height - 6, 1, 3, TILE_CRACKED);
  fillRect(tiles, width, height, 23, 8, 2, 3, TILE_CRACKED);

  // 6 Bomb Dispensers so every lane has instant ammo!
  setTile(tiles, width, height, 5, midY - 1, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, width - 6, midY - 1, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, 19, 10, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, width - 20, 10, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, 10, 7, TILE_BOMB_SPAWNER);
  setTile(tiles, width, height, width - 11, 7, TILE_BOMB_SPAWNER);

  // Power-up ? blocks
  setTile(tiles, width, height, 10, 4, TILE_QUESTION);
  setTile(tiles, width, height, width - 11, 4, TILE_QUESTION);
  setTile(tiles, width, height, 23, 3, TILE_QUESTION);

  items.push(makeCrate(nextId('crate'), 8 * TILE_SIZE, (height - 4) * TILE_SIZE));
  items.push(makeCrate(nextId('crate'), (width - 9) * TILE_SIZE, (height - 4) * TILE_SIZE));
  items.push(makeStar(nextId('star'), 23.5 * TILE_SIZE, 5 * TILE_SIZE));
  for (let i = 0; i < 6; i++) {
    items.push(makeCoin(nextId('coin'), (18 + i * 2) * TILE_SIZE, 10 * TILE_SIZE));
  }

  enemies.push(makeEnemy(nextId('en'), 'hopper', 9 * TILE_SIZE, (midY - 1) * TILE_SIZE));
  enemies.push(makeEnemy(nextId('en'), 'hopper', (width - 10) * TILE_SIZE, (midY - 1) * TILE_SIZE));
  enemies.push(makeEnemy(nextId('en'), 'swooper', 24 * TILE_SIZE, 4 * TILE_SIZE));

  const boss: BossEntity | null =
    stageIndex === 2
      ? {
          name: 'Baron Cinder-Crown',
          x: 22 * TILE_SIZE,
          y: 6 * TILE_SIZE,
          vx: 0,
          vy: 0,
          w: 74,
          h: 74,
          facing: -1,
          hp: 90,
          maxHp: 90,
          phase: 1,
          action: 'intro',
          actionTimer: 1.4,
          hitFlash: 0,
          grounded: false,
        }
      : null;

  return {
    stageName,
    theme,
    width,
    height,
    tiles,
    spawnPoints: [
      {x: 4 * TILE_SIZE, y: (height - 5) * TILE_SIZE},
      {x: (width - 5) * TILE_SIZE, y: (height - 5) * TILE_SIZE},
      {x: 9 * TILE_SIZE, y: 6 * TILE_SIZE},
      {x: (width - 10) * TILE_SIZE, y: 6 * TILE_SIZE},
    ],
    items,
    enemies,
    boss,
    timeLimit: stageIndex === 2 ? 90 : 65,
  };
}

export function makeBomb(
  id: string,
  x: number,
  y: number,
  mega = false,
  ownerId: string | null = null,
): ItemEntity {
  return {
    id,
    kind: mega ? 'mega_bomb' : 'bomb',
    x,
    y,
    vx: 0,
    vy: 0,
    w: mega ? 28 : 22,
    h: mega ? 28 : 22,
    fuse: 2.6,
    maxFuse: 2.6,
    thrown: false,
    ownerId,
    carriedById: null,
    bobPhase: 0,
  };
}

export function makeCrate(id: string, x: number, y: number): ItemEntity {
  return {
    id,
    kind: 'crate',
    x,
    y,
    vx: 0,
    vy: 0,
    w: 26,
    h: 26,
    fuse: 0,
    maxFuse: 0,
    thrown: false,
    ownerId: null,
    carriedById: null,
    bobPhase: 0,
  };
}

export function makeCoin(id: string, x: number, y: number): ItemEntity {
  return {
    id,
    kind: 'coin',
    x,
    y,
    vx: 0,
    vy: 0,
    w: 18,
    h: 18,
    fuse: 0,
    maxFuse: 0,
    thrown: false,
    ownerId: null,
    carriedById: null,
    bobPhase: (x * 0.05) % (Math.PI * 2),
  };
}

export function makeStar(id: string, x: number, y: number): ItemEntity {
  return {
    id,
    kind: 'star',
    x,
    y,
    vx: 0,
    vy: 0,
    w: 26,
    h: 26,
    fuse: 0,
    maxFuse: 0,
    thrown: false,
    ownerId: null,
    carriedById: null,
    bobPhase: (x * 0.03) % (Math.PI * 2),
  };
}

export function makePowerUp(id: string, x: number, y: number, kind: PowerUpType): ItemEntity {
  return {
    id,
    kind: 'powerup',
    x,
    y,
    vx: 75,
    vy: -245,
    w: 24,
    h: 24,
    fuse: 0,
    maxFuse: 0,
    thrown: false,
    ownerId: null,
    carriedById: null,
    powerUpKind: kind,
    bobPhase: 0,
  };
}

export function makeEnemy(
  id: string,
  kind: EnemyEntity['kind'],
  x: number,
  y: number,
): EnemyEntity {
  return {
    id,
    kind,
    x,
    y,
    vx: kind === 'turret' ? 0 : -78,
    vy: 0,
    w: kind === 'shellback' ? 30 : 28,
    h: kind === 'turret' ? 30 : 26,
    facing: -1,
    hp: kind === 'shellback' ? 2 : 1,
    stunnedTimer: 0,
    carriedById: null,
    thrown: false,
    throwOwnerId: null,
    aiTimer: 1.2 + ((x * 0.01) % 1.4),
    baseY: y,
    hitFlash: 0,
  };
}
