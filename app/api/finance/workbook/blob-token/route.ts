import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

// Generates a long-lived client upload token (10 min) so large file uploads
// don't expire mid-transfer (the default is only 30 seconds).
export async function GET(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN is not configured.' },
      { status: 500 }
    )
  }

  const userId = req.nextUrl.searchParams.get('userId') || 'default'
  const pathname = `finance-tracker-${userId}.xlsx`

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      validUntil: Date.now() + 10 * 60 * 1000, // 10 minutes — enough for any file
      addRandomSuffix: false,
      allowedContentTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ],
      maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
    })

    return NextResponse.json({ clientToken, pathname })
  } catch (e) {
    console.error('[blob-token]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
