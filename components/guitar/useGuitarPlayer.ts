'use client'
// ─── Playback transport ───────────────────────────────────────────────────────
//
// A lookahead Web-Audio scheduler that plays an arrangement with sample-accurate
// timing while exposing a reactive `currentBeat` for note/measure highlighting.
// Supports tempo & speed, loop ranges, per-voice solo/mute, metronome and count-in.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Arrangement, Voice } from '@/lib/guitar/types'
import { AcousticGuitar } from '@/lib/guitar/audio'

export interface PlayerOptions {
  speed: number // 0.25..1.25 playback-rate multiplier
  metronome: boolean
  countIn: boolean
  loop: { start: number; end: number } | null // in beats
  solo: Voice | null
  muted: Set<Voice>
  masterVolume: number
}

const DEFAULT_OPTS: PlayerOptions = {
  speed: 1,
  metronome: false,
  countIn: false,
  loop: null,
  solo: null,
  muted: new Set(),
  masterVolume: 0.9,
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12 // seconds

function beatsOf(arr: Arrangement | null): number {
  if (!arr || arr.notes.length === 0) return 0
  return Math.max(...arr.notes.map((n) => n.start + n.duration))
}

export function useGuitarPlayer(arrangement: Arrangement | null) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)

  const guitarRef = useRef<AcousticGuitar | null>(null)
  const optsRef = useRef<PlayerOptions>({ ...DEFAULT_OPTS })
  const arrRef = useRef<Arrangement | null>(arrangement)

  // Transport state (audio-clock based).
  const anchorAudioTime = useRef(0) // ctx time when the current segment started
  const anchorBeat = useRef(0) // beat value at that anchor
  const scheduledBeat = useRef(0) // notes scheduled up to this beat
  const lastClickBeat = useRef(-1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)
  const playingRef = useRef(false)

  // Keep the ref pointed at the latest arrangement (never touch refs during render).
  useEffect(() => {
    arrRef.current = arrangement
  }, [arrangement])

  const totalBeatsValue = useMemo(() => beatsOf(arrangement), [arrangement])

  const secPerBeat = useCallback(() => {
    const bpm = arrRef.current?.tempo ?? 90
    return 60 / bpm / (optsRef.current.speed || 1)
  }, [])

  const audible = useCallback((voice: Voice): boolean => {
    const o = optsRef.current
    if (o.solo) return voice === o.solo
    return !o.muted.has(voice)
  }, [])

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    timerRef.current = null
    rafRef.current = null
  }, [])

  const beatToTime = useCallback(
    (beat: number) => anchorAudioTime.current + (beat - anchorBeat.current) * secPerBeat(),
    [secPerBeat],
  )

  const nowBeat = useCallback(() => {
    const g = guitarRef.current
    if (!g) return anchorBeat.current
    return anchorBeat.current + (g.now() - anchorAudioTime.current) / secPerBeat()
  }, [secPerBeat])

  const scheduler = useCallback(() => {
    const g = guitarRef.current
    const arr = arrRef.current
    if (!g || !arr || !playingRef.current) return
    const o = optsRef.current
    const end = o.loop ? o.loop.end : beatsOf(arr)

    const scheduleRange = (fromBeat: number, toBeat: number) => {
      for (const n of arr.notes) {
        if (n.start >= fromBeat - 1e-9 && n.start < toBeat - 1e-9) {
          if (!audible(n.voice)) continue
          const at = beatToTime(n.start)
          if (n.voice === 'percussion' || n.pitch <= 0) {
            g.perc(at, (n.velocity ?? 0.5) * 0.9)
          } else {
            const durSec = Math.max(0.12, n.duration * secPerBeat())
            g.pluck(n.pitch, at, durSec, (n.velocity ?? 0.8) * 0.8, n.voice)
          }
        }
      }
      if (o.metronome) {
        const startClick = Math.max(Math.ceil(fromBeat - 1e-9), lastClickBeat.current + 1)
        for (let b = startClick; b < toBeat - 1e-9; b++) {
          g.click(beatToTime(b), b % (arr.beatsPerMeasure || 4) === 0)
          lastClickBeat.current = b
        }
      }
      scheduledBeat.current = Math.max(scheduledBeat.current, toBeat)
    }

    const horizonTime = g.now() + SCHEDULE_AHEAD
    let horizonBeat = anchorBeat.current + (horizonTime - anchorAudioTime.current) / secPerBeat()

    // Loop wrap: when we reach the end, re-anchor at the loop/piece start.
    if (horizonBeat >= end - 1e-6) {
      const start = o.loop ? o.loop.start : 0
      scheduleRange(scheduledBeat.current, end)
      if (o.loop) {
        const endTime = beatToTime(end)
        anchorAudioTime.current = endTime
        anchorBeat.current = start
        scheduledBeat.current = start
        lastClickBeat.current = Math.floor(start) - 1
        horizonBeat = start + (horizonTime - endTime) / secPerBeat()
        scheduleRange(start, Math.min(horizonBeat, end))
      }
      return
    }
    scheduleRange(scheduledBeat.current, horizonBeat)
  }, [audible, beatToTime, secPerBeat])

  const startFrom = useCallback(
    async (beat: number) => {
      if (!arrRef.current) return
      if (!guitarRef.current) guitarRef.current = new AcousticGuitar()
      const g = guitarRef.current
      await g.resume()
      g.setMasterGain(optsRef.current.masterVolume)

      const bpm = arrRef.current.beatsPerMeasure || 4
      const countBeats = optsRef.current.countIn ? bpm : 0
      const t0 = g.now() + 0.08
      for (let i = 0; i < countBeats; i++) g.click(t0 + i * secPerBeat(), i === 0)
      anchorAudioTime.current = t0 + countBeats * secPerBeat()
      anchorBeat.current = beat
      scheduledBeat.current = beat
      lastClickBeat.current = Math.floor(beat) - 1

      playingRef.current = true
      setIsPlaying(true)
      stopTimers()
      timerRef.current = setInterval(scheduler, LOOKAHEAD_MS)
      scheduler()

      // Self-scheduling animation frame drives the highlight playhead.
      const frame = () => {
        if (!playingRef.current) return
        const o = optsRef.current
        const total = beatsOf(arrRef.current)
        const loopEnd = o.loop ? o.loop.end : total
        let b = nowBeat()
        if (!o.loop && b >= loopEnd) {
          playingRef.current = false
          setIsPlaying(false)
          setCurrentBeat(0)
          anchorBeat.current = 0
          scheduledBeat.current = 0
          stopTimers()
          return
        }
        if (o.loop && b >= o.loop.end) b = o.loop.start + (b - o.loop.end)
        setCurrentBeat(b)
        rafRef.current = requestAnimationFrame(frame)
      }
      rafRef.current = requestAnimationFrame(frame)
    },
    [scheduler, secPerBeat, stopTimers, nowBeat],
  )

  const play = useCallback(() => {
    const o = optsRef.current
    const total = beatsOf(arrRef.current)
    if (o.loop) {
      const from = currentBeat < o.loop.start || currentBeat >= o.loop.end ? o.loop.start : currentBeat
      void startFrom(from)
    } else {
      void startFrom(currentBeat >= total - 0.01 ? 0 : currentBeat)
    }
  }, [currentBeat, startFrom])

  const pause = useCallback(() => {
    playingRef.current = false
    setIsPlaying(false)
    stopTimers()
    setCurrentBeat(nowBeat())
  }, [nowBeat, stopTimers])

  const stop = useCallback(() => {
    playingRef.current = false
    setIsPlaying(false)
    stopTimers()
    setCurrentBeat(0)
    anchorBeat.current = 0
    scheduledBeat.current = 0
  }, [stopTimers])

  const seek = useCallback(
    (beat: number) => {
      const clamped = Math.max(0, Math.min(beat, beatsOf(arrRef.current)))
      setCurrentBeat(clamped)
      anchorBeat.current = clamped
      scheduledBeat.current = clamped
      if (playingRef.current) void startFrom(clamped)
    },
    [startFrom],
  )

  const setOptions = useCallback((patch: Partial<PlayerOptions>) => {
    const prev = optsRef.current
    optsRef.current = { ...prev, ...patch }
    if (guitarRef.current && patch.masterVolume !== undefined) {
      guitarRef.current.setMasterGain(patch.masterVolume)
    }
    // Re-anchor so tempo/speed/loop changes take effect smoothly mid-play.
    if (playingRef.current && (patch.speed !== undefined || patch.loop !== undefined)) {
      const g = guitarRef.current!
      const prevSpb = 60 / (arrRef.current?.tempo ?? 90) / (prev.speed || 1)
      const b = anchorBeat.current + (g.now() - anchorAudioTime.current) / prevSpb
      anchorBeat.current = b
      anchorAudioTime.current = g.now()
      scheduledBeat.current = b
    }
  }, [])

  // Reset transport whenever the arrangement changes (deliberate state reset —
  // the React-idiomatic "key" reset isn't available to a hook).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    playingRef.current = false
    stopTimers()
    anchorBeat.current = 0
    scheduledBeat.current = 0
    setIsPlaying(false)
    setCurrentBeat(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const guitar = guitarRef.current
    return () => {
      stopTimers()
      guitar?.close()
    }
  }, [stopTimers])

  return { isPlaying, currentBeat, play, pause, stop, seek, setOptions, totalBeats: totalBeatsValue }
}
