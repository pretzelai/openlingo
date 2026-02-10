export function computeStreak(
  currentStreak: number,
  lastPracticeDate: string | null
): { newStreak: number; shouldUpdate: boolean } {
  if (!lastPracticeDate) {
    return { newStreak: 1, shouldUpdate: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(lastPracticeDate);
  last.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Already practiced today
    return { newStreak: currentStreak, shouldUpdate: false };
  }
  if (diffDays === 1) {
    // Consecutive day
    return { newStreak: currentStreak + 1, shouldUpdate: true };
  }
  // Streak broken
  return { newStreak: 1, shouldUpdate: true };
}
