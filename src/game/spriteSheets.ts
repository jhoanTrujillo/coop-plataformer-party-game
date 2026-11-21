import {CHARACTER_PALETTES, CharacterColor, EnemyKind} from '../shared/types';

export const PLAYER_FRAME_SIZE = 96;
export const PLAYER_FRAME_COUNT = 8;

export const ENEMY_FRAME_SIZE = 96;
export const ENEMY_FRAME_COUNT = 4;

export const BOSS_FRAME_SIZE = 192;
export const BOSS_FRAME_COUNT = 4;

// Frame indices in each horizontal sprite sheet
export const PLAYER_FRAMES = {
  IDLE_0: 0,
  IDLE_1: 1,
  RUN_0: 2,
  RUN_1: 3,
  RUN_2: 4,
  JUMP: 5,
  DOUBLE_JUMP: 6,
  CARRY: 7,
} as const;

export const ENEMY_FRAMES = {
  WALK_0: 0,
  WALK_1: 1,
  ACTION: 2,
  STUNNED: 3,
} as const;

export const BOSS_FRAMES = {
  PATROL: 0,
  TELEGRAPH: 1,
  ATTACK: 2,
  DIZZY: 3,
} as const;

export interface SpriteSheetAtlas {
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

const playerSheetCache = new Map<CharacterColor, SpriteSheetAtlas>();
const enemySheetCache = new Map<EnemyKind, SpriteSheetAtlas>();
const bossSheetCache = new Map<1 | 2, SpriteSheetAtlas>();

function createOffscreenSheet(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawCapsule(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
  fill: string,
  outlineWidth: number,
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Bold dark outline pass
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = radius * 2 + outlineWidth * 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Solid single-color skin fill pass
  ctx.strokeStyle = fill;
  ctx.lineWidth = radius * 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/**
 * Generates and caches an 8-frame horizontal sprite sheet (768x96) for a
 * PEAK-inspired single-color simple-shape humanoid character.
 */
export function getPlayerSpriteSheet(color: CharacterColor): SpriteSheetAtlas {
  const cached = playerSheetCache.get(color);
  if (cached) return cached;

  const pal = CHARACTER_PALETTES[color] ?? CHARACTER_PALETTES.sakura;
  const canvas = createOffscreenSheet(PLAYER_FRAME_SIZE * PLAYER_FRAME_COUNT, PLAYER_FRAME_SIZE);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let f = 0; f < PLAYER_FRAME_COUNT; f++) {
      ctx.save();
      ctx.translate(f * PLAYER_FRAME_SIZE + PLAYER_FRAME_SIZE / 2, PLAYER_FRAME_SIZE / 2 + 4);
      drawPeakHumanoidFrame(ctx, pal.body, pal.bodyLight, pal.shoe, f);
      ctx.restore();
    }
  }

  const atlas: SpriteSheetAtlas = {
    canvas,
    frameWidth: PLAYER_FRAME_SIZE,
    frameHeight: PLAYER_FRAME_SIZE,
    frameCount: PLAYER_FRAME_COUNT,
  };
  playerSheetCache.set(color, atlas);
  return atlas;
}

function drawPeakHumanoidFrame(
  ctx: CanvasRenderingContext2D,
  skin: string,
  skinHighlight: string,
  packShade: string,
  frame: number,
) {
  const outline = 4.2;

  // Pose parameters per sprite-sheet frame (facing RIGHT by default)
  let bodyBobY = 0;
  let torsoTilt = 0;
  let leftLegEndX = -7;
  let leftLegEndY = 33;
  let rightLegEndX = 7;
  let rightLegEndY = 33;
  let backArmEndX = -15;
  let backArmEndY = 14;
  let frontArmEndX = 15;
  let frontArmEndY = 14;
  let blink = false;
  let mouthStyle: 'smile' | 'open' | 'effort' = 'smile';
  let showBoostArcs = false;

  switch (frame) {
    case PLAYER_FRAMES.IDLE_0:
      bodyBobY = 0;
      break;
    case PLAYER_FRAMES.IDLE_1:
      bodyBobY = 1.8;
      blink = true;
      backArmEndY = 15.5;
      frontArmEndY = 15.5;
      break;
    case PLAYER_FRAMES.RUN_0:
      bodyBobY = -1.5;
      torsoTilt = 0.1;
      leftLegEndX = -15;
      leftLegEndY = 31;
      rightLegEndX = 16;
      rightLegEndY = 28;
      backArmEndX = 14;
      backArmEndY = 11;
      frontArmEndX = -15;
      frontArmEndY = 13;
      break;
    case PLAYER_FRAMES.RUN_1:
      bodyBobY = 2;
      torsoTilt = 0.08;
      leftLegEndX = -4;
      leftLegEndY = 33;
      rightLegEndX = 4;
      rightLegEndY = 31;
      backArmEndX = -9;
      backArmEndY = 15;
      frontArmEndX = 10;
      frontArmEndY = 15;
      break;
    case PLAYER_FRAMES.RUN_2:
      bodyBobY = -1.5;
      torsoTilt = 0.12;
      leftLegEndX = 15;
      leftLegEndY = 29;
      rightLegEndX = -16;
      rightLegEndY = 31;
      backArmEndX = -15;
      backArmEndY = 12;
      frontArmEndX = 16;
      frontArmEndY = 10;
      break;
    case PLAYER_FRAMES.JUMP:
      bodyBobY = -3;
      torsoTilt = 0.06;
      leftLegEndX = -11;
      leftLegEndY = 27;
      rightLegEndX = 12;
      rightLegEndY = 24;
      backArmEndX = -16;
      backArmEndY = -4;
      frontArmEndX = 18;
      frontArmEndY = -8;
      mouthStyle = 'open';
      break;
    case PLAYER_FRAMES.DOUBLE_JUMP:
      bodyBobY = -4;
      torsoTilt = 0.15;
      leftLegEndX = -13;
      leftLegEndY = 23;
      rightLegEndX = 10;
      rightLegEndY = 21;
      backArmEndX = -19;
      backArmEndY = 4;
      frontArmEndX = 19;
      frontArmEndY = -2;
      mouthStyle = 'open';
      showBoostArcs = true;
      break;
    case PLAYER_FRAMES.CARRY:
      bodyBobY = 1;
      torsoTilt = 0.03;
      leftLegEndX = -9;
      leftLegEndY = 33;
      rightLegEndX = 9;
      rightLegEndY = 33;
      backArmEndX = -10;
      backArmEndY = -22;
      frontArmEndX = 10;
      frontArmEndY = -22;
      mouthStyle = 'effort';
      break;
  }

  ctx.save();
  ctx.translate(0, bodyBobY);
  ctx.rotate(torsoTilt);

  // Subtle air-hop swirl arcs on double-jump frame
  if (showBoostArcs) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 29, 17, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.restore();
  }

