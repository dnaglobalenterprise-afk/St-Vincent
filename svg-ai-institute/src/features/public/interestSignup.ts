import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/types'

type InterestInsert = Database['public']['Tables']['interest_signups']['Insert']

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

/**
 * Insert an interest signup. A duplicate (same audience + email, Postgres
 * unique violation 23505) is treated as success — the person is already on
 * the list and must never see an error for that.
 */
export async function registerInterest(
  values: InterestInsert,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('interest_signups').insert({
    ...values,
    email: values.email.trim().toLowerCase(),
  })

  if (!error || error.code === '23505') {
    return { ok: true }
  }
  return { ok: false, message: 'Something went wrong. Please try again.' }
}
