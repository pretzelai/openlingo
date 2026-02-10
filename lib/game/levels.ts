const XP_THRESHOLDS = [0, 60, 150, 300, 500, 800, 1200, 1800, 2600, 3600, 5000];

export function getLevelForXp(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXpForNextLevel(level: number): number {
  if (level <= 0) return XP_THRESHOLDS[1] ?? 60;
  if (level >= XP_THRESHOLDS.length) return Infinity;
  return XP_THRESHOLDS[level] ?? Infinity;
}

export function getXpProgress(xp: number): { current: number; needed: number; percentage: number } {
  const level = getLevelForXp(xp);
  const currentLevelXp = XP_THRESHOLDS[level - 1] ?? 0;
  const nextLevelXp = XP_THRESHOLDS[level] ?? xp;
  const current = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  const percentage = needed > 0 ? (current / needed) * 100 : 100;
  return { current, needed, percentage };
}
