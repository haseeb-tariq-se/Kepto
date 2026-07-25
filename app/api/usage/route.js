import { NextResponse } from 'next/server';
import { getUserFromRequest, getRemainingSaves } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Feeds the "N saves remaining this hour" counter on load.
export async function GET(req) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    return NextResponse.json({ usage: await getRemainingSaves(user.id) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
