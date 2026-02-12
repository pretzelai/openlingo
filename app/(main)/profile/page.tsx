import { getProfileData } from "@/lib/actions/profile";
import { Card } from "@/components/ui/card";
import { XpDisplay } from "@/components/gamification/xp-display";
import { StreakFlame } from "@/components/gamification/streak-flame";
import { HeartsDisplay } from "@/components/gamification/hearts-display";
import { LevelBadge } from "@/components/gamification/level-badge";
import { AchievementCard } from "@/components/gamification/achievement-card";
import { NativeLanguagePicker } from "./native-language-picker";

export const metadata = { title: "Profile — LingoClaw" };

export default async function ProfilePage() {
  const { user, stats, achievements } = await getProfileData();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* User Header */}
      <Card className="text-center">
        <div className="flex flex-col items-center gap-3">
          <LevelBadge level={stats.level} size="lg" />
          <h1 className="text-2xl font-black text-lingo-text">
            {user.name}
          </h1>
          <p className="text-sm text-lingo-text-light">{user.email}</p>
        </div>
      </Card>

      {/* Settings */}
      <Card>
        <h3 className="font-bold text-lingo-text mb-3">Settings</h3>
        <NativeLanguagePicker currentLanguage={stats.nativeLanguage ?? null} />
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <div className="text-3xl font-black text-lingo-yellow">{stats.xp}</div>
          <div className="text-xs font-bold text-lingo-text-light uppercase mt-1">
            Total XP
          </div>
        </Card>
        <Card className="text-center">
          <StreakFlame streak={stats.currentStreak} />
          <div className="text-xs font-bold text-lingo-text-light uppercase mt-1">
            Day streak
          </div>
        </Card>
        <Card className="text-center">
          <HeartsDisplay hearts={stats.hearts} maxHearts={stats.maxHearts} />
          <div className="text-xs font-bold text-lingo-text-light uppercase mt-1">
            Hearts
          </div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-black text-lingo-purple">
            {stats.totalLessonsCompleted}
          </div>
          <div className="text-xs font-bold text-lingo-text-light uppercase mt-1">
            Lessons
          </div>
        </Card>
      </div>

      {/* XP Progress */}
      <Card>
        <XpDisplay xp={stats.xp} level={stats.level} />
      </Card>

      {/* Stats Details */}
      <Card>
        <h3 className="font-bold text-lingo-text mb-3">Statistics</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-lingo-text-light">Longest Streak</span>
            <span className="font-bold">{stats.longestStreak} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-lingo-text-light">Total Lessons</span>
            <span className="font-bold">{stats.totalLessonsCompleted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-lingo-text-light">Level</span>
            <span className="font-bold">{stats.level}</span>
          </div>
        </div>
      </Card>

      {/* Achievements */}
      <div>
        <h3 className="text-lg font-bold text-lingo-text mb-3">
          Achievements ({achievements.filter((a) => a.unlocked).length}/
          {achievements.length})
        </h3>
        <div className="space-y-2">
          {achievements.map((a) => (
            <AchievementCard
              key={a.id}
              icon={a.icon}
              title={a.title}
              description={a.description}
              unlocked={a.unlocked}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
