import type { MuscleId } from './bodyMap'

export type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'cardio'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  primary: MuscleId[]
  secondary: MuscleId[]
}

// Curated catalogue of common gym / bodyweight movements with the muscles they
// train. Primary = the movement's main target(s); secondary = meaningful helpers.
export const EXERCISES: Exercise[] = [
  // ── Push ──
  { id: 'bench-press', name: 'Barbell bench press', category: 'push', primary: ['chest'], secondary: ['frontDelts', 'triceps'] },
  { id: 'incline-bench', name: 'Incline bench press', category: 'push', primary: ['chest', 'frontDelts'], secondary: ['triceps'] },
  { id: 'db-press', name: 'Dumbbell chest press', category: 'push', primary: ['chest'], secondary: ['frontDelts', 'triceps'] },
  { id: 'push-up', name: 'Push-up', category: 'push', primary: ['chest'], secondary: ['frontDelts', 'triceps', 'abs'] },
  { id: 'dip', name: 'Dips', category: 'push', primary: ['chest', 'triceps'], secondary: ['frontDelts'] },
  { id: 'ohp', name: 'Overhead press', category: 'push', primary: ['frontDelts'], secondary: ['sideDelts', 'triceps', 'traps'] },
  { id: 'db-shoulder-press', name: 'Dumbbell shoulder press', category: 'push', primary: ['frontDelts'], secondary: ['sideDelts', 'triceps'] },
  { id: 'lateral-raise', name: 'Lateral raise', category: 'push', primary: ['sideDelts'], secondary: [] },
  { id: 'front-raise', name: 'Front raise', category: 'push', primary: ['frontDelts'], secondary: [] },
  { id: 'cable-fly', name: 'Cable / pec fly', category: 'push', primary: ['chest'], secondary: ['frontDelts'] },
  { id: 'triceps-pushdown', name: 'Triceps pushdown', category: 'push', primary: ['triceps'], secondary: [] },
  { id: 'skullcrusher', name: 'Skullcrusher', category: 'push', primary: ['triceps'], secondary: [] },
  { id: 'overhead-triceps', name: 'Overhead triceps extension', category: 'push', primary: ['triceps'], secondary: [] },

  // ── Pull ──
  { id: 'pull-up', name: 'Pull-up', category: 'pull', primary: ['lats'], secondary: ['biceps', 'upperBack', 'rearDelts', 'forearms'] },
  { id: 'chin-up', name: 'Chin-up', category: 'pull', primary: ['lats', 'biceps'], secondary: ['upperBack', 'forearms'] },
  { id: 'lat-pulldown', name: 'Lat pulldown', category: 'pull', primary: ['lats'], secondary: ['biceps', 'upperBack'] },
  { id: 'barbell-row', name: 'Barbell row', category: 'pull', primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts', 'lowerBack'] },
  { id: 'db-row', name: 'One-arm dumbbell row', category: 'pull', primary: ['lats', 'upperBack'], secondary: ['biceps', 'rearDelts'] },
  { id: 'seated-row', name: 'Seated cable row', category: 'pull', primary: ['upperBack'], secondary: ['lats', 'biceps', 'rearDelts'] },
  { id: 'face-pull', name: 'Face pull', category: 'pull', primary: ['rearDelts'], secondary: ['upperBack', 'traps'] },
  { id: 'shrug', name: 'Shrug', category: 'pull', primary: ['traps'], secondary: ['forearms'] },
  { id: 'barbell-curl', name: 'Barbell curl', category: 'pull', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'db-curl', name: 'Dumbbell curl', category: 'pull', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'hammer-curl', name: 'Hammer curl', category: 'pull', primary: ['biceps', 'forearms'], secondary: [] },
  { id: 'wrist-curl', name: 'Wrist curl', category: 'pull', primary: ['forearms'], secondary: [] },

  // ── Legs ──
  { id: 'back-squat', name: 'Back squat', category: 'legs', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lowerBack', 'abs'] },
  { id: 'front-squat', name: 'Front squat', category: 'legs', primary: ['quads'], secondary: ['glutes', 'abs', 'upperBack'] },
  { id: 'leg-press', name: 'Leg press', category: 'legs', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'lunge', name: 'Lunge', category: 'legs', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'bulgarian-split', name: 'Bulgarian split squat', category: 'legs', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'deadlift', name: 'Deadlift', category: 'legs', primary: ['glutes', 'hamstrings', 'lowerBack'], secondary: ['quads', 'traps', 'forearms', 'lats'] },
  { id: 'rdl', name: 'Romanian deadlift', category: 'legs', primary: ['hamstrings', 'glutes'], secondary: ['lowerBack'] },
  { id: 'hip-thrust', name: 'Hip thrust', category: 'legs', primary: ['glutes'], secondary: ['hamstrings'] },
  { id: 'leg-curl', name: 'Leg curl', category: 'legs', primary: ['hamstrings'], secondary: [] },
  { id: 'leg-extension', name: 'Leg extension', category: 'legs', primary: ['quads'], secondary: [] },
  { id: 'calf-raise', name: 'Calf raise', category: 'legs', primary: ['calves'], secondary: [] },
  { id: 'goblet-squat', name: 'Goblet squat', category: 'legs', primary: ['quads', 'glutes'], secondary: ['abs'] },

  // ── Core ──
  { id: 'plank', name: 'Plank', category: 'core', primary: ['abs'], secondary: ['obliques', 'lowerBack'] },
  { id: 'crunch', name: 'Crunch', category: 'core', primary: ['abs'], secondary: [] },
  { id: 'leg-raise', name: 'Hanging leg raise', category: 'core', primary: ['abs'], secondary: ['obliques', 'forearms'] },
  { id: 'russian-twist', name: 'Russian twist', category: 'core', primary: ['obliques'], secondary: ['abs'] },
  { id: 'side-plank', name: 'Side plank', category: 'core', primary: ['obliques'], secondary: ['abs'] },
  { id: 'back-extension', name: 'Back extension', category: 'core', primary: ['lowerBack'], secondary: ['glutes', 'hamstrings'] },
  { id: 'cable-crunch', name: 'Cable crunch', category: 'core', primary: ['abs'], secondary: [] },

  // ── Cardio / conditioning (no strength-muscle highlight, but keep for routines) ──
  { id: 'run', name: 'Running', category: 'cardio', primary: ['calves', 'quads'], secondary: ['hamstrings', 'glutes'] },
  { id: 'row-erg', name: 'Rowing machine', category: 'cardio', primary: ['lats', 'quads'], secondary: ['upperBack', 'biceps', 'hamstrings'] },
  { id: 'cycling', name: 'Cycling', category: 'cardio', primary: ['quads'], secondary: ['glutes', 'calves'] },
  { id: 'burpee', name: 'Burpee', category: 'cardio', primary: ['quads', 'chest'], secondary: ['abs', 'frontDelts', 'triceps'] },

  // ── Extra common movements (Hevy-aligned names) ──
  { id: 'machine-chest-press', name: 'Chest Press (Machine)', category: 'push', primary: ['chest'], secondary: ['frontDelts', 'triceps'] },
  { id: 'pec-deck', name: 'Pec Deck (Machine)', category: 'push', primary: ['chest'], secondary: [] },
  { id: 'arnold-press', name: 'Arnold Press (Dumbbell)', category: 'push', primary: ['frontDelts'], secondary: ['sideDelts', 'triceps'] },
  { id: 'cable-lateral-raise', name: 'Lateral Raise (Cable)', category: 'push', primary: ['sideDelts'], secondary: [] },
  { id: 'close-grip-bench', name: 'Bench Press - Close Grip (Barbell)', category: 'push', primary: ['triceps', 'chest'], secondary: ['frontDelts'] },
  { id: 'bench-dip', name: 'Bench Dip', category: 'push', primary: ['triceps'], secondary: ['chest'] },
  { id: 't-bar-row', name: 'T Bar Row', category: 'pull', primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts'] },
  { id: 'pendlay-row', name: 'Pendlay Row (Barbell)', category: 'pull', primary: ['upperBack', 'lats'], secondary: ['biceps', 'rearDelts'] },
  { id: 'chest-supported-row', name: 'Chest Supported Row (Machine)', category: 'pull', primary: ['upperBack'], secondary: ['lats', 'biceps'] },
  { id: 'straight-arm-pulldown', name: 'Straight Arm Pulldown (Cable)', category: 'pull', primary: ['lats'], secondary: ['triceps'] },
  { id: 'preacher-curl', name: 'Preacher Curl (Barbell)', category: 'pull', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'cable-curl', name: 'Bicep Curl (Cable)', category: 'pull', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'rear-delt-fly', name: 'Rear Delt Reverse Fly (Dumbbell)', category: 'pull', primary: ['rearDelts'], secondary: ['upperBack'] },
  { id: 'hack-squat', name: 'Hack Squat (Machine)', category: 'legs', primary: ['quads'], secondary: ['glutes'] },
  { id: 'sumo-deadlift', name: 'Deadlift - Sumo (Barbell)', category: 'legs', primary: ['glutes', 'hamstrings'], secondary: ['quads', 'lowerBack', 'traps'] },
  { id: 'step-up', name: 'Step Up', category: 'legs', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', category: 'legs', primary: ['calves'], secondary: [] },
  { id: 'good-morning', name: 'Good Morning (Barbell)', category: 'legs', primary: ['hamstrings', 'lowerBack'], secondary: ['glutes'] },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', category: 'core', primary: ['abs'], secondary: ['obliques', 'lowerBack'] },
  { id: 'reverse-crunch', name: 'Reverse Crunch', category: 'core', primary: ['abs'], secondary: [] },
  { id: 'pallof-press', name: 'Pallof Press (Cable)', category: 'core', primary: ['obliques'], secondary: ['abs'] },
  { id: 'farmers-carry', name: "Farmer's Carry", category: 'core', primary: ['forearms', 'traps'], secondary: ['abs', 'glutes'] },
]

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
}
