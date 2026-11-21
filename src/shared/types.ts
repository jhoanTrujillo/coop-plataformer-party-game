export type GameMode = 'coop' | 'battle';
export type StageTheme = 'meadow' | 'ruins' | 'citadel';
export type CharacterColor = 'ruby' | 'sakura' | 'emerald' | 'gold' | 'cobalt' | 'plum';
export type PowerUpType = 'none' | 'mega_bomb' | 'wing_cap' | 'star_shield' | 'gold_magnet';

export interface CharacterPalette {
  id: CharacterColor;
  label: string;
  body: string;
  bodyLight: string;
  cap: string;
  trim: string;
  shoe: string;
  cheek: string;
}

export const CHARACTER_PALETTES: Record<CharacterColor, CharacterPalette> = {
  sakura: {
    id: 'sakura',
    label: 'Coral',
    body: '#fb7185',
    bodyLight: '#fda4af',
    cap: '#e11d48',
    trim: '#fef08a',
    shoe: '#be123c',
    cheek: '#e11d48',
  },
  ruby: {
    id: 'ruby',
    label: 'Crimson',
    body: '#ef4444',
    bodyLight: '#fca5a5',
    cap: '#b91c1c',
    trim: '#fef08a',
    shoe: '#991b1b',
    cheek: '#b91c1c',
  },
  emerald: {
    id: 'emerald',
    label: 'Mint',
    body: '#34d399',
    bodyLight: '#86efac',
    cap: '#059669',
    trim: '#fde047',
    shoe: '#047857',
    cheek: '#047857',
  },
  gold: {
    id: 'gold',
    label: 'Sunbeam',
    body: '#fbbf24',
    bodyLight: '#fde68a',
    cap: '#d97706',
    trim: '#fffbeb',
    shoe: '#b45309',
    cheek: '#d97706',
  },
  cobalt: {
    id: 'cobalt',
    label: 'Sky',
    body: '#38bdf8',
    bodyLight: '#bae6fd',
    cap: '#0284c7',
    trim: '#fef08a',
    shoe: '#0369a1',
    cheek: '#0284c7',
  },
  plum: {
    id: 'plum',
    label: 'Violet',
    body: '#c084fc',
    bodyLight: '#e9d5ff',
    cap: '#7e22ce',
    trim: '#facc15',
    shoe: '#6b21a8',
    cheek: '#9333ea',
  },
};

export const COLOR_ORDER: CharacterColor[] = [
  'sakura',
  'ruby',
  'emerald',
  'gold',
  'cobalt',
  'plum',
];

export const TILE_SIZE = 32;

// Tile numeric constants (no TS enums for Node native strip-types compatibility)
export const TILE_EMPTY = 0;
export const TILE_GROUND = 1;
export const TILE_BRICK = 2;
export const TILE_PLATFORM = 3;
export const TILE_CRACKED = 4;
export const TILE_QUESTION = 5;
export const TILE_USED = 6;
export const TILE_BOMB_SPAWNER = 7;
export const TILE_HAZARD = 8;
export const TILE_GOAL = 9;

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  jump: boolean;
  jumpPressed: boolean;
  grabPressed: boolean;
}

export const EMPTY_INPUT: PlayerInput = {
  left: false,
  right: false,
  up: false,
  jump: false,
  jumpPressed: false,
  grabPressed: false,
};

export type PlayerAnim =
  | 'idle'
  | 'run'
  | 'jump'
  | 'puff'
  | 'fall'
  | 'hurt'
  | 'bubble'
  | 'victory';

export interface PlayerState {
  id: string;
  name: string;
  color: CharacterColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  grounded: boolean;
  doubleJumpUsed: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  lives: number;
  maxLives: number;
  invulnTimer: number;
  inBubble: boolean;
  stageFinished: boolean;
  heldItemId: string | null;
  heldByPlayerId: string | null;
  powerUp: PowerUpType;
  powerUpTimer: number;
  anim: PlayerAnim;
  animTime: number;
  score: number;
  coins: number;
  kos: number;
  bossDamage: number;
  bombHits: number;
  deaths: number;
  isHost?: boolean;
  ready?: boolean;
}

