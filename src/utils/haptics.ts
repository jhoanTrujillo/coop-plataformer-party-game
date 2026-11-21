let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

function pulse(pattern: number | number[]) {
  if (!hapticsEnabled) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore unsupported mobile browsers
    }
  }
}

export const haptics = {
  tap: () => pulse(10),
  jump: () => pulse(14),
  puff: () => pulse([10, 18, 12]),
  grab: () => pulse(18),
  throwItem: () => pulse([14, 14, 10]),
  coin: () => pulse(8),
  powerup: () => pulse([14, 18, 22]),
  explode: () => pulse([36, 22, 48]),
  megaExplode: () => pulse([50, 24, 70]),
  hurt: () => pulse([45, 25, 45]),
  victory: () => pulse([20, 30, 20, 30, 60]),
};
