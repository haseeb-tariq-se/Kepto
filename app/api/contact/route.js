import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { email } = await req.json();
    const clean = (email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
    }
    const { error } = await getSupabase().from('contact_messages').insert({ email: clean });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
