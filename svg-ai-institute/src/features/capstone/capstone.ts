import type { CapstoneStatus, CapstoneType } from '../../lib/types'

export const BUSINESS_TYPES = [
  'Tourism/Guesthouse',
  'Restaurant/Bar',
  'Retail',
  'Tours & Transport',
  'Services',
  'Agriculture',
  'Other',
]

export const ISLANDS = [
  'St. Vincent',
  'Bequia',
  'Union Island',
  'Canouan',
  'Mustique',
  'Mayreau',
  'Other Grenadines',
]

export const CAPSTONE_TYPE_LABELS: Record<CapstoneType, string> = {
  whatsapp_bot: 'WhatsApp bot',
  automation: 'Workflow automation',
  voice_agent: 'AI voice agent',
}

export const CAPSTONE_TYPES: CapstoneType[] = ['whatsapp_bot', 'automation', 'voice_agent']

/** Live-proof field label + placeholder by project type. */
export const LIVE_PROOF_META: Record<CapstoneType, { label: string; placeholder: string }> = {
  whatsapp_bot: { label: 'WhatsApp number the bot answers on', placeholder: '+1 784 555 0000' },
  automation: { label: 'Scenario / share URL', placeholder: 'https://…' },
  voice_agent: { label: "The voice agent's phone number", placeholder: '+1 784 555 0000' },
}

export const CAPSTONE_STATUS_META: Record<
  CapstoneStatus,
  { label: string; variant: 'blue' | 'gold' | 'green' | 'warning' | 'neutral' }
> = {
  requested: { label: 'Requested', variant: 'blue' },
  matched: { label: 'Matched — building', variant: 'blue' },
  submitted: { label: 'In verification', variant: 'gold' },
  changes_requested: { label: 'Changes requested', variant: 'warning' },
  verified: { label: 'Verified', variant: 'green' },
  declined: { label: 'Declined', variant: 'neutral' },
  withdrawn: { label: 'Withdrawn', variant: 'neutral' },
}

/** Timeline steps for the student's My Capstone view. */
export const TIMELINE_STEPS: { key: CapstoneStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'matched', label: 'Matched' },
  { key: 'submitted', label: 'In verification' },
  { key: 'verified', label: 'Verified' },
]

const ORDER: Record<CapstoneStatus, number> = {
  requested: 0,
  matched: 1,
  submitted: 2,
  changes_requested: 2,
  verified: 3,
  declined: -1,
  withdrawn: -1,
}

export function timelineIndex(status: CapstoneStatus): number {
  return ORDER[status]
}

export function waLink(whatsapp: string): string {
  return `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`
}
