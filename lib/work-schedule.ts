// Weekly work schedule used by the dashboard time-budget calculator.
// Defaults below; users can override per-device via localStorage.

export interface WorkDay { start: number; end: number } // minutes from midnight
export type WorkSchedule = Record<number, WorkDay | null> // 0=Sun … 6=Sat

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  0: null,                                      // Sunday — no work
  1: { start: 7 * 60 + 30, end: 15 * 60 + 30 }, // Monday
  2: { start: 9 * 60, end: 17 * 60 },           // Tuesday
  3: { start: 7 * 60 + 30, end: 15 * 60 + 30 }, // Wednesday
  4: { start: 9 * 60, end: 17 * 60 },           // Thursday
  5: { start: 9 * 60, end: 17 * 60 },           // Friday
  6: null,                                      // Saturday — no work
}

const STORAGE_KEY = 'work_schedule_v1'

export function getWorkSchedule(): WorkSchedule {
  if (typeof window === 'undefined') return DEFAULT_WORK_SCHEDULE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WORK_SCHEDULE
    const parsed = JSON.parse(raw) as WorkSchedule
    // Sanity: must have all 7 days as null or {start,end}
    for (let d = 0; d <= 6; d++) {
      const v = parsed[d]
      if (v !== null && (typeof v?.start !== 'number' || typeof v?.end !== 'number')) {
        return DEFAULT_WORK_SCHEDULE
      }
    }
    return parsed
  } catch {
    return DEFAULT_WORK_SCHEDULE
  }
}

export function saveWorkSchedule(schedule: WorkSchedule) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule)) } catch {}
}

export function minToTimeStr(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

export function timeStrToMin(str: string): number {
  const [h, m] = str.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
