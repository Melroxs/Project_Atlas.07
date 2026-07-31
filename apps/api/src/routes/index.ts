// apps/api/src/routes/index.ts
import { FastifyInstance } from 'fastify';
import { companiesRoutes } from './companies';
import { interviewsRoutes } from './interviews';
import { contactsRoutes } from './contacts';
import { claimsRoutes } from './claims';
import { propertiesRoutes } from './properties';
import { tenantsRoutes } from './tenants';
import { usersRoutes } from './users';
import { tenantMembersRoutes } from './tenant_members';
import { supplementsRoutes } from './supplements';
import { documentsRoutes } from './documents';
import { adjustersRoutes } from './adjusters';
import { activityRoutes } from './activity';
import { aiSupplementsRoutes } from './ai-supplements';
import { demoRoutes } from './demo';
import intelligenceRoutes from './intelligence';
import { notesRoutes } from './notes';
import { tasksRoutes } from './tasks';
import { decisionRoutes } from './decisions';
import { evidenceLinksRoutes } from './evidence-links';

export async function registerRoutes(server: FastifyInstance) {
  // Companies CRUD + CSV import
  server.register(companiesRoutes, { prefix: '/companies' });

  // Interview workflow routes
  server.register(interviewsRoutes, { prefix: '/interviews' });

  // Contacts CRUD
  server.register(contactsRoutes, { prefix: '/contacts' });

  // Claims CRUD
  server.register(claimsRoutes, { prefix: '/claims' });

  // Properties CRUD
  server.register(propertiesRoutes, { prefix: '/properties' });

  // Tenants CRUD
  server.register(tenantsRoutes, { prefix: '/tenants' });

  // Users CRUD
  server.register(usersRoutes, { prefix: '/users' });

  // Tenant Members CRUD
  server.register(tenantMembersRoutes, { prefix: '/tenant-members' });

  // Supplements CRUD
  server.register(supplementsRoutes, { prefix: '/supplements' });

  // Documents CRUD
  server.register(documentsRoutes, { prefix: '/documents' });

  // Adjusters CRUD
  server.register(adjustersRoutes, { prefix: '/adjusters' });

  // Activity Timeline
  server.register(activityRoutes, { prefix: '/activity' });

  // Notes CRUD
  server.register(notesRoutes, { prefix: '/notes' });

  // Tasks CRUD
  server.register(tasksRoutes, { prefix: '/tasks' });

  // AI Supplement Generation
  server.register(aiSupplementsRoutes, { prefix: '/ai-supplements' });

  // Demo Mode
  server.register(demoRoutes, { prefix: '/demo' });

  // Atlas Intelligence
  server.register(intelligenceRoutes, { prefix: '/intelligence' });

  // Decision Engine
  server.register(decisionRoutes, { prefix: '/decisions' });

  // Evidence Links
  server.register(evidenceLinksRoutes, { prefix: '/evidence-links' });
}
