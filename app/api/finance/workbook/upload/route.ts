import { NextRequest, NextResponse } from 'next/server'

// Edge runtime: streams body directly to Vercel Blob REST API — no buffering/body-size limit
export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured. Add it to your Vercel environment variables.' },
      { status: 500 }
    )
  }

  const userId = req.nextUrl.searchParams.get('userId') || 'default'
  const pathname = `finance-tracker-${userId}.xlsx`

  // Extract store ID from token: vercel_blob_rw_[storeId]_[key]
  const storeId = token.split('_')[3] ?? ''

  try {
    // Pipe raw body stream directly to Vercel Blob API (no buffering)
    const blobRes = await fetch(
      `https://vercel.com/api/blob/${encodeURIComponent(pathname)}`,
      {
        method: 'PUT',
        headers: {
          'authorization': `Bearer ${token}`,
          'x-api-version': '7',
          'x-vercel-blob-access': 'public',
          'x-vercel-blob-add-random-suffix': '0',
          ...(storeId ? { 'x-vercel-blob-store-id': storeId } : {}),
          'content-type':
            req.headers.get('content-type') ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: req.body,
        // @ts-expect-error -- required for streaming in some environments
        duplex: 'half',
      }
    )

    if (!blobRes.ok) {
      const text = await blobRes.text().catch(() => blobRes.statusText)
      return NextResponse.json(
        { error: `Blob storage error ${blobRes.status}: ${text}` },
        { status: 502 }
      )
    }

    const data = await blobRes.json() as { url?: string; downloadUrl?: string }
    const blobUrl = data.url ?? data.downloadUrl

    if (!blobUrl) {
      return NextResponse.json({ error: 'No URL returned from blob storage' }, { status: 502 })
    }

    return NextResponse.json({ blobUrl })
  } catch (e) {
    console.error('[upload/route]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
