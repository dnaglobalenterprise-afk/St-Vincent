import { supabase } from '../../lib/supabase'
import type { Course, Lesson, Module, Room } from '../../lib/types'

/** Metadata-only lesson columns students may read directly (content flows through get_lesson_content). */
export const LESSON_META_COLUMNS = 'id, module_id, type, title, sort_order, required, published'

export type LessonMeta = Pick<
  Lesson,
  'id' | 'module_id' | 'type' | 'title' | 'sort_order' | 'required' | 'published'
>

export type ModuleState = 'completed' | 'current' | 'unlocked' | 'locked'

export interface ProgramData {
  room: Room
  course: Course
  modules: Module[]
  lessonsByModule: Record<string, LessonMeta[]>
  completed: Set<string>
}

/**
 * Load the signed-in student's program: room via active enrollment, the
 * published course, module list, lesson metadata, and own progress.
 * Returns null when the user has no active enrollment (or no course exists).
 */
export async function loadProgram(userId: string): Promise<ProgramData | null> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('cohort_id, cohorts(room_id)')
    .eq('user_id', userId)
    .in('status', ['active', 'graduated'])
    .limit(1)
    .maybeSingle()

  const roomId = (enrollment as { cohorts?: { room_id: string | null } } | null)?.cohorts?.room_id
  if (!roomId) return null

  const [{ data: room }, { data: course }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
    supabase
      .from('courses')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'published')
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ])
  if (!room || !course) return null

  const { data: modules } = await supabase
    .from('modules')
    .select('*')
    .eq('course_id', course.id)
    .order('sort_order')

  const moduleIds = (modules ?? []).map((m) => m.id)
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase
      .from('lessons')
      .select(LESSON_META_COLUMNS)
      .in('module_id', moduleIds)
      .order('sort_order'),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId),
  ])

  const lessonsByModule: Record<string, LessonMeta[]> = {}
  for (const lesson of (lessons ?? []) as LessonMeta[]) {
    ;(lessonsByModule[lesson.module_id] ??= []).push(lesson)
  }

  return {
    room,
    course,
    modules: modules ?? [],
    lessonsByModule,
    completed: new Set((progress ?? []).map((p) => p.lesson_id)),
  }
}

function requiredLessons(data: ProgramData, moduleId: string): LessonMeta[] {
  return (data.lessonsByModule[moduleId] ?? []).filter((l) => l.required && l.published)
}

function moduleComplete(data: ProgramData, moduleId: string): boolean {
  return requiredLessons(data, moduleId).every((l) => data.completed.has(l.id))
}

/** Client-side mirror of is_module_unlocked (server remains the enforcement). */
export function isUnlocked(data: ProgramData, index: number): boolean {
  const module = data.modules[index]
  if (module.unlock_date && module.unlock_date > new Date().toISOString().slice(0, 10)) {
    return false
  }
  if (index === 0) return true
  return moduleComplete(data, data.modules[index - 1].id)
}

export function moduleStates(data: ProgramData): ModuleState[] {
  let currentAssigned = false
  return data.modules.map((module, i) => {
    if (!isUnlocked(data, i)) return 'locked'
    if (moduleComplete(data, module.id)) return 'completed'
    if (!currentAssigned) {
      currentAssigned = true
      return 'current'
    }
    return 'unlocked'
  })
}

export interface ProgressSummary {
  completedCount: number
  totalCount: number
  percent: number
  currentWeekIndex: number
  continueLessonId: string | null
}

export function progressSummary(data: ProgramData): ProgressSummary {
  const states = moduleStates(data)
  let completedCount = 0
  let totalCount = 0
  let continueLessonId: string | null = null

  data.modules.forEach((module, i) => {
    const required = requiredLessons(data, module.id)
    totalCount += required.length
    completedCount += required.filter((l) => data.completed.has(l.id)).length
    if (states[i] !== 'locked' && !continueLessonId) {
      const next = (data.lessonsByModule[module.id] ?? []).find(
        (l) => l.published && !data.completed.has(l.id),
      )
      if (next) continueLessonId = next.id
    }
  })

  const currentIdx = states.indexOf('current')
  return {
    completedCount,
    totalCount,
    percent: totalCount === 0 ? 0 : Math.round((100 * completedCount) / totalCount),
    currentWeekIndex: currentIdx === -1 ? data.modules.length - 1 : currentIdx,
    continueLessonId,
  }
}
