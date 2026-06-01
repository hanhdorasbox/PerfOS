import { NextRequest, NextResponse } from 'next/server'
import { createAnthropicClient } from '@/lib/anthropic'

const client = createAnthropicClient()

// WMO weather code → description
function wmoDescription(code: number): string {
  if (code === 0) return 'clear sky'
  if (code === 1) return 'mainly clear'
  if (code === 2) return 'partly cloudy'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'foggy'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain showers'
  if (code === 85 || code === 86) return 'snow showers'
  if (code >= 95) return 'thunderstorm'
  return 'cloudy'
}

function wmoEmoji(code: number): string {
  if (code === 0) return 'sunny'
  if (code <= 2) return 'partly-cloudy'
  if (code === 3) return 'cloudy'
  if (code <= 48) return 'foggy'
  if (code <= 57) return 'light-rain'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'showers'
  if (code <= 86) return 'snow-showers'
  return 'thunderstorm'
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')

    if (!lat || !lon) {
      return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
    }

    // Fetch weather from Open-Meteo (free, no API key)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,precipitation,windspeed_10m,apparent_temperature&hourly=temperature_2m&forecast_days=1&timezone=auto`

    const [weatherRes, geoRes] = await Promise.allSettled([
      fetch(weatherUrl, { next: { revalidate: 3600 } }),
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
        headers: { 'User-Agent': 'PerfOS-Dashboard/1.0' },
        next: { revalidate: 86400 },
      }),
    ])

    if (weatherRes.status === 'rejected') {
      return NextResponse.json({ error: 'Weather fetch failed' }, { status: 502 })
    }

    const weatherData = await weatherRes.value.json()
    const current = weatherData.current

    const temp = Math.round(current.temperature_2m)
    const feelsLike = Math.round(current.apparent_temperature)
    const code = current.weathercode
    const precip = current.precipitation ?? 0
    const wind = Math.round(current.windspeed_10m)
    const description = wmoDescription(code)
    const emoji = wmoEmoji(code)

    // Get evening forecast (around 20:00)
    const hourly = weatherData.hourly
    const eveningIdx = hourly?.time?.findIndex((t: string) => t.includes('T20:'))
    const eveningTemp = eveningIdx != null && eveningIdx >= 0
      ? Math.round(hourly.temperature_2m[eveningIdx])
      : null

    // Location name
    let city = 'your location'
    if (geoRes.status === 'fulfilled') {
      try {
        const geo = await geoRes.value.json()
        city = geo.address?.city ?? geo.address?.town ?? geo.address?.village ?? geo.address?.county ?? 'your location'
      } catch { /* ignore */ }
    }

    // Generate outfit recommendation via Claude
    const outfitPrompt = `Weather: ${temp}°C (feels like ${feelsLike}°C), ${description}, precipitation ${precip}mm, wind ${wind}km/h, evening drop to ${eveningTemp ?? '?'}°C.

Give a SHORT outfit recommendation. Format:
{
  "wear": "2-5 words. e.g. 'light jacket + sneakers'",
  "note": "One optional practical note (gym bag, umbrella, sunscreen). null if nothing relevant."
}

Return ONLY valid JSON.`

    const outfitMsg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 128,
      messages: [{ role: 'user', content: outfitPrompt }],
    })

    let wear = 'Check the weather app'
    let note: string | null = null
    try {
      const outfitText = outfitMsg.content[0].type === 'text' ? outfitMsg.content[0].text : ''
      const outfitJson = JSON.parse(outfitText.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
      wear = outfitJson.wear ?? wear
      note = outfitJson.note ?? null
    } catch { /* use defaults */ }

    return NextResponse.json({
      temp,
      feelsLike,
      code,
      description,
      emoji,
      precip,
      wind,
      eveningTemp,
      city,
      wear,
      note,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
