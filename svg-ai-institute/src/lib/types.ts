export type Role = 'student' | 'instructor' | 'admin' | 'business_partner'

export type Profile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: Role
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type InterestAudience = 'student' | 'business'

export type InterestSignup = {
  id: string
  audience: InterestAudience
  email: string
  contact_name: string | null
  business_name: string | null
  whatsapp: string | null
  business_type: string | null
  pain_point: string | null
  created_at: string
}

export type ApplicationStatus = 'submitted' | 'under_review' | 'accepted' | 'waitlisted' | 'declined'
export type CohortStatus = 'draft' | 'open' | 'running' | 'completed'
export type EnrollmentStatus = 'active' | 'withdrawn' | 'graduated'

export type Cohort = {
  id: string
  name: string
  start_date: string
  end_date: string
  capacity: number
  status: CohortStatus
  room_id: string | null
  created_at: string
  updated_at: string
}

export type Application = {
  id: string
  ref_code: string
  status: ApplicationStatus
  first_name: string
  last_name: string
  email: string
  whatsapp: string
  date_of_birth: string
  community: string
  country: string
  device_access: string
  internet: string
  weekly_hours: string
  situation: string
  motivation: string
  finisher_story: string
  heard_from: string | null
  committed: boolean
  score: number | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  decline_reason: string | null
  decided_by: string | null
  decided_at: string | null
  cohort_id: string | null
  created_at: string
  updated_at: string
}

export type Enrollment = {
  id: string
  cohort_id: string
  user_id: string
  status: EnrollmentStatus
  created_at: string
}

export type RoomStatus = 'draft' | 'active' | 'archived'
export type CourseStatus = 'draft' | 'published'
export type LessonType = 'video' | 'text' | 'quiz' | 'assignment' | 'replay'
export type VideoStatus = 'none' | 'processing' | 'ready' | 'errored'

export type Room = {
  id: string
  name: string
  slug: string
  description: string | null
  status: RoomStatus
  created_at: string
  updated_at: string
}

export type Course = {
  id: string
  room_id: string
  title: string
  description: string | null
  status: CourseStatus
  created_at: string
  updated_at: string
}

export type Module = {
  id: string
  course_id: string
  title: string
  sort_order: number
  unlock_date: string | null
  created_at: string
  updated_at: string
}

export type Lesson = {
  id: string
  module_id: string
  type: LessonType
  title: string
  sort_order: number
  required: boolean
  published: boolean
  body_markdown: string | null
  mux_upload_id: string | null
  mux_playback_id: string | null
  video_status: VideoStatus
  duration_seconds: number | null
  pass_threshold: number | null
  created_at: string
  updated_at: string
}

export type QuizQuestion = {
  id: string
  lesson_id: string
  prompt: string
  options: string[]
  correct_idx: number
  sort_order: number
}

export type QuizAttempt = {
  id: string
  lesson_id: string
  user_id: string
  answers: number[]
  score_pct: number
  passed: boolean
  created_at: string
}

export type LessonProgress = {
  id: string
  lesson_id: string
  user_id: string
  completed_at: string
}

export type LessonContent = {
  id: string
  module_id: string
  type: LessonType
  title: string
  body_markdown: string | null
  mux_playback_id: string | null
  video_status: VideoStatus
  duration_seconds: number | null
  pass_threshold: number | null
  questions: { id: string; prompt: string; options: string[]; sort_order: number }[]
}

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: Application
        Insert: Partial<Application> &
          Pick<
            Application,
            | 'first_name'
            | 'last_name'
            | 'email'
            | 'whatsapp'
            | 'date_of_birth'
            | 'community'
            | 'device_access'
            | 'internet'
            | 'weekly_hours'
            | 'situation'
            | 'motivation'
            | 'finisher_story'
          >
        Update: Partial<Application>
        Relationships: []
      }
      cohorts: {
        Row: Cohort
        Insert: Pick<Cohort, 'name' | 'start_date' | 'end_date'> & Partial<Cohort>
        Update: Partial<Cohort>
        Relationships: []
      }
      enrollments: {
        Row: Enrollment
        Insert: Pick<Enrollment, 'cohort_id' | 'user_id'> & Partial<Enrollment>
        Update: Partial<Enrollment>
        Relationships: []
      }
      rooms: {
        Row: Room
        Insert: Pick<Room, 'name' | 'slug'> & Partial<Room>
        Update: Partial<Room>
        Relationships: []
      }
      courses: {
        Row: Course
        Insert: Pick<Course, 'room_id' | 'title'> & Partial<Course>
        Update: Partial<Course>
        Relationships: []
      }
      modules: {
        Row: Module
        Insert: Pick<Module, 'course_id' | 'title' | 'sort_order'> & Partial<Module>
        Update: Partial<Module>
        Relationships: []
      }
      lessons: {
        Row: Lesson
        Insert: Pick<Lesson, 'module_id' | 'type' | 'title' | 'sort_order'> & Partial<Lesson>
        Update: Partial<Lesson>
        Relationships: []
      }
      quiz_questions: {
        Row: QuizQuestion
        Insert: Pick<QuizQuestion, 'lesson_id' | 'prompt' | 'options' | 'correct_idx' | 'sort_order'> &
          Partial<QuizQuestion>
        Update: Partial<QuizQuestion>
        Relationships: []
      }
      quiz_attempts: {
        Row: QuizAttempt
        Insert: never
        Update: never
        Relationships: []
      }
      lesson_progress: {
        Row: LessonProgress
        Insert: never
        Update: never
        Relationships: []
      }
      interest_signups: {
        Row: InterestSignup
        Insert: {
          id?: string
          audience: InterestAudience
          email: string
          contact_name?: string | null
          business_name?: string | null
          whatsapp?: string | null
          business_type?: string | null
          pain_point?: string | null
        }
        Update: {
          email?: string
          contact_name?: string | null
          business_name?: string | null
          whatsapp?: string | null
          business_type?: string | null
          pain_point?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          role?: Role
          avatar_url?: string | null
        }
        Update: {
          email?: string
          first_name?: string | null
          last_name?: string | null
          role?: Role
          avatar_url?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      current_user_role: {
        Args: Record<string, never>
        Returns: Role
      }
      check_application_status: {
        Args: { p_email: string; p_ref_code: string }
        Returns: { status: ApplicationStatus; first_name: string }[]
      }
      submit_application: {
        Args: { p: Record<string, unknown> }
        Returns: string
      }
      get_lesson_content: {
        Args: { p_lesson_id: string }
        Returns: LessonContent[]
      }
      submit_quiz: {
        Args: { p_lesson_id: string; p_answers: number[] }
        Returns: { score_pct: number; passed: boolean; wrong_indexes: number[] }[]
      }
      mark_lesson_complete: {
        Args: { p_lesson_id: string }
        Returns: undefined
      }
      is_module_unlocked: {
        Args: { p_module_id: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: Role
      interest_audience: InterestAudience
      application_status: ApplicationStatus
      cohort_status: CohortStatus
      enrollment_status: EnrollmentStatus
    }
    CompositeTypes: Record<string, never>
  }
}
