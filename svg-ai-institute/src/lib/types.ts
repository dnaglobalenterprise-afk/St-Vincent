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

export type Database = {
  public: {
    Tables: {
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
    }
    Enums: {
      user_role: Role
      interest_audience: InterestAudience
    }
    CompositeTypes: Record<string, never>
  }
}
