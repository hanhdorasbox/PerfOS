import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

// Edge runtime: streams file directly to Vercel Blob — no 4.5 MB serverless limit
export const runtime = 'edge'

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured. Add it to your Vercel environment variables.' },
      { status: 500 }
    )
  }

  const userId = req.nextUrl.searchParams.get('userId') || ''

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const filename = `finance-tracker-${userId || 'default'}.xlsx`
    const blob = await put(filename, file.stream(), {
      access: 'public',
      addRandomSuffix: false,
      contentType:
        file.type ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    return NextResponse.json({ blobUrl: blob.url })
  } catch (e) {
    console.error('[upload/route]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