  // 1. Back Arm (single solid skin color)
  drawCapsule(ctx, -6, 2, backArmEndX, backArmEndY, 5.2, skin, outline);

  // 2. Compact matching-hue explorer pack on back (PEAK climber silhouette)
  ctx.save();
  drawRoundedRectPath(ctx, -20, -4, 13, 21, 5.5);
  ctx.fillStyle = packShade;
  ctx.fill();
  ctx.lineWidth = outline;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();
  // Pack top flap highlight
  drawRoundedRectPath(ctx, -18, -2, 9, 6, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();

  // 3. Back Leg (single solid skin color)
  drawCapsule(ctx, -5, 16, leftLegEndX, leftLegEndY, 5.8, skin, outline);

  // 4. Front Leg (single solid skin color)
  drawCapsule(ctx, 5, 16, rightLegEndX, rightLegEndY, 5.8, skin, outline);

  // 5. Simple Rounded Pill Torso (single solid skin color)
  ctx.save();
  drawRoundedRectPath(ctx, -13.5, -5, 27, 27, 12.5);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.lineWidth = outline;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();
  // Subtle curved highlight along chest
  ctx.fillStyle = skinHighlight;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(-4, 5, 5.5, 9, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Simple Smooth Round Head (exact same single solid skin color!)
  ctx.save();
  ctx.fillStyle = skin;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = outline;
  ctx.beginPath();
  ctx.arc(0, -18, 16.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Soft matte highlight on crown
  ctx.fillStyle = skinHighlight;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(-5.5, -24.5, 6.5, 4.2, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 7. Expressive PEAK-style Big Cartoon Eyes (shifted slightly toward facing direction)
  if (blink) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.5, -18);
    ctx.lineTo(3.5, -18);
    ctx.moveTo(8, -18);
    ctx.lineTo(13.5, -18);
    ctx.stroke();
  } else {
    // Left eye
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0.5, -18.5, 4.6, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(10.5, -18.5, 4.3, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupils looking forward
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(2.1, -18.5, 2.3, 0, Math.PI * 2);
    ctx.arc(11.9, -18.5, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Crisp catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(1.2, -20.2, 1.0, 0, Math.PI * 2);
    ctx.arc(11.0, -20.2, 1.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Minimal Expressive Mouth
  ctx.strokeStyle = '#0f172a';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  if (mouthStyle === 'open') {
    ctx.beginPath();
    ctx.ellipse(6.5, -10.5, 3.0, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mouthStyle === 'effort') {
    ctx.beginPath();
    ctx.moveTo(3.5, -11);
    ctx.lineTo(9.5, -11);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(6.0, -12.5, 3.5, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }

  // 9. Front Arm (drawn on top of torso for clean depth)
  drawCapsule(ctx, 6, 2, frontArmEndX, frontArmEndY, 5.2, skin, outline);

  ctx.restore();
}

/**
 * Generates and caches a 4-frame revamped enemy sprite sheet (384x96).
 */
export function getEnemySpriteSheet(kind: EnemyKind): SpriteSheetAtlas {
  const cached = enemySheetCache.get(kind);
  if (cached) return cached;

  const canvas = createOffscreenSheet(ENEMY_FRAME_SIZE * ENEMY_FRAME_COUNT, ENEMY_FRAME_SIZE);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let f = 0; f < ENEMY_FRAME_COUNT; f++) {
      ctx.save();
      ctx.translate(f * ENEMY_FRAME_SIZE + ENEMY_FRAME_SIZE / 2, ENEMY_FRAME_SIZE / 2 + 4);
      if (kind === 'hopper') drawMossGremlinFrame(ctx, f);
      else if (kind === 'shellback') drawIronBeetleFrame(ctx, f);
      else if (kind === 'swooper') drawNightwingFrame(ctx, f);
      else drawEmberTurretFrame(ctx, f);
      ctx.restore();
    }
  }

  const atlas: SpriteSheetAtlas = {
    canvas,
    frameWidth: ENEMY_FRAME_SIZE,
    frameHeight: ENEMY_FRAME_SIZE,
    frameCount: ENEMY_FRAME_COUNT,
  };
  enemySheetCache.set(kind, atlas);
  return atlas;
}

function drawMossGremlinFrame(ctx: CanvasRenderingContext2D, frame: number) {
  const stunned = frame === ENEMY_FRAMES.STUNNED;
  const hop = frame === ENEMY_FRAMES.ACTION;
  const stride = frame === ENEMY_FRAMES.WALK_0 ? -5 : frame === ENEMY_FRAMES.WALK_1 ? 5 : 0;

  ctx.save();
  if (stunned) {
    ctx.translate(0, 8);
    ctx.scale(1, -1);
  } else if (hop) {
    ctx.translate(0, -6);
    ctx.scale(0.92, 1.12);
  }

  // Feet
  drawCapsule(ctx, -10, 14, -12 + stride, 26, 5.5, '#15803d', 3.8);
  drawCapsule(ctx, 10, 14, 12 - stride, 26, 5.5, '#15803d', 3.8);

  // Stocky horned forest-gremlin body
  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.2;
  drawRoundedRectPath(ctx, -22, -16, 44, 34, 16);
  ctx.fill();
  ctx.stroke();

  // Lighter mossy belly & brow ridge
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.ellipse(2, 6, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cute stubby ivory horns
  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-16, -13);
  ctx.lineTo(-22, -28);
  ctx.lineTo(-7, -16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14, -13);
  ctx.lineTo(22, -28);
  ctx.lineTo(5, -16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mischievous glowing amber eyes
  if (stunned) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.lineTo(4, -1);
    ctx.moveTo(4, -9);
    ctx.lineTo(-4, -1);
    ctx.moveTo(9, -9);
    ctx.lineTo(17, -1);
    ctx.moveTo(17, -9);
    ctx.lineTo(9, -1);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -5, 5.5, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(12, -5, 5.2, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(2, -5, 2.5, 0, Math.PI * 2);
    ctx.arc(14, -5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Fanged grin
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(6, 5, 6.5, 0.1, Math.PI - 0.1);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.lineTo(4, 10);
    ctx.lineTo(6, 6);
    ctx.moveTo(8, 6);
    ctx.lineTo(10, 10);
    ctx.lineTo(12, 6);
    ctx.fill();
  }

  ctx.restore();
}

function drawIronBeetleFrame(ctx: CanvasRenderingContext2D, frame: number) {
  const stunned = frame === ENEMY_FRAMES.STUNNED;
  const skitter = frame === ENEMY_FRAMES.WALK_0 ? 4 : frame === ENEMY_FRAMES.WALK_1 ? -4 : 0;

  ctx.save();
  if (stunned) {
    ctx.translate(0, 8);
    ctx.scale(1, -1);
  }

  // Skittering steel legs
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const lx of [-15, -2, 11]) {
    ctx.beginPath();
    ctx.moveTo(lx, 14);
    ctx.lineTo(lx + skitter, 25);
    ctx.stroke();
  }

  // Heavy dark-iron lower chassis
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  drawRoundedRectPath(ctx, -25, 4, 50, 14, 6);
  ctx.fill();
  ctx.stroke();

  // Gleaming razor dorsal spikes (unmistakable "do not stomp" cue)
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.5;
  const spikes = [
    {x: -15, y: -6, tipX: -20, tipY: -25},
    {x: 0, y: -12, tipX: 0, tipY: -33},
    {x: 14, y: -6, tipX: 19, tipY: -25},
  ];
  for (const sp of spikes) {
    ctx.beginPath();
    ctx.moveTo(sp.x - 6, sp.y + 4);
    ctx.lineTo(sp.tipX, sp.tipY);
    ctx.lineTo(sp.x + 6, sp.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Crimson armored carapace dome
  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(0, 8, 24, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Metallic highlight band on carapace
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 8, 17, Math.PI + 0.4, -0.8);
  ctx.stroke();

  // Glowing armored visor slit
  ctx.fillStyle = '#0f172a';
  drawRoundedRectPath(ctx, 4, -2, 18, 9, 4);
  ctx.fill();
  ctx.fillStyle = stunned ? '#94a3b8' : '#fbbf24';
  drawRoundedRectPath(ctx, 8, 0.5, 11, 4, 2);
  ctx.fill();

  ctx.restore();
}

function drawNightwingFrame(ctx: CanvasRenderingContext2D, frame: number) {
  const stunned = frame === ENEMY_FRAMES.STUNNED;
  const wingAngles = [-0.55, 0.1, 0.65, 0.9];
  const wingAngle = wingAngles[frame] ?? 0;

  ctx.save();
  if (stunned) {
    ctx.rotate(Math.PI);
  }

  // Scalloped bat/glider wings
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.translate(side * 10, -2);
    ctx.rotate(side * wingAngle);
    ctx.fillStyle = '#4c1d95';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(side * 28, -12);
    ctx.quadraticCurveTo(side * 24, 4, side * 16, 12);
    ctx.quadraticCurveTo(side * 9, 5, 0, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Bright violet inner wing rib
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(side * 4, 0);
    ctx.lineTo(side * 21, -7);
    ctx.stroke();
    ctx.restore();
  }

  // Sleek pointed ears
  ctx.fillStyle = '#6d28d9';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3.8;
  for (const ex of [-9, 9]) {
    ctx.beginPath();
    ctx.moveTo(ex - 5, -10);
    ctx.lineTo(ex + (ex < 0 ? -5 : 5), -27);
    ctx.lineTo(ex + 5, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Round midnight-indigo torso
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Chest tuft
  ctx.fillStyle = '#c4b5fd';
  ctx.beginPath();
  ctx.ellipse(2, 6, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sharp golden eyes
  ctx.fillStyle = stunned ? '#94a3b8' : '#facc15';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(-3, -3, 4.5, 5, -0.2, 0, Math.PI * 2);
  ctx.ellipse(9, -3, 4.5, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-1.5, -3, 2, 0, Math.PI * 2);
  ctx.arc(10.5, -3, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEmberTurretFrame(ctx: CanvasRenderingContext2D, frame: number) {
  const stunned = frame === ENEMY_FRAMES.STUNNED;
  const charging = frame === ENEMY_FRAMES.WALK_1;
  const recoil = frame === ENEMY_FRAMES.ACTION ? -5 : 0;

  ctx.save();
  if (stunned) {
    ctx.rotate(0.25);
    ctx.translate(0, 4);
  }

  // Heavy riveted base treads
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  drawRoundedRectPath(ctx, -24, 14, 48, 12, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  for (const wx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.arc(wx, 20, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flared brass cannon muzzle
  ctx.save();
  ctx.translate(recoil, 0);
  ctx.fillStyle = '#b45309';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  drawRoundedRectPath(ctx, 6, -12, 24, 18, 4);
  ctx.fill();
  ctx.stroke();
  // Glowing furnace barrel rim
  ctx.fillStyle = charging ? '#fef08a' : '#f97316';
  ctx.beginPath();
  ctx.ellipse(29, -3, 5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Main armored furnace hull
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.2;
  drawRoundedRectPath(ctx, -22, -18, 38, 34, 10);
  ctx.fill();
  ctx.stroke();

  // Brass top vent cap
  ctx.fillStyle = '#d97706';
  drawRoundedRectPath(ctx, -14, -24, 22, 8, 4);
  ctx.fill();
  ctx.stroke();

  // Furnace eye-lens
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-4, -2, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = stunned ? '#64748b' : charging ? '#fef08a' : '#fb923c';
  ctx.beginPath();
  ctx.arc(-3, -2, 5.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Generates and caches a 4-frame revamped Boss sprite sheet (768x192) for Baron Cinder-Crown.
 */
export function getBossSpriteSheet(phase: 1 | 2): SpriteSheetAtlas {
  const cached = bossSheetCache.get(phase);
  if (cached) return cached;

  const canvas = createOffscreenSheet(BOSS_FRAME_SIZE * BOSS_FRAME_COUNT, BOSS_FRAME_SIZE);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let f = 0; f < BOSS_FRAME_COUNT; f++) {
      ctx.save();
      ctx.translate(f * BOSS_FRAME_SIZE + BOSS_FRAME_SIZE / 2, BOSS_FRAME_SIZE / 2 + 12);
      drawBaronCinderCrownFrame(ctx, phase, f);
      ctx.restore();
    }
  }

  const atlas: SpriteSheetAtlas = {
    canvas,
    frameWidth: BOSS_FRAME_SIZE,
    frameHeight: BOSS_FRAME_SIZE,
    frameCount: BOSS_FRAME_COUNT,
  };
  bossSheetCache.set(phase, atlas);
  return atlas;
}

function drawBaronCinderCrownFrame(ctx: CanvasRenderingContext2D, phase: 1 | 2, frame: number) {
  const isPhase2 = phase === 2;
  const armorMain = isPhase2 ? '#7f1d1d' : '#334155';
  const armorHighlight = isPhase2 ? '#dc2626' : '#64748b';
  const coreColor = isPhase2 ? '#fef08a' : '#fb923c';
  const outline = 5.5;

  const telegraph = frame === BOSS_FRAMES.TELEGRAPH;
  const attack = frame === BOSS_FRAMES.ATTACK;
  const dizzy = frame === BOSS_FRAMES.DIZZY;

  ctx.save();
  if (telegraph) {
    ctx.translate(0, 8);
    ctx.scale(1.08, 0.9);
  } else if (attack) {
    ctx.translate(0, -4);
    ctx.scale(0.96, 1.05);
  } else if (dizzy) {
    ctx.rotate(-0.08);
  }

  // 1. Tattered Crimson War-Mantle
  ctx.fillStyle = '#991b1b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = outline;
  ctx.beginPath();
  ctx.moveTo(-36, -24);
  ctx.lineTo(-70, 56);
  ctx.lineTo(-48, 48);
  ctx.lineTo(-34, 62);
  ctx.lineTo(-14, 52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Heavy Armored Boots
  drawRoundedRectPath(ctx, -38, 38, 28, 24, 9);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.stroke();
  drawRoundedRectPath(ctx, 10, 38, 28, 24, 9);
  ctx.fill();
  ctx.stroke();

  // 3. Back Gauntlet
  const backArmY = telegraph ? -36 : attack ? 26 : 12;
  drawCapsule(ctx, -34, -4, -52, backArmY, 13, armorMain, outline);

  // 4. Massive Forged Iron Colossus Torso
  ctx.fillStyle = armorMain;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = outline;
  drawRoundedRectPath(ctx, -46, -40, 92, 86, 32);
  ctx.fill();
  ctx.stroke();

  // Armor Shoulder Pauldrons
  ctx.fillStyle = armorHighlight;
  ctx.beginPath();
  ctx.ellipse(-42, -16, 16, 20, -0.3, 0, Math.PI * 2);
  ctx.ellipse(42, -16, 16, 20, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Molten Furnace Chest Core
  ctx.fillStyle = '#0f172a';
  drawRoundedRectPath(ctx, -20, 4, 46, 28, 12);
  ctx.fill();
  ctx.fillStyle = coreColor;
  drawRoundedRectPath(ctx, -14, 9, 34, 18, 8);
  ctx.fill();
  // Furnace grate bars
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-3, 9);
  ctx.lineTo(-3, 27);
  ctx.moveTo(9, 9);
  ctx.lineTo(9, 27);
  ctx.stroke();

  // Jagged Golden-Obsidian Crown (tilted when dizzy!)
  ctx.save();
  if (dizzy) {
    ctx.translate(-4, -42);
    ctx.rotate(-0.22);
  } else {
    ctx.translate(0, -40);
  }
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = outline;
  ctx.beginPath();
  ctx.moveTo(-32, 4);
  ctx.lineTo(-38, -28);
  ctx.lineTo(-14, -10);
  ctx.lineTo(0, -36);
  ctx.lineTo(14, -10);
  ctx.lineTo(38, -28);
  ctx.lineTo(32, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Crown magma gem
  ctx.fillStyle = isPhase2 ? '#ef4444' : '#f97316';
  ctx.beginPath();
  ctx.arc(0, -10, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Visor & Expressive Eyes
  ctx.fillStyle = '#0f172a';
  drawRoundedRectPath(ctx, -10, -28, 48, 22, 9);
  ctx.fill();

  if (dizzy) {
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(12, -11);
    ctx.moveTo(12, -23);
    ctx.lineTo(0, -11);
    ctx.moveTo(20, -23);
    ctx.lineTo(32, -11);
    ctx.moveTo(32, -23);
    ctx.lineTo(20, -11);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(6, -17, 7, 6.5, 0, 0, Math.PI * 2);
    ctx.ellipse(26, -17, 7, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(8, -17, 3.2, 0, Math.PI * 2);
    ctx.arc(28, -17, 3.2, 0, Math.PI * 2);
    ctx.fill();
    // Fierce brow bar
    ctx.strokeStyle = armorMain;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, -27);
    ctx.lineTo(16, -21);
    ctx.lineTo(36, -27);
    ctx.stroke();
  }

  // 5. Front Heavy Gauntlet
  const frontArmX = telegraph ? 52 : attack ? 58 : 44;
  const frontArmY = telegraph ? -38 : attack ? 28 : 16;
  drawCapsule(ctx, 32, -2, frontArmX, frontArmY, 14, armorHighlight, outline);

  ctx.restore();
}
