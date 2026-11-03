import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Called by Vercel Cron (see vercel.json). Runs one tiny query so Supabase
 * sees activity and does not pause the free-tier project after a week idle.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` with every cron
 * invocation; anything without it is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { count, error } = await supabase
    .from('puzzles')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 502 })
  }

  return Response.json({ ok: true, puzzles: count, at: new Date().toISOString() })
}
