// AST (America/St_Vincent, UTC-4, no DST) is the canonical display timezone.
// Times are stored as timestamptz (UTC); we always render in AST with the label.

const AST_TZ = 'America/St_Vincent'

export function formatAst(iso: string): string {
  const d = new Date(iso)
  const s = d.toLocaleString('en-US', {
    timeZone: AST_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${s} AST`
}

export function formatAstDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: AST_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatAstTime(iso: string): string {
  const s = new Date(iso).toLocaleTimeString('en-US', {
    timeZone: AST_TZ,
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${s} AST`
}

/**
 * Convert a date + time entered in AST (UTC-4) into a UTC ISO string for storage.
 * AST has no DST, so the offset is a constant +4 hours to UTC.
 */
export function astInputToUtcIso(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM (interpreted as AST)
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  // AST = UTC-4, so UTC = AST + 4h. Build the UTC instant directly.
  return new Date(Date.UTC(y, m - 1, d, hh + 4, mm)).toISOString()
}

/** UTC ISO -> {date: YYYY-MM-DD, time: HH:MM} in AST, for prefilling edit forms. */
export function utcIsoToAstInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  let hour = get('hour')
  if (hour === '24') hour = '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` }
}

export interface Countdown {
  live: boolean
  ended: boolean
  label: string
}

/** Countdown string relative to now for a class start + duration. */
export function countdown(scheduledAt: string, durationMinutes: number, now: number): Countdown {
  const start = new Date(scheduledAt).getTime()
  const end = start + durationMinutes * 60_000
  if (now >= start && now <= end) return { live: true, ended: false, label: 'Live now' }
  if (now > end) return { live: false, ended: true, label: 'Ended' }
  const diff = start - now
  const days = Math.floor(diff / 86_400_000)
  const hrs = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return { live: false, ended: false, label: `in ${days}d ${hrs}h` }
  if (hrs > 0) return { live: false, ended: false, label: `in ${hrs}h ${mins}m` }
  return { live: false, ended: false, label: `in ${mins}m` }
}

/** Join opens 15 minutes before start. */
export function joinOpen(scheduledAt: string, durationMinutes: number, now: number): boolean {
  const start = new Date(scheduledAt).getTime()
  const end = start + durationMinutes * 60_000
  return now >= start - 15 * 60_000 && now <= end
}

function icsEscape(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

function toIcsUtc(iso: string): string {
  // YYYYMMDDTHHMMSSZ
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Build an .ics file body for a class (UTC times per the iCalendar spec). */
export function buildIcs(cls: {
  id: string
  title: string
  description?: string | null
  scheduled_at: string
  duration_minutes: number
  meeting_url?: string | null
}): string {
  const start = toIcsUtc(cls.scheduled_at)
  const end = toIcsUtc(new Date(new Date(cls.scheduled_at).getTime() + cls.duration_minutes * 60_000).toISOString())
  const desc = [cls.description ?? '', cls.meeting_url ? `Join: ${cls.meeting_url}` : ''].filter(Boolean).join('\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SVG AI Institute//Classes//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:class-${cls.id}@svg-ai-institute`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(cls.title)}`,
    desc ? `DESCRIPTION:${icsEscape(desc)}` : '',
    cls.meeting_url ? `URL:${icsEscape(cls.meeting_url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export function downloadIcs(cls: Parameters<typeof buildIcs>[0]): void {
  const blob = new Blob([buildIcs(cls)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${cls.title.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
