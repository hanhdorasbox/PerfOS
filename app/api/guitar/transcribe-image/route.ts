import { NextRequest, NextResponse } from 'next/server'
import { createAnthropicClient } from '@/lib/anthropic'
import { jsonrepair } from 'jsonrepair'

// Vision transcription can take a few seconds.
export const maxDuration = 60

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_BASE64 = 7_000_000 // ~5 MB image

const PROMPT = `You read guitar tablature and simple sheet music from an image and extract the MAIN MELODY (the single-note lead line — the highest voice).

Output ONLY a JSON object, no prose, in exactly this shape:
{"title": string|null, "tempo": number, "beatsPerMeasure": number, "notes": string}

"notes" is a space-separated list of tokens "Pitch:beats":
- Pitch is scientific pitch notation: C4, F#3, Bb4, A2 … (middle C = C4).
- beats are quarter-note beats: 1 = quarter, 0.5 = eighth, 2 = half, 0.75 = dotted eighth, etc.
- Use "R:beats" for a rest.

Reading an ASCII tab (six lines of dashes and fret numbers): the TOP line is the high e string. Standard tuning open pitches, top line to bottom: e=E4, B=B3, G=G3, D=D3, A=A2, E=E2. A fret number adds that many semitones to the string's open pitch. Read left to right; take only the melody (usually the highest-sounding notes). Infer sensible durations from horizontal spacing (evenly spaced = eighths or quarters).

Reading staff notation: transcribe the melody line's pitches and rhythm.

If tempo isn't shown, use 100. If the metre isn't shown, use 4. If you cannot read a melody reliably, return {"notes": ""}.`

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { imageBase64?: string; mediaType?: string }
    const imageBase64 = body.imageBase64
    if (!imageBase64) return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
    if (imageBase64.length > MAX_BASE64)
      return NextResponse.json({ error: 'Image too large (max ~5 MB). Crop to just the tab.' }, { status: 413 })
    const mediaType = ALLOWED_TYPES.includes(body.mediaType ?? '') ? body.mediaType! : 'image/png'

    // Create the client lazily so a missing key never breaks the build.
    const client = createAnthropicClient()
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/png', data: imageBase64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const open = text.indexOf('{')
    const close = text.lastIndexOf('}')
    if (open < 0 || close < 0) return NextResponse.json({ error: 'Could not read the image.' }, { status: 422 })

    const parsed = JSON.parse(jsonrepair(text.slice(open, close + 1))) as {
      title?: unknown
      tempo?: unknown
      beatsPerMeasure?: unknown
      notes?: unknown
    }
    const notes = String(parsed.notes ?? '').trim()
    if (!notes)
      return NextResponse.json(
        { error: 'No clear melody found in that image. Try a sharper, cropped tab screenshot.' },
        { status: 422 },
      )

    return NextResponse.json({
      notes,
      tempo: Math.round(clampNum(parsed.tempo, 40, 240, 100)),
      beatsPerMeasure: Math.round(clampNum(parsed.beatsPerMeasure, 2, 12, 4)),
      title: typeof parsed.title === 'string' ? parsed.title : null,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Transcription failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
