import {
  Crown,
  Flame,
  Footprints,
  GraduationCap,
  HelpCircle,
  PackageCheck,
  Rocket,
  Target,
  Video,
  type LucideIcon,
} from 'lucide-react'

export interface Level {
  level: number
  name: string
  min: number
  next: number | null
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Spark', min: 0, next: 100 },
  { level: 2, name: 'Builder', min: 100, next: 250 },
  { level: 3, name: 'Operator', min: 250, next: 500 },
  { level: 4, name: 'Systems Boss', min: 500, next: 1000 },
  { level: 5, name: 'Island Legend', min: 1000, next: null },
]

export function levelFor(points: number): Level {
  return [...LEVELS].reverse().find((l) => points >= l.min) ?? LEVELS[0]
}

/** Progress (0-1) toward the next level, and points remaining. */
export function levelProgress(points: number): { pct: number; toNext: number | null; nextName: string | null } {
  const lvl = levelFor(points)
  if (lvl.next === null) return { pct: 1, toNext: null, nextName: null }
  const span = lvl.next - lvl.min
  const into = points - lvl.min
  const nextName = LEVELS.find((l) => l.level === lvl.level + 1)?.name ?? null
  return { pct: Math.min(1, into / span), toNext: lvl.next - points, nextName }
}

/** Human label + points for a point-event kind (matches the server economy). */
export const KIND_META: Record<string, { label: string; icon: LucideIcon }> = {
  lesson_video: { label: 'Lesson complete', icon: Video },
  lesson_text: { label: 'Lesson complete', icon: Footprints },
  lesson_replay: { label: 'Replay watched', icon: Video },
  quiz_pass: { label: 'Quiz passed', icon: HelpCircle },
  quiz_perfect: { label: 'Perfect quiz!', icon: Target },
  assignment_approved: { label: 'Assignment approved', icon: PackageCheck },
  class_attended: { label: 'Class attended', icon: Video },
  capstone_verified: { label: 'Capstone verified!', icon: Rocket },
  graduated: { label: 'Graduated!', icon: GraduationCap },
  streak_7: { label: '7-day streak!', icon: Flame },
}

export function kindLabel(kind: string): string {
  return KIND_META[kind]?.label ?? 'Points earned'
}

export const BADGE_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  'help-circle': HelpCircle,
  target: Target,
  'package-check': PackageCheck,
  video: Video,
  flame: Flame,
  rocket: Rocket,
  'graduation-cap': GraduationCap,
  crown: Crown,
}

/** Whether "today" (AST) has any activity, given the streak's last_activity_date. */
export function streakActiveToday(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false
  const todayAst = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Vincent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return lastActivityDate === todayAst
}
