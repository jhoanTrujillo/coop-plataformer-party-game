import {
  BossEntity,
  CHARACTER_PALETTES,
  EnemyEntity,
  GameEvent,
  ItemEntity,
  PlayerState,
  ProjectileEntity,
  StageTheme,
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
  WorldState,
} from '../shared/types';
import {
  BOSS_FRAMES,
  ENEMY_FRAMES,
  PLAYER_FRAMES,
  getBossSpriteSheet,
  getEnemySpriteSheet,
  getPlayerSpriteSheet,
} from './spriteSheets';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  kind: 'circle' | 'star' | 'ring' | 'square';
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

/**
 * Independent per-player camera instance attached strictly to one player ID.
 * Each client owns its own PlayerCamera so players never lose their camera when the host moves away.
 */
export interface PlayerCamera {
  ownerPlayerId: string;
  x: number;
  y: number;
  lookAheadX: number;
  initialized: boolean;
  lastStageIndex: number;
  lastAnchorX: number;
  lastAnchorY: number;
}

export function createPlayerCamera(ownerPlayerId: string): PlayerCamera {
  return {
    ownerPlayerId,
    x: 0,
    y: 0,
    lookAheadX: 0,
    initialized: false,
    lastStageIndex: -1,
    lastAnchorX: 120,
    lastAnchorY: 320,
  };
}

export interface RenderFxState {
  particles: Particle[];
  texts: FloatingText[];
  shake: number;
}

export function createRenderFx(): RenderFxState {
  return {
    particles: [],
    texts: [],
    shake: 0,
  };
}

export function spawnFxFromEvents(fx: RenderFxState, events: GameEvent[]) {
  for (const ev of events) {
    if (ev.label) {
      fx.texts.push({
        x: ev.x,
        y: ev.y - 12,
        text: ev.label,
        color:
          ev.type === 'hurt'
            ? '#fda4af'
            : ev.type === 'boss_hit'
              ? '#fb923c'
              : '#fef08a',
        life: 0.95,
        maxLife: 0.95,
      });
    }

    switch (ev.type) {
      case 'jump':
        for (let i = 0; i < 6; i++) {
          fx.particles.push({
            x: ev.x + (Math.random() - 0.5) * 14,
            y: ev.y,
            vx: (Math.random() - 0.5) * 80,
            vy: -Math.random() * 35,
            size: 4 + Math.random() * 3,
            color: '#f8fafc',
            life: 0.28,
            maxLife: 0.28,
            kind: 'circle',
          });
        }
        break;

      case 'double_jump':
        fx.particles.push({
          x: ev.x,
          y: ev.y,
          vx: 0,
          vy: 10,
          size: 10,
          color: '#ffffff',
          life: 0.28,
          maxLife: 0.28,
          kind: 'ring',
        });
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI * 2 * i) / 8;
          fx.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(ang) * 90,
            vy: Math.sin(ang) * 35 + 24,
            size: 4.5 + Math.random() * 3.5,
            color: i % 2 === 0 ? '#ffffff' : '#bae6fd',
            life: 0.32,
            maxLife: 0.32,
            kind: 'circle',
          });
        }
        break;

      case 'explode':
      case 'mega_explode': {
        const mega = ev.type === 'mega_explode';
        fx.shake = Math.max(fx.shake, mega ? 14 : 9);
        fx.particles.push({
          x: ev.x,
          y: ev.y,
          vx: 0,
          vy: 0,
          size: mega ? 28 : 20,
          color: mega ? '#facc15' : '#fb923c',
          life: 0.36,
          maxLife: 0.36,
          kind: 'ring',
        });
        const count = mega ? 26 : 18;
        for (let i = 0; i < count; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * (mega ? 260 : 190);
          fx.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 40,
            size: 5 + Math.random() * (mega ? 10 : 7),
            color: i % 3 === 0 ? '#fef08a' : i % 3 === 1 ? '#fb923c' : '#ef4444',
            life: 0.45 + Math.random() * 0.2,
            maxLife: 0.65,
            kind: i % 4 === 0 ? 'star' : 'circle',
          });
        }
        break;
      }

      case 'brick_break':
        fx.shake = Math.max(fx.shake, 4);
        for (let i = 0; i < 10; i++) {
          fx.particles.push({
            x: ev.x + (Math.random() - 0.5) * 16,
            y: ev.y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 210,
            vy: -90 - Math.random() * 140,
            size: 5 + Math.random() * 4,
            color: i % 2 === 0 ? '#d97706' : '#fbbf24',
            life: 0.48,
            maxLife: 0.48,
            kind: 'square',
          });
        }
        break;

      case 'coin':
      case 'star':
      case 'powerup':
      case 'revive':
        for (let i = 0; i < (ev.type === 'coin' ? 6 : 14); i++) {
          const ang = (Math.PI * 2 * i) / (ev.type === 'coin' ? 6 : 14);
          fx.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(ang) * (70 + Math.random() * 70),
            vy: Math.sin(ang) * (70 + Math.random() * 70),
            size: 4 + Math.random() * 3,
            color: ev.type === 'revive' ? '#38bdf8' : '#facc15',
            life: 0.42,
            maxLife: 0.42,
            kind: 'star',
          });
        }
        break;

      case 'boss_slam':
        fx.shake = Math.max(fx.shake, 11);
        for (let i = 0; i < 12; i++) {
          fx.particles.push({
            x: ev.x + (Math.random() - 0.5) * 50,
            y: ev.y,
            vx: (Math.random() - 0.5) * 220,
            vy: -Math.random() * 110,
            size: 6 + Math.random() * 5,
            color: '#fb923c',
            life: 0.4,
            maxLife: 0.4,
            kind: 'circle',
          });
        }
        break;

      case 'boss_hit':
      case 'hurt':
      case 'stomp':
        fx.shake = Math.max(fx.shake, ev.type === 'boss_hit' ? 7 : 5);
        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          fx.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(ang) * 140,
            vy: Math.sin(ang) * 140,
            size: 4 + Math.random() * 4,
            color: ev.type === 'hurt' ? '#f43f5e' : '#fef08a',
            life: 0.35,
            maxLife: 0.35,
            kind: 'star',
          });
        }
        break;

      case 'boss_defeat':
      case 'stage_clear':
        fx.shake = Math.max(fx.shake, 10);
        for (let i = 0; i < 28; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 90 + Math.random() * 200;
          fx.particles.push({
            x: ev.x,
            y: ev.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 60,
            size: 6 + Math.random() * 5,
            color: ['#facc15', '#34d399', '#38bdf8', '#fb7185'][i % 4],
            life: 0.75,
            maxLife: 0.75,
            kind: 'star',
          });
        }
        break;
    }
  }
}

