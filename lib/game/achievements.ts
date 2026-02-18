export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requirement: {
    type: string;
    value: number;
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first-lesson",
    title: "First Steps",
    description: "Complete your first lesson",
    icon: "🎯",
    category: "lessons",
    requirement: { type: "lessons_completed", value: 1 },
  },
  {
    id: "five-lessons",
    title: "Getting Started",
    description: "Complete 5 lessons",
    icon: "📖",
    category: "lessons",
    requirement: { type: "lessons_completed", value: 5 },
  },
  {
    id: "ten-lessons",
    title: "Dedicated Learner",
    description: "Complete 10 lessons",
    icon: "🏆",
    category: "lessons",
    requirement: { type: "lessons_completed", value: 10 },
  },
  {
    id: "streak-3",
    title: "On Fire",
    description: "Reach a 3-day streak",
    icon: "🔥",
    category: "streaks",
    requirement: { type: "streak", value: 3 },
  },
  {
    id: "streak-7",
    title: "Week Warrior",
    description: "Reach a 7-day streak",
    icon: "⚡",
    category: "streaks",
    requirement: { type: "streak", value: 7 },
  },
  {
    id: "streak-30",
    title: "Unstoppable",
    description: "Reach a 30-day streak",
    icon: "💎",
    category: "streaks",
    requirement: { type: "streak", value: 30 },
  },
  {
    id: "perfect-1",
    title: "Perfectionist",
    description: "Complete a lesson with a perfect score",
    icon: "💯",
    category: "perfect",
    requirement: { type: "perfect_lessons", value: 1 },
  },
  {
    id: "perfect-5",
    title: "Flawless",
    description: "Complete 5 lessons with perfect scores",
    icon: "🎖️",
    category: "perfect",
    requirement: { type: "perfect_lessons", value: 5 },
  },
];