export type ItemKind = 'bomb' | 'mega_bomb' | 'crate' | 'coin' | 'star' | 'powerup';

export interface ItemEntity {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  fuse: number; // >0 for live bombs
  maxFuse: number;
  thrown: boolean;
  ownerId: string | null;
  carriedById: string | null;
  powerUpKind?: PowerUpType;
  bobPhase: number;
}

export type EnemyKind = 'hopper' | 'shellback' | 'swooper' | 'turret';

export interface EnemyEntity {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  hp: number;
  stunnedTimer: number;
  carriedById: string | null;
  thrown: boolean;
  throwOwnerId: string | null;
  aiTimer: number;
  baseY: number;
  hitFlash: number;
}

export interface ProjectileEntity {
  id: string;
  kind: 'fireball' | 'shockwave' | 'ember';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  fromBoss?: boolean;
}

export type BossAction =
  | 'intro'
  | 'patrol'
  | 'telegraph_slam'
  | 'slam'
  | 'fire_barrage'
  | 'summon'
  | 'charge'
  | 'dizzy'
  | 'defeated';

export interface BossEntity {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  phase: 1 | 2;
  action: BossAction;
  actionTimer: number;
  hitFlash: number;
  grounded: boolean;
}

export type GameEventType =
  | 'jump'
  | 'double_jump'
  | 'grab'
  | 'throw'
  | 'explode'
  | 'mega_explode'
  | 'coin'
  | 'star'
  | 'powerup'
  | 'stomp'
  | 'hurt'
  | 'revive'
  | 'brick_break'
  | 'boss_hit'
  | 'boss_slam'
  | 'boss_defeat'
  | 'stage_clear';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  playerId?: string;
  value?: number;
  label?: string;
}

export interface TileChange {
  tx: number;
  ty: number;
  tile: number;
}

export interface BonusAward {
  title: string;
  description: string;
  playerId: string;
  playerName: string;
  color: CharacterColor;
  bonus: number;
}

export interface RankedPlayer {
  rank: number;
  id: string;
  name: string;
  color: CharacterColor;
  score: number;
  coins: number;
  kos: number;
  bossDamage: number;
  bombHits: number;
  deaths: number;
  bonusPoints: number;
}

export interface MatchSummary {
  mode: GameMode;
  seed: number;
  rankings: RankedPlayer[];
  awards: BonusAward[];
  stagesCleared: number;
}

export type MatchPhase = 'lobby' | 'playing' | 'stage_clear' | 'podium';

export interface WorldState {
  roomCode: string;
  mode: GameMode;
  phase: MatchPhase;
  stageIndex: number; // 0, 1, 2
  totalStages: number;
  stageName: string;
  theme: StageTheme;
  seed: number;
  width: number; // tiles
  height: number; // tiles
  tiles: number[]; // flattened width * height
  spawnerCooldowns: Record<string, number>;
  players: PlayerState[];
  items: ItemEntity[];
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  boss: BossEntity | null;
  timeRemaining: number;
  stageClearTimer: number;
  tick: number;
  intensity: number; // 0..1 for dynamic music
  events: GameEvent[];
  summary: MatchSummary | null;
}

export interface CompactWorldSnapshot {
  roomCode: string;
  mode: GameMode;
  phase: MatchPhase;
  stageIndex: number;
  totalStages: number;
  stageName: string;
  theme: StageTheme;
  seed: number;
  width: number;
  height: number;
  tiles?: number[]; // sent only on initial sync or stage change
  tileChanges?: TileChange[];
  players: PlayerState[];
  items: ItemEntity[];
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  boss: BossEntity | null;
  timeRemaining: number;
  stageClearTimer: number;
  tick: number;
  intensity: number;
  events: GameEvent[];
  summary: MatchSummary | null;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  color: CharacterColor;
  isHost: boolean;
  ready: boolean;
}

export interface LobbySnapshot {
  roomCode: string;
  mode: GameMode;
  hostId: string;
  status: MatchPhase;
  players: LobbyPlayer[];
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  color: CharacterColor;
  mode: GameMode;
  score: number;
  coins: number;
  kos: number;
  stagesCleared: number;
  createdAt: string;
}