export function stepRenderFx(fx: RenderFxState, dt: number) {
  fx.shake = Math.max(0, fx.shake - dt * 28);
  fx.particles = fx.particles.filter((pt) => {
    pt.life -= dt;
    if (pt.life <= 0) return false;
    if (pt.kind === 'ring') {
      pt.size += dt * 185;
    } else {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.kind === 'square') pt.vy += 520 * dt;
    }
    return true;
  });

  fx.texts = fx.texts.filter((t) => {
    t.life -= dt;
    t.y -= dt * 36;
    return t.life > 0;
  });
}

function stepPlayerCamera(
  camera: PlayerCamera,
  world: WorldState,
  visibleWorldW: number,
  visibleWorldH: number,
  dt: number,
) {
  const worldPixelW = world.width * TILE_SIZE;
  const worldPixelH = world.height * TILE_SIZE;

  // Strictly bind to this client's own player ID (only fall back to players[0] in single-player)
  const ownedPlayer =
    world.players.find((p) => p.id === camera.ownerPlayerId) ??
    (world.players.length === 1 ? world.players[0] : undefined);

  if (ownedPlayer) {
    camera.lastAnchorX = ownedPlayer.x + ownedPlayer.w / 2;
    camera.lastAnchorY = ownedPlayer.y + ownedPlayer.h / 2;
    const desiredLookAhead = ownedPlayer.facing * 26;
    const lookLerp = 1 - Math.exp(-6 * dt);
    camera.lookAheadX += (desiredLookAhead - camera.lookAheadX) * lookLerp;
  }

  let targetCamX = camera.lastAnchorX + camera.lookAheadX - visibleWorldW * 0.5;
  if (worldPixelW <= visibleWorldW) {
    targetCamX = (worldPixelW - visibleWorldW) / 2;
  } else {
    targetCamX = Math.max(0, Math.min(worldPixelW - visibleWorldW, targetCamX));
  }

  let targetCamY = camera.lastAnchorY - visibleWorldH * 0.56;
  targetCamY = Math.max(0, Math.min(Math.max(0, worldPixelH - visibleWorldH), targetCamY));

  // Snap immediately on first frame or stage change so the camera never drifts across the map
  const stageChanged = camera.lastStageIndex !== world.stageIndex;
  if (!camera.initialized || stageChanged) {
    camera.x = targetCamX;
    camera.y = targetCamY;
    camera.initialized = true;
    camera.lastStageIndex = world.stageIndex;
  } else {
    const smoothX = 1 - Math.exp(-10.5 * dt);
    const smoothY = 1 - Math.exp(-8.5 * dt);
    camera.x += (targetCamX - camera.x) * smoothX;
    camera.y += (targetCamY - camera.y) * smoothY;
  }
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  world: WorldState,
  camera: PlayerCamera,
  fx: RenderFxState,
  timeSec: number,
  dt: number,
) {
  const worldPixelH = world.height * TILE_SIZE;
  const visibleWorldH = Math.min(worldPixelH, 16 * TILE_SIZE);
  const scale = viewH / visibleWorldH;
  const visibleWorldW = viewW / scale;

  // Update this player's dedicated independent camera instance
  stepPlayerCamera(camera, world, visibleWorldW, visibleWorldH, dt);

  const shakeX = fx.shake > 0.2 ? (Math.random() - 0.5) * fx.shake : 0;
  const shakeY = fx.shake > 0.2 ? (Math.random() - 0.5) * fx.shake : 0;

  ctx.save();
  ctx.scale(scale, scale);

  // 1. Layered Parallax Sky & Terrain Backdrop
  drawBackdrop(ctx, visibleWorldW, visibleWorldH, camera.x, world.theme, timeSec);

  ctx.save();
  ctx.translate(-Math.round(camera.x) + shakeX, -Math.round(camera.y) + shakeY);

  // 2. Visible Tiles (culled in X & Y)
  const startTx = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
  const endTx = Math.min(world.width - 1, Math.ceil((camera.x + visibleWorldW) / TILE_SIZE) + 1);
  const startTy = Math.max(0, Math.floor(camera.y / TILE_SIZE) - 1);
  const endTy = Math.min(world.height - 1, Math.ceil((camera.y + visibleWorldH) / TILE_SIZE) + 1);
  for (let ty = startTy; ty <= endTy; ty++) {
    for (let tx = startTx; tx <= endTx; tx++) {
      const tile = world.tiles[ty * world.width + tx];
      if (tile === TILE_EMPTY) continue;
      const above = ty > 0 ? world.tiles[(ty - 1) * world.width + tx] : TILE_EMPTY;
      drawTile(ctx, tx * TILE_SIZE, ty * TILE_SIZE, tile, above, world.theme, timeSec, tx, ty);
    }
  }

  // 3. Items (Coins, Stars, PowerUps, Crates, Bombs)
  for (const it of world.items) {
    if (it.x + it.w < camera.x - 48 || it.x > camera.x + visibleWorldW + 48) continue;
    drawItem(ctx, it, timeSec);
  }

  // 4. Enemies (rendered from revamped sprite sheets!)
  for (const en of world.enemies) {
    if (en.x + en.w < camera.x - 64 || en.x > camera.x + visibleWorldW + 64) continue;
    drawEnemy(ctx, en, timeSec);
  }

  // 5. Boss (rendered from revamped boss sprite sheet!)
  if (world.boss) {
    drawBoss(ctx, world.boss, timeSec);
  }

  // 6. Projectiles
  for (const pr of world.projectiles) {
    drawProjectile(ctx, pr, timeSec);
  }

  // 7. Players (rendered from PEAK-style single-color humanoid sprite sheets!)
  for (const p of world.players) {
    drawPlayer(ctx, p, p.id === camera.ownerPlayerId, world.players.length > 1, timeSec);
  }

  // 8. Particles & Floating Score Popups
  for (const pt of fx.particles) {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (pt.kind === 'ring') {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pt.kind === 'star') {
      drawMiniStar(ctx, pt.x, pt.y, pt.size, pt.color);
    } else if (pt.kind === 'square') {
      ctx.fillStyle = pt.color;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.strokeRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const t of fx.texts) {
    const alpha = Math.min(1, (t.life / t.maxLife) * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 14px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }

  ctx.restore();

  // 9. Screen-edge directional markers for off-screen teammates (so players can explore freely!)
  if (world.players.length > 1) {
    drawOffscreenTeammateMarkers(ctx, world, camera, visibleWorldW, visibleWorldH);
  }

  ctx.restore();
}

function drawOffscreenTeammateMarkers(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  camera: PlayerCamera,
  viewW: number,
  viewH: number,
) {
  const pad = 22;
  for (const p of world.players) {
    if (p.id === camera.ownerPlayerId) continue;
    const sx = p.x + p.w / 2 - camera.x;
    const sy = p.y + p.h / 2 - camera.y;
    if (sx >= 0 && sx <= viewW && sy >= 0 && sy <= viewH) continue;

    const pal = CHARACTER_PALETTES[p.color] ?? CHARACTER_PALETTES.sakura;
    const cx = viewW / 2;
    const cy = viewH / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const angle = Math.atan2(dy, dx);

    const mx = Math.max(pad, Math.min(viewW - pad, sx));
    const my = Math.max(54, Math.min(viewH - 42, sy));

    ctx.save();
    ctx.translate(mx, my);

    // Directional chevron
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = pal.body;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(6, -6);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Solid color circular badge with initial
    ctx.fillStyle = pal.body;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 10px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((p.name[0] || 'P').toUpperCase(), 0, 0.5);

    ctx.restore();
  }
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  theme: StageTheme,
  timeSec: number,
) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (theme === 'meadow') {
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(0.58, '#7dd3fc');
    grad.addColorStop(1, '#e0f2fe');
  } else if (theme === 'ruins') {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.55, '#4338ca');
    grad.addColorStop(1, '#818cf8');
  } else {
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.55, '#451a03');
    grad.addColorStop(1, '#9a3412');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (theme === 'ruins') {
    for (let i = 0; i < 28; i++) {
      const sx = (((i * 97 - camX * 0.08) % (w + 60)) + (w + 60)) % (w + 60) - 30;
      const sy = 24 + ((i * 53) % 240);
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3 + i);
      ctx.fillStyle = `rgba(254, 240, 138, ${0.4 + pulse * 0.6})`;
      ctx.fillRect(sx, sy, 3, 3);
    }
  } else if (theme === 'citadel') {
    for (let i = 0; i < 22; i++) {
      const ex = (((i * 83 - camX * 0.12) % (w + 40)) + (w + 40)) % (w + 40) - 20;
      const ey = h - ((timeSec * 38 + i * 47) % h);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 146, 60, 0.7)' : 'rgba(250, 204, 21, 0.6)';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stylized drifting clouds (Meadow & Ruins)
  if (theme !== 'citadel') {
    const cloudColor = theme === 'meadow' ? 'rgba(255,255,255,0.9)' : 'rgba(224,231,255,0.28)';
    const outline = theme === 'meadow' ? 'rgba(14,165,233,0.32)' : 'rgba(129,140,248,0.35)';
    for (let i = 0; i < 8; i++) {
      const cx =
        (((i * 220 + timeSec * 8 - camX * 0.16) % (w + 260)) + (w + 260)) % (w + 260) - 130;
      const cy = 58 + (i % 3) * 52;
      ctx.fillStyle = cloudColor;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.arc(cx + 22, cy - 8, 28, 0, Math.PI * 2);
      ctx.arc(cx + 48, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Parallax mountain peaks & cliff silhouettes
  const hillStep = 240;
  const parallax = camX * 0.25;
  const startIdx = Math.floor(parallax / hillStep) - 1;
  for (let i = startIdx; i < startIdx + Math.ceil(w / hillStep) + 3; i++) {
    const hx = i * hillStep - parallax;
    if (theme === 'meadow') {
      ctx.fillStyle = i % 2 === 0 ? '#22c55e' : '#16a34a';
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx - 20, h);
      ctx.lineTo(hx + 75, h - (i % 2 === 0 ? 175 : 135));
      ctx.lineTo(hx + 145, h - (i % 2 === 0 ? 155 : 120));
      ctx.lineTo(hx + 240, h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Sunlit cliff ridge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(hx + 75, h - (i % 2 === 0 ? 175 : 135));
      ctx.lineTo(hx + 108, h - (i % 2 === 0 ? 166 : 128));
      ctx.lineTo(hx + 68, h - 45);
      ctx.closePath();
      ctx.fill();
    } else if (theme === 'ruins') {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(67, 56, 202, 0.55)' : 'rgba(99, 102, 241, 0.42)';
      ctx.beginPath();
      ctx.moveTo(hx, h);
      ctx.lineTo(hx + 70, h - 185);
      ctx.lineTo(hx + 150, h - 135);
      ctx.lineTo(hx + 220, h);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(28, 25, 23, 0.65)';
      ctx.fillRect(hx + 10, h - 170, 90, 170);
      ctx.fillRect(hx + 25, h - 190, 20, 20);
      ctx.fillRect(hx + 65, h - 190, 20, 20);
      ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
      ctx.fillRect(hx + 44, h - 135, 22, 34);
    }
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: number,
  above: number,
  theme: StageTheme,
  timeSec: number,
  tx: number,
  ty: number,
) {
  const s = TILE_SIZE;
  const checker = (tx + ty) % 2 === 0;

  if (tile === TILE_GROUND) {
    if (theme === 'meadow') {
      ctx.fillStyle = checker ? '#b45309' : '#92400e';
      ctx.fillRect(x, y, s, s);
      if (above === TILE_EMPTY || above === TILE_BOMB_SPAWNER || above === TILE_GOAL) {
        ctx.fillStyle = checker ? '#4ade80' : '#22c55e';
        ctx.fillRect(x, y, s, 10);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(x, y + 9, s, 3);
      }
    } else if (theme === 'ruins') {
      ctx.fillStyle = checker ? '#475569' : '#334155';
      ctx.fillRect(x, y, s, s);
      if (above === TILE_EMPTY || above === TILE_BOMB_SPAWNER || above === TILE_GOAL) {
        ctx.fillStyle = checker ? '#a5b4fc' : '#818cf8';
        ctx.fillRect(x, y, s, 9);
      }
    } else {
      ctx.fillStyle = checker ? '#44403c' : '#292524';
      ctx.fillRect(x, y, s, s);
      if (above === TILE_EMPTY || above === TILE_BOMB_SPAWNER) {
        ctx.fillStyle = checker ? '#ea580c' : '#c2410c';
        ctx.fillRect(x, y, s, 7);
      }
    }
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    return;
  }

  if (tile === TILE_BRICK) {
    ctx.fillStyle = theme === 'ruins' ? '#6366f1' : theme === 'citadel' ? '#7c2d12' : '#d97706';
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(x, y + s / 2);
    ctx.lineTo(x + s, y + s / 2);
    ctx.moveTo(x + s / 2, y);
    ctx.lineTo(x + s / 2, y + s / 2);
    ctx.moveTo(x + s / 4, y + s / 2);
    ctx.lineTo(x + s / 4, y + s);
    ctx.stroke();
    return;
  }

  if (tile === TILE_PLATFORM) {
    ctx.fillStyle = theme === 'citadel' ? '#94a3b8' : theme === 'ruins' ? '#c7d2fe' : '#f8fafc';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    roundRect(ctx, x + 1, y + 2, s - 2, 13, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme === 'citadel' ? '#fb923c' : '#38bdf8';
    ctx.fillRect(x + 6, y + 5, s - 12, 3);
    return;
  }

  if (tile === TILE_CRACKED) {
    ctx.fillStyle = '#78716c';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 5);
    ctx.lineTo(x + 15, y + 15);
    ctx.lineTo(x + 25, y + 11);
    ctx.moveTo(x + 15, y + 15);
    ctx.lineTo(x + 11, y + 26);
    ctx.moveTo(x + 15, y + 15);
    ctx.lineTo(x + 24, y + 24);
    ctx.stroke();
    return;
  }

  if (tile === TILE_QUESTION || tile === TILE_USED) {
    const isQ = tile === TILE_QUESTION;
    const bounce = isQ ? Math.sin(timeSec * 5 + tx) * 1.5 : 0;
    ctx.fillStyle = isQ ? '#facc15' : '#64748b';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    roundRect(ctx, x + 1, y + 1 + bounce, s - 2, s - 2, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isQ ? '#b45309' : '#334155';
    ctx.fillRect(x + 4, y + 4 + bounce, 3, 3);
    ctx.fillRect(x + s - 7, y + 4 + bounce, 3, 3);
    ctx.fillRect(x + 4, y + s - 7 + bounce, 3, 3);
    ctx.fillRect(x + s - 7, y + s - 7 + bounce, 3, 3);
    if (isQ) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 18px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + s / 2, y + s / 2 + 1 + bounce);
    }
    return;
  }

  if (tile === TILE_BOMB_SPAWNER) {
    const glow = 0.5 + 0.5 * Math.sin(timeSec * 5);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 2, y + 16, s - 4, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(250, 204, 21, ${0.45 + glow * 0.55})`;
    ctx.fillRect(x + 6, y + 20, s - 12, 5);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + 13, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (tile === TILE_HAZARD) {
    const isLava = theme === 'citadel';
    if (isLava) {
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x, y + 8, s, s - 8);
      ctx.fillStyle = '#facc15';
      const wave = Math.sin(timeSec * 6 + tx) * 3;
      ctx.beginPath();
      ctx.arc(x + 8, y + 10 + wave, 5, 0, Math.PI * 2);
      ctx.arc(x + 22, y + 11 - wave, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const sx = x + i * 16;
        ctx.beginPath();
        ctx.moveTo(sx + 1, y + s);
        ctx.lineTo(sx + 8, y + 8);
        ctx.lineTo(sx + 15, y + s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    return;
  }

  if (tile === TILE_GOAL) {
    const pulse = 1 + Math.sin(timeSec * 6) * 0.1;
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(timeSec * 2.2);
    drawMiniStar(ctx, 0, 0, 14 * pulse, '#facc15', '#1e293b');
    ctx.restore();
  }
}

function drawItem(ctx: CanvasRenderingContext2D, it: ItemEntity, timeSec: number) {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;

  if (it.kind === 'coin') {
    const bob = Math.sin(it.bobPhase) * 3;
    const widthScale = 0.65 + 0.35 * Math.abs(Math.cos(timeSec * 4 + it.bobPhase));
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(widthScale, 1);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(-2, -4, 4, 8);
    ctx.restore();
    return;
  }

  if (it.kind === 'star') {
    const bob = Math.sin(it.bobPhase) * 4;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(Math.sin(timeSec * 3) * 0.16);
    drawMiniStar(ctx, 0, 0, 14, '#facc15', '#1e293b');
    drawMiniStar(ctx, 0, 0, 6.5, '#fef9c3');
    ctx.restore();
    return;
  }

  if (it.kind === 'powerup') {
    const bob = Math.sin(timeSec * 6) * 2.5;
    ctx.save();
    ctx.translate(cx, cy + bob);
    const bgMap = {
      mega_bomb: '#ef4444',
      wing_cap: '#38bdf8',
      star_shield: '#a855f7',
      gold_magnet: '#facc15',
      none: '#94a3b8',
    };
    const labelMap = {
      mega_bomb: 'B',
      wing_cap: 'W',
      star_shield: 'S',
      gold_magnet: 'M',
      none: '?',
    };
    const pk = it.powerUpKind ?? 'none';
    ctx.fillStyle = bgMap[pk];
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelMap[pk], 0, 1);
    ctx.restore();
    return;
  }

  if (it.kind === 'crate') {
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.4;
    roundRect(ctx, it.x, it.y, it.w, it.h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(it.x + 4, it.y + 4);
    ctx.lineTo(it.x + it.w - 4, it.y + it.h - 4);
    ctx.moveTo(it.x + it.w - 4, it.y + 4);
    ctx.lineTo(it.x + 4, it.y + it.h - 4);
    ctx.stroke();
    return;
  }

  // Bomb & Mega Bomb
  const isMega = it.kind === 'mega_bomb';
  const r = isMega ? 14 : 11;
  const urgentFlash = it.fuse > 0 && it.fuse < 1.0 && Math.floor(timeSec * 16) % 2 === 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = urgentFlash ? '#ef4444' : isMega ? '#312e81' : '#1e293b';
  ctx.strokeStyle = '#020617';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Metallic gloss & band
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.25, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  if (isMega) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 1, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fuse cap + burning spark
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-3.5, -r - 2, 7, 4);
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r - 2);
  ctx.quadraticCurveTo(5, -r - 8, 8, -r - 5);
  ctx.stroke();

  if (it.fuse > 0) {
    const sparkR = 3.5 + Math.sin(timeSec * 28) * 1.5;
    ctx.fillStyle = urgentFlash ? '#ffffff' : '#facc15';
    ctx.beginPath();
    ctx.arc(8, -r - 5, sparkR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, en: EnemyEntity, timeSec: number) {
  const cx = en.x + en.w / 2;
  const cy = en.y + en.h / 2;
  const stunned = en.stunnedTimer > 0;
  const atlas = getEnemySpriteSheet(en.kind);

  let frame: number = ENEMY_FRAMES.WALK_0;
  if (stunned) {
    frame = ENEMY_FRAMES.STUNNED;
  } else if (en.kind === 'hopper') {
    if (en.vy < -40) frame = ENEMY_FRAMES.ACTION;
    else frame = Math.floor(timeSec * 7 + en.x * 0.05) % 2 === 0 ? ENEMY_FRAMES.WALK_0 : ENEMY_FRAMES.WALK_1;
  } else if (en.kind === 'shellback') {
    frame = Math.floor(timeSec * 8 + en.x * 0.06) % 2 === 0 ? ENEMY_FRAMES.WALK_0 : ENEMY_FRAMES.WALK_1;
  } else if (en.kind === 'swooper') {
    const cycle = [ENEMY_FRAMES.WALK_0, ENEMY_FRAMES.WALK_1, ENEMY_FRAMES.ACTION, ENEMY_FRAMES.WALK_1];
    frame = cycle[Math.floor(timeSec * 10 + en.baseY * 0.05) % cycle.length];
  } else {
    // Ember Mortar-Bot: idle -> charge glow -> fire recoil
    if (en.aiTimer < 0.25) frame = ENEMY_FRAMES.ACTION;
    else if (en.aiTimer < 0.75) frame = ENEMY_FRAMES.WALK_1;
    else frame = ENEMY_FRAMES.WALK_0;
  }

  const drawSize = 44;

  ctx.save();
  ctx.translate(cx, cy - 2);
  ctx.scale(en.facing, 1);

  if (en.hitFlash > 0) {
    ctx.filter = 'brightness(2.1)';
  }

  ctx.drawImage(
    atlas.canvas,
    frame * atlas.frameWidth,
    0,
    atlas.frameWidth,
    atlas.frameHeight,
    -drawSize / 2,
    -drawSize / 2,
    drawSize,
    drawSize,
  );
  ctx.restore();

  // Orbiting dizzy stars when stunned so player knows they can GRAB & THROW it!
  if (stunned) {
    for (let i = 0; i < 2; i++) {
      const ang = timeSec * 6 + i * Math.PI;
      drawMiniStar(ctx, cx + Math.cos(ang) * 13, en.y - 6, 4.5, '#facc15', '#0f172a');
    }
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, b: BossEntity, timeSec: number) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const atlas = getBossSpriteSheet(b.phase);

  let frame: number = BOSS_FRAMES.PATROL;
  if (b.action === 'dizzy' || b.action === 'defeated') {
    frame = BOSS_FRAMES.DIZZY;
  } else if (b.action === 'telegraph_slam') {
    frame = BOSS_FRAMES.TELEGRAPH;
  } else if (b.action === 'slam' || b.action === 'fire_barrage' || b.action === 'charge') {
    frame = BOSS_FRAMES.ATTACK;
  }

  const drawSize = 112;
  const walkBob = b.action === 'patrol' ? Math.sin(timeSec * 8) * 2.5 : 0;

  ctx.save();
  ctx.translate(cx, cy - 6 + walkBob);

  // Phase 2 molten fury aura
  if (b.phase === 2 && b.action !== 'defeated') {
    ctx.fillStyle = `rgba(239, 68, 68, ${0.22 + Math.sin(timeSec * 14) * 0.1})`;
    ctx.beginPath();
    ctx.arc(0, 4, 52, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.scale(b.facing, 1);
  if (b.hitFlash > 0) {
    ctx.filter = 'brightness(2.2)';
  }

  ctx.drawImage(
    atlas.canvas,
    frame * atlas.frameWidth,
    0,
    atlas.frameWidth,
    atlas.frameHeight,
    -drawSize / 2,
    -drawSize / 2,
    drawSize,
    drawSize,
  );
  ctx.restore();

  // Dizzy orbit stars when stunned ("STOMP OR BOMB NOW!")
  if (b.action === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const ang = timeSec * 5 + (i * Math.PI * 2) / 3;
      drawMiniStar(ctx, cx + Math.cos(ang) * 30, b.y - 14 + Math.sin(ang) * 6, 7, '#facc15', '#0f172a');
    }
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, pr: ProjectileEntity, timeSec: number) {
  ctx.save();
  ctx.translate(pr.x, pr.y);
  if (pr.kind === 'shockwave') {
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, pr.radius, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const pulse = 1 + Math.sin(timeSec * 22) * 0.15;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, pr.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, 0, pr.radius * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  isLocal: boolean,
  showName: boolean,
  timeSec: number,
) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const atlas = getPlayerSpriteSheet(p.color);

  // Select sprite-sheet frame cleanly from player state
  let frame: number = PLAYER_FRAMES.IDLE_0;
  if (p.heldItemId) {
    frame = PLAYER_FRAMES.CARRY;
  } else if (p.anim === 'puff') {
    frame = PLAYER_FRAMES.DOUBLE_JUMP;
  } else if (p.anim === 'jump' || p.anim === 'fall') {
    frame = PLAYER_FRAMES.JUMP;
  } else if (p.anim === 'run') {
    const runCycle = [
      PLAYER_FRAMES.RUN_0,
      PLAYER_FRAMES.RUN_1,
      PLAYER_FRAMES.RUN_2,
      PLAYER_FRAMES.RUN_1,
    ];
    frame = runCycle[Math.floor(timeSec * 12) % runCycle.length];
  } else {
    // Gentle idle blink/breathe cycle
    const idleCycle = Math.floor(timeSec * 1.4 + p.x * 0.01) % 6;
    frame = idleCycle === 5 ? PLAYER_FRAMES.IDLE_1 : PLAYER_FRAMES.IDLE_0;
  }

  ctx.save();
  if (p.invulnTimer > 0 && Math.floor(timeSec * 16) % 2 === 0 && !p.inBubble) {
    ctx.globalAlpha = 0.45;
  }

  // Co-op Rescue Bubble
  if (p.inBubble) {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Power-up visual auras
  if (p.powerUp === 'star_shield') {
    const ang = timeSec * 4.5;
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.75)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 22, 0, Math.PI * 2);
    ctx.stroke();
    drawMiniStar(ctx, cx + Math.cos(ang) * 22, cy - 2 + Math.sin(ang) * 22, 5, '#fef08a');
  } else if (p.powerUp === 'gold_magnet') {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.48)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 24 + Math.sin(timeSec * 8) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle squash/stretch + stride bob when carrying while running
  const carryBob = p.heldItemId && p.anim === 'run' ? Math.sin(timeSec * 18) * 1.8 : 0;
  let scaleX = p.facing;
  let scaleY = 1;
  if (p.anim === 'puff') {
    scaleX = p.facing * 1.08;
    scaleY = 1.06;
  } else if (p.anim === 'jump') {
    scaleX = p.facing * 0.94;
    scaleY = 1.07;
  }

  ctx.translate(cx, cy - 4 + carryBob);
  ctx.scale(scaleX, scaleY);

  // Winged Boost power-up fluttering mini-wings on backpack
  if (p.powerUp === 'wing_cap') {
    const wFlap = Math.sin(timeSec * 20) * 4;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(-12, -4 + wFlap * 0.4, 7, 4, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const drawSize = 44;
  ctx.drawImage(
    atlas.canvas,
    frame * atlas.frameWidth,
    0,
    atlas.frameWidth,
    atlas.frameHeight,
    -drawSize / 2,
    -drawSize / 2,
    drawSize,
    drawSize,
  );

  ctx.restore();

  // Player nameplate in multiplayer
  if (showName) {
    ctx.save();
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    const labelY = p.y - (p.heldItemId ? 42 : 20);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(15,23,42,0.88)';
    ctx.strokeText(p.name, cx, labelY);
    ctx.fillStyle = isLocal ? '#facc15' : '#f8fafc';
    ctx.fillText(p.name, cx, labelY);
    ctx.restore();
  }
}

function drawMiniStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  fill: string,
  stroke?: string,
) {
  const innerR = outerR * 0.46;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
