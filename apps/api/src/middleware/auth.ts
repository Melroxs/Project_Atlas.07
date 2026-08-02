import { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../lib/supabase';
import { AuthenticatedRequest } from '../types/request';
import { pool } from '@project-atlas/database';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    reply.code(401).send({ error: 'Missing auth token' });
    return;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token as string);
  if (error || !user) {
    reply.code(401).send({ error: 'Invalid token' });
    return;
  }
  // Attach user info to request for downstream handlers
  (request as AuthenticatedRequest).user = user;
  (request as AuthenticatedRequest).userId = user.id;
  (request as AuthenticatedRequest).userName = user.email || user.id;
  (request as AuthenticatedRequest).ipAddress = request.ip || 'unknown';
  
  // Resolve companyId via tenant_members
  const { data: tm, error: tmErr } = await supabase
    .from('tenant_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .single();
  if (tmErr || !tm) {
    reply.code(403).send({ error: 'User not assigned to a company' });
    return;
  }
  (request as AuthenticatedRequest).companyId = tm.company_id;
  (request as AuthenticatedRequest).role = tm.role;

  // Set company context in database session for RLS policies
  // NOTE: PostgreSQL does not accept bind parameters in `SET` — use set_config() instead.
  try {
    await pool.query('SELECT set_config(\'app.current_company\', $1, false)', [tm.company_id]);
  } catch (dbError) {
    console.error('Failed to set company context:', dbError);
    // Continue anyway as RLS will use default behavior
  }
}
