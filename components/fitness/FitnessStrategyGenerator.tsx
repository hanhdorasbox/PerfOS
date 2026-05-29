'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'
import StepProgress, { type ProgressStep } from '@/components/ui/StepProgress'

const GENERATION_STEPS = [
  'Analysing your training history',
  'Designing training structure',
  'Building nutrition approach',
  'Creating 12-week roadmap',
  'Saving strategy',
]

interface Props {
  userId: string
  quarterId?: string
  label?: string
  // Prefill values from existing tracked data
  prefillWeight?: number | null
  prefillWaist?: number | null
  prefillTrainingFreq?: number | null
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#F5F5F7',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box' as const,
  outline: 'none',
}

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: 72,
}

function ChoiceButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
        border: `1px solid ${selected ? 'rgba(184,164,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
        background: selected ? 'rgba(184,164,255,0.15)' : 'rgba(255,255,255,0.04)',
        color: selected ? '#B8A4FF' : '#A1A1A6',
        fontWeight: selected ? 600 : 400,
        textAlign: 'left' as const,
      }}
    >
      {label}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: '#6E6E73', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{children}</div>
}

function Field({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column' as const }}>{children}</div>
}

export default function FitnessStrategyGenerator({ userId, quarterId, label, prefillWeight, prefillWaist, prefillTrainingFreq }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(!label)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [genStepIndex, setGenStepIndex] = useState(0)
  const [error, setError] = useState('')

  // Advance generation steps while loading
  useEffect(() => {
    if (!loading) { setGenStepIndex(0); return }
    const delays = [0, 3000, 8000, 13000, 17000]
    const timers = delays.map((d, i) => setTimeout(() => setGenStepIndex(i), d))
    return () => timers.forEach(clearTimeout)
  }, [loading])

  // Section A — Current state
  const [weight, setWeight] = useState(prefillWeight?.toString() ?? '')
  const [waist, setWaist] = useState(prefillWaist?.toString() ?? '')
  const [additionalMeasurements, setAdditionalMeasurements] = useState('')
  const [mainObjective, setMainObjective] = useState('')
  const [changeType, setChangeType] = useState('') // weight-change | body-shape | performance | consistency

  // Section B — Previous quarter review
  const [plannedSessions, setPlannedSessions] = useState('')
  const [actualSessions, setActualSessions] = useState('')
  const [cardioAdherence, setCardioAdherence] = useState('') // good | partial | skipped
  const [metricProgress, setMetricProgress] = useState('')
  const [sustainable, setSustainable] = useState('') // yes | partial | no
  const [recoveryFelt, setRecoveryFelt] = useState('') // sufficient | variable | insufficient
  const [whatWorked, setWhatWorked] = useState('')
  const [whatFailed, setWhatFailed] = useState('')
  const [nextPlanDirection, setNextPlanDirection] = useState('') // continue | intensify | simplify | restructure

  // Section C — Training preferences
  const [preferredFreq, setPreferredFreq] = useState(prefillTrainingFreq?.toString() ?? '')
  const [maxFreq, setMaxFreq] = useState('')
  const [sessionDuration, setSessionDuration] = useState('') // 45min | 60min | 75min | 90min
  const [keepSplit, setKeepSplit] = useState('') // yes | open-to-change
  const [trainingFocus, setTrainingFocus] = useState<string[]>([])
  const [limitations, setLimitations] = useState('')

  // Section D — Cardio, movement, sauna
  const [wantsCardio, setWantsCardio] = useState('') // yes | no | light-only
  const [cardioTypes, setCardioTypes] = useState('')
  const [cardioFreq, setCardioFreq] = useState('')
  const [walksRegularly, setWalksRegularly] = useState('') // yes | no
  const [walkTarget, setWalkTarget] = useState('')
  const [walkingDays, setWalkingDays] = useState<string[]>([]) // which days
  const [walkingRole, setWalkingRole] = useState('') // tracked-cardio | recovery | step-target
  const [wantsSauna, setWantsSauna] = useState('') // yes | no | already-routine
  const [saunaRoutine, setSaunaRoutine] = useState('')

  // Section E — Nutrition
  const [nutritionStructure, setNutritionStructure] = useState('') // calorie-tracking | protein-only | meal-plan | minimal
  const [caloricIntent, setCaloricIntent] = useState('') // deficit | maintenance | surplus | ai-recommend
  const [proteinConsistency, setProteinConsistency] = useState('') // consistent | variable | not-tracking
  const [linkMealPlan, setLinkMealPlan] = useState('') // yes | no

  // Section F — Success metrics
  const [primaryMetric, setPrimaryMetric] = useState('')
  const [secondaryMetrics, setSecondaryMetrics] = useState<string[]>([])

  const focusOptions = ['Lower body', 'Glutes', 'Core', 'Upper body', 'Full-body balanced', 'Strength emphasis', 'Hypertrophy focus']
  const secondaryMetricOptions = ['Weight trend', 'Waist circumference', 'Strength progression', 'Training adherence', 'Cardio adherence', 'Protein adherence', 'Visual / body composition']
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const toggleFocus = (opt: string) => setTrainingFocus(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])
  const toggleSecondary = (opt: string) => setSecondaryMetrics(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])
  const toggleWalkDay = (day: string) => setWalkingDays(prev => prev.includes(day) ? prev.filter(x => x !== day) : [...prev, day])

  const SECTION_TITLES = [
    'Current State & Objective',
    'Previous Quarter Review',
    'Training Preferences',
    'Cardio, Movement & Sauna',
    'Nutrition Strategy',
    'Success Metrics',
  ]

  const sectionContent = [
    // Section A
    <div key="A" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field>
          <Label>Current weight (kg)</Label>
          <input style={inputStyle} value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 72" />
        </Field>
        <Field>
          <Label>Current waist (cm)</Label>
          <input style={inputStyle} value={waist} onChange={e => setWaist(e.target.value)} placeholder="e.g. 74" />
        </Field>
      </div>
      <Field>
        <Label>Other measurements (optional)</Label>
        <input style={inputStyle} value={additionalMeasurements} onChange={e => setAdditionalMeasurements(e.target.value)} placeholder="e.g. hips 95cm, chest 88cm" />
      </Field>
      <Field>
        <Label>Main objective for this quarter</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['Body recomposition', 'Reduce waist / body composition', 'Build muscle', 'Improve strength', 'Improve conditioning', 'Maintain current regime'].map(opt => (
            <ChoiceButton key={opt} label={opt} selected={mainObjective === opt} onClick={() => setMainObjective(opt)} />
          ))}
        </div>
        <input style={{ ...inputStyle, marginTop: 8 }} value={['Body recomposition','Reduce waist / body composition','Build muscle','Improve strength','Improve conditioning','Maintain current regime'].includes(mainObjective) ? '' : mainObjective} onChange={e => setMainObjective(e.target.value)} placeholder="Or type a custom goal..." />
      </Field>
      <Field>
        <Label>What type of change are you primarily after?</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['weight-change', 'Scale weight change'], ['body-shape', 'Body shape / composition'], ['performance', 'Performance / strength'], ['consistency', 'Routine consistency']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={changeType === val} onClick={() => setChangeType(val)} />
          ))}
        </div>
      </Field>
    </div>,

    // Section B
    <div key="B" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field>
          <Label>Planned sessions/week last quarter</Label>
          <input style={inputStyle} value={plannedSessions} onChange={e => setPlannedSessions(e.target.value)} placeholder="e.g. 4" />
        </Field>
        <Field>
          <Label>Actually completed (avg/week)</Label>
          <input style={inputStyle} value={actualSessions} onChange={e => setActualSessions(e.target.value)} placeholder="e.g. 3" />
        </Field>
      </div>
      <Field>
        <Label>Cardio adherence</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['good', 'Good'], ['partial', 'Partial'], ['skipped', 'Mostly skipped']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={cardioAdherence === val} onClick={() => setCardioAdherence(val)} />
          ))}
        </div>
      </Field>
      <Field>
        <Label>Progress on body metrics</Label>
        <input style={inputStyle} value={metricProgress} onChange={e => setMetricProgress(e.target.value)} placeholder="e.g. Waist down 2cm, weight stable" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field>
          <Label>Was the regime sustainable?</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['yes', 'Yes, fully'], ['partial', 'Mostly'], ['no', 'No, too demanding']].map(([val, lbl]) => (
              <ChoiceButton key={val} label={lbl} selected={sustainable === val} onClick={() => setSustainable(val)} />
            ))}
          </div>
        </Field>
        <Field>
          <Label>How was recovery?</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['sufficient', 'Sufficient'], ['variable', 'Variable'], ['insufficient', 'Insufficient']].map(([val, lbl]) => (
              <ChoiceButton key={val} label={lbl} selected={recoveryFelt === val} onClick={() => setRecoveryFelt(val)} />
            ))}
          </div>
        </Field>
      </div>
      <Field>
        <Label>What worked well?</Label>
        <textarea style={textareaStyle} value={whatWorked} onChange={e => setWhatWorked(e.target.value)} placeholder="e.g. Consistent morning sessions, protein tracking..." />
      </Field>
      <Field>
        <Label>What repeatedly failed or got skipped?</Label>
        <textarea style={textareaStyle} value={whatFailed} onChange={e => setWhatFailed(e.target.value)} placeholder="e.g. Cardio sessions, evening workouts..." />
      </Field>
      <Field>
        <Label>Direction for next quarter</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['continue', 'Continue same approach'], ['intensify', 'Intensify'], ['simplify', 'Simplify'], ['restructure', 'Restructure entirely']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={nextPlanDirection === val} onClick={() => setNextPlanDirection(val)} />
          ))}
        </div>
      </Field>
    </div>,

    // Section C
    <div key="C" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field>
          <Label>Preferred sessions/week</Label>
          <input style={inputStyle} value={preferredFreq} onChange={e => setPreferredFreq(e.target.value)} placeholder="e.g. 3" />
        </Field>
        <Field>
          <Label>Maximum acceptable</Label>
          <input style={inputStyle} value={maxFreq} onChange={e => setMaxFreq(e.target.value)} placeholder="e.g. 4" />
        </Field>
      </div>
      <Field>
        <Label>Typical session duration</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {['45 min', '60 min', '75 min', '90 min'].map(opt => (
            <ChoiceButton key={opt} label={opt} selected={sessionDuration === opt} onClick={() => setSessionDuration(opt)} />
          ))}
        </div>
      </Field>
      <Field>
        <Label>Current training split</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <ChoiceButton label="Keep current split" selected={keepSplit === 'yes'} onClick={() => setKeepSplit('yes')} />
          <ChoiceButton label="Open to changing it" selected={keepSplit === 'open-to-change'} onClick={() => setKeepSplit('open-to-change')} />
        </div>
      </Field>
      <Field>
        <Label>Training focus priorities (select all that apply)</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {focusOptions.map(opt => (
            <ChoiceButton key={opt} label={opt} selected={trainingFocus.includes(opt)} onClick={() => toggleFocus(opt)} />
          ))}
        </div>
      </Field>
      <Field>
        <Label>Limitations or disliked formats (optional)</Label>
        <input style={inputStyle} value={limitations} onChange={e => setLimitations(e.target.value)} placeholder="e.g. No early morning, hate running..." />
      </Field>
    </div>,

    // Section D
    <div key="D" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field>
        <Label>Include cardio in this strategy?</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['yes', 'Yes'], ['light-only', 'Light only'], ['no', 'No']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={wantsCardio === val} onClick={() => setWantsCardio(val)} />
          ))}
        </div>
      </Field>
      {wantsCardio !== 'no' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field>
              <Label>Preferred cardio type</Label>
              <input style={inputStyle} value={cardioTypes} onChange={e => setCardioTypes(e.target.value)} placeholder="e.g. Stairmaster, walking, cycling" />
            </Field>
            <Field>
              <Label>Cardio sessions/week</Label>
              <input style={inputStyle} value={cardioFreq} onChange={e => setCardioFreq(e.target.value)} placeholder="e.g. 2" />
            </Field>
          </div>
        </>
      )}
      <Field>
        <Label>Do you walk regularly?</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <ChoiceButton label="Yes — I walk regularly" selected={walksRegularly === 'yes'} onClick={() => setWalksRegularly('yes')} />
          <ChoiceButton label="Not really" selected={walksRegularly === 'no'} onClick={() => setWalksRegularly('no')} />
        </div>
      </Field>
      {walksRegularly === 'yes' && (
        <>
          <Field>
            <Label>Which days do you usually walk?</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {weekDays.map(day => (
                <ChoiceButton key={day} label={day} selected={walkingDays.includes(day)} onClick={() => toggleWalkDay(day)} />
              ))}
            </div>
          </Field>
          <Field>
            <Label>How does walking fit into your plan?</Label>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {[['tracked-cardio', 'Tracked cardio — counts toward cardio sessions'], ['recovery', 'Active recovery — keeps me moving on rest days'], ['step-target', 'Step target only — not a structured session']].map(([val, lbl]) => (
                <ChoiceButton key={val} label={lbl} selected={walkingRole === val} onClick={() => setWalkingRole(val)} />
              ))}
            </div>
          </Field>
          <Field>
            <Label>Daily step target (optional)</Label>
            <input style={inputStyle} value={walkTarget} onChange={e => setWalkTarget(e.target.value)} placeholder="e.g. 8000 steps" />
          </Field>
        </>
      )}
      <Field>
        <Label>Sauna</Label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {[['already-routine', 'Already have a routine'], ['yes', 'Include in strategy'], ['no', 'Not relevant']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={wantsSauna === val} onClick={() => setWantsSauna(val)} />
          ))}
        </div>
      </Field>
      {(wantsSauna === 'already-routine' || wantsSauna === 'yes') && (
        <Field>
          <Label>Current sauna routine (if any)</Label>
          <input style={inputStyle} value={saunaRoutine} onChange={e => setSaunaRoutine(e.target.value)} placeholder="e.g. Tue + Thu after workout, 20 min" />
        </Field>
      )}
    </div>,

    // Section E
    <div key="E" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field>
        <Label>Nutrition structure this quarter</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['calorie-tracking', 'Full calorie tracking'], ['protein-only', 'Protein-focused only'], ['meal-plan', 'Use Project Hanh meal planning'], ['minimal', 'Minimal structure']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={nutritionStructure === val} onClick={() => setNutritionStructure(val)} />
          ))}
        </div>
      </Field>
      <Field>
        <Label>Caloric intent</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['deficit', 'Deficit (lose body fat)'], ['maintenance', 'Maintenance'], ['surplus', 'Slight surplus (build)'], ['ai-recommend', 'Let AI recommend based on goal']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={caloricIntent === val} onClick={() => setCaloricIntent(val)} />
          ))}
        </div>
      </Field>
      <Field>
        <Label>Recent protein tracking consistency</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['consistent', 'Consistent'], ['variable', 'Variable'], ['not-tracking', 'Not tracking']].map(([val, lbl]) => (
            <ChoiceButton key={val} label={lbl} selected={proteinConsistency === val} onClick={() => setProteinConsistency(val)} />
          ))}
        </div>
      </Field>
      <Field>
        <Label>Link weekly meal planning to this strategy?</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <ChoiceButton label="Yes — sync meal plan" selected={linkMealPlan === 'yes'} onClick={() => setLinkMealPlan('yes')} />
          <ChoiceButton label="No — keep separate" selected={linkMealPlan === 'no'} onClick={() => setLinkMealPlan('no')} />
        </div>
      </Field>
    </div>,

    // Section F
    <div key="F" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field>
        <Label>Primary success metric for this quarter</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['Waist circumference', 'Weight trend', 'Strength progression', 'Training adherence', 'Body composition (visual)'].map(opt => (
            <ChoiceButton key={opt} label={opt} selected={primaryMetric === opt} onClick={() => setPrimaryMetric(opt)} />
          ))}
        </div>
        <input style={{ ...inputStyle, marginTop: 8 }} value={['Waist circumference','Weight trend','Strength progression','Training adherence','Body composition (visual)'].includes(primaryMetric) ? '' : primaryMetric} onChange={e => setPrimaryMetric(e.target.value)} placeholder="Or type a custom metric..." />
      </Field>
      <Field>
        <Label>Secondary metrics (select all relevant)</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {secondaryMetricOptions.map(opt => (
            <ChoiceButton key={opt} label={opt} selected={secondaryMetrics.includes(opt)} onClick={() => toggleSecondary(opt)} />
          ))}
        </div>
      </Field>
    </div>,
  ]

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const intakeData = {
        currentState: { weight, waist, additionalMeasurements, mainObjective, changeType },
        previousQuarter: { plannedSessions, actualSessions, cardioAdherence, metricProgress, sustainable, recoveryFelt, whatWorked, whatFailed, nextPlanDirection },
        trainingPreferences: { preferredFreq, maxFreq, sessionDuration, keepSplit, trainingFocus, limitations },
        cardioMovementSauna: { wantsCardio, cardioTypes, cardioFreq, walksRegularly, walkingDays, walkingRole, walkTarget, wantsSauna, saunaRoutine },
        nutrition: { nutritionStructure, caloricIntent, proteinConsistency, linkMealPlan },
        successMetrics: { primaryMetric, secondaryMetrics },
      }

      const res = await fetch('/api/fitness/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, quarterId, intakeData }),
      })
      const data = await res.json() as { error?: string; id?: string }
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate strategy. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (label && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#A1A1A6', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F5F5F7', marginBottom: 4 }}>
          Quarterly Fitness Review
        </h2>
        <p style={{ fontSize: 13, color: '#6E6E73' }}>
          6 sections · Takes about 5 minutes · Strategy generated after completion
        </p>
      </div>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {SECTION_TITLES.map((title, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600,
              color: i === step ? '#B8A4FF' : i < step ? '#7FD5AA' : '#6E6E73',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: i === step ? 'rgba(184,164,255,0.2)' : i < step ? 'rgba(127,213,170,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${i === step ? 'rgba(184,164,255,0.4)' : i < step ? 'rgba(127,213,170,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ display: step === i ? 'block' : 'none' }}>{title}</span>
          </div>
        ))}
      </div>

      {/* Section title */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: 4 }}>
          Section {step + 1} of {SECTION_TITLES.length}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F5F7' }}>
          {SECTION_TITLES[step]}
        </div>
      </div>

      {sectionContent[step]}

      {error && <div style={{ fontSize: 12, color: '#FF9B87', marginTop: 12 }}>{error}</div>}

      {/* Generation loading panel (replaces nav when running) */}
      {loading ? (
        <div
          className="animate-fade-in"
          style={{
            marginTop: 24,
            padding: '20px 22px',
            background: 'rgba(127,213,170,0.04)',
            border: '1px solid rgba(127,213,170,0.14)',
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Spinner size={18} color="#7FD5AA" strokeWidth={2} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#7FD5AA' }}>Generating your Fitness Strategy…</span>
          </div>
          <StepProgress
            compact
            steps={GENERATION_STEPS.map((label, i): ProgressStep => ({
              label,
              status: i < genStepIndex ? 'done'
                    : i === genStepIndex ? 'active'
                    : 'pending',
            }))}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={() => step > 0 ? setStep(step - 1) : setExpanded(false)}
            className="btn-motion"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#A1A1A6', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer',
            }}
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>

          {step < SECTION_TITLES.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="btn-motion"
              style={{
                background: 'rgba(184,164,255,0.15)', border: '1px solid rgba(184,164,255,0.3)',
                color: '#B8A4FF', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={loading}
              className="btn-motion"
              style={{
                background: 'rgba(127,213,170,0.15)',
                border: '1px solid rgba(127,213,170,0.3)',
                color: '#7FD5AA', borderRadius: 8, padding: '9px 24px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Generate Strategy →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
