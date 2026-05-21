import { put, del } from '@vercel/blob'
import { NextResponse } from 'next/server'

// Diagnostic: tests whether the Blob store is actually reachable from the server.
// GET /api/finance/workbook/check-blob
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN

  if (!token) {
    return NextResponse.json({
      ok: false,
      step: 'env',
      message: 'BLOB_READ_WRITE_TOKEN is not set in Vercel environment variables.',
      fix: 'Go to Vercel Dashboard → your project → Storage → Connect a Blob store. Vercel will set this variable automatically.',
    })
  }

  const storeId = token.split('_')[3] ?? '(unknown)'

  // Try uploading a tiny test blob from the server
  let testUrl: string | null = null
  try {
    const testBlob = await put('__blob_check_test.txt', 'ok', {
      access: 'public',
      addRandomSuffix: false,
    })
    testUrl = testBlob.url
  } catch (e) {
    return NextResponse.json({
      ok: false,
      step: 'put',
      storeId,
      message: `Server-side upload failed: ${(e as Error).message}`,
      fix: 'The BLOB_READ_WRITE_TOKEN is set but the Blob store is not accessible. Go to Vercel Dashboard → Storage → make sure the Blob store is created and connected to this project.',
    })
  }

  // Clean up test blob
  try { await del(testUrl) } catch { /* ignore cleanup errors */ }

  return NextResponse.json({
    ok: true,
    step: 'done',
    storeId,
    message: 'Blob store is working correctly from the server.',
  })
}
