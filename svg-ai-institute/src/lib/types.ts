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
