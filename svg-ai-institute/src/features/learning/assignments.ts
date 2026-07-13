import { supabase } from '../../lib/supabase'
import type { SubmissionStatus } from '../../lib/types'

export const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
export const MAX_FILES = 5
export const MAX_LINKS = 5
export const MIN_TEXT_CHARS = 50

export const ACCEPTED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
  'json',
  'txt',
  'csv',
  'mp4',
]

export const STATUS_META: Record<
  SubmissionStatus,
  { label: string; variant: 'blue' | 'warning' | 'green' }
> = {
  submitted: { label: 'In review', variant: 'blue' },
  changes_requested: { label: 'Changes requested', variant: 'warning' },
  approved: { label: 'Approved', variant: 'green' },
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Strip path characters so a filename can't escape its storage prefix. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, '_').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return `${file.name} is over 20 MB.`
  if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `${file.name}: unsupported file type.`
  }
  return null
}

// Non-cryptographic unique-enough id for storage paths (crypto.randomUUID
// where available; time-based fallback otherwise).
function uploadId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

/** Upload a file into submissions/{userId}/{lessonId}/{uuid}-{name}. Returns the stored path. */
export async function uploadSubmissionFile(
  userId: string,
  lessonId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const path = `${userId}/${lessonId}/${uploadId()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from('submissions').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return { error: `Upload failed: ${error.message}` }
  return { path }
}

/** Short-lived signed URL (60 min) for a stored submission file. */
export async function signedFileUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('submissions').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export function baseName(path: string): string {
  const last = path.split('/').pop() ?? path
  // strip the uuid- prefix we added on upload
  return last.replace(/^[A-Za-z0-9]+-/, '')
}
