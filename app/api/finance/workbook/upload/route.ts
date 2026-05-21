import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody
  const userId = req.nextUrl.searchParams.get('userId') || ''

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
        tokenPayload: userId,
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const uid = (tokenPayload as string) || userId
        if (uid) {
          await prisma.financeWorkbook.upsert({
            where: { userId: uid },
            create: {
              userId: uid,
              filePath: blob.url,
              fileName: blob.pathname.split('/').pop() || 'finance-tracker.xlsx',
              blobUrl: blob.url,
            },
            update: {
              blobUrl: blob.url,
              fileName: blob.pathname.split('/').pop() || 'finance-tracker.xlsx',
              filePath: blob.url,
            },
          })
        }
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (e) {
    console.error('[upload/token]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
