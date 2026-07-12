import LockScreen from '@/components/LockScreen'

export const dynamic = 'force-dynamic'

export default async function LockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  // Only allow internal same-origin paths as the post-unlock destination
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return <LockScreen next={safeNext} />
}
