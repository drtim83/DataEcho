import { NextResponse } from 'next/server';
import { requireAdmin, errorMessage } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, admin } = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!admin) return NextResponse.json({ error: 'Only admins can change roles' }, { status: 403 });

    const { id } = await params;
    const { role } = await req.json();

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json({ error: 'role must be "admin" or "user"' }, { status: 400 });
    }
    if (id === user.id && role !== 'admin') {
      return NextResponse.json({ error: "You can't remove your own admin access" }, { status: 400 });
    }

    const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select('id, email, role').single();
    if (error) throw error;

    await logAudit(supabase, {
      action: 'profile.role_change',
      actor: user.email ?? user.id,
      status: 'success',
      details: `Set ${data.email} to role "${role}"`,
    });

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('PATCH /api/profiles/[id] failed:', error);
    return NextResponse.json({ error: errorMessage(error, 'Failed to update role') }, { status: 500 });
  }
}
