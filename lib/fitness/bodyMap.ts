// Muscle groups used by the interactive body map + exercise catalogue.
// One logical id per group (both sides of the body share an id).

export type MuscleId =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'lats'
  | 'traps'
  | 'upperBack'
  | 'lowerBack'

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest',
  frontDelts: 'Front delts',
  sideDelts: 'Side delts',
  rearDelts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  lats: 'Lats',
  traps: 'Traps',
  upperBack: 'Upper back',
  lowerBack: 'Lower back',
}

export const ALL_MUSCLES = Object.keys(MUSCLE_LABELS) as MuscleId[]

/** Which muscles are drawn on the front vs. the back figure. */
export const FRONT_MUSCLES: MuscleId[] = [
  'chest', 'frontDelts', 'sideDelts', 'biceps', 'forearms', 'abs', 'obliques', 'quads',
]
export const BACK_MUSCLES: MuscleId[] = [
  'traps', 'rearDelts', 'upperBack', 'lats', 'lowerBack', 'triceps', 'glutes', 'hamstrings', 'calves',
]

export type Activation = 'primary' | 'secondary'
export type ActivationMap = Partial<Record<MuscleId, Activation>>
