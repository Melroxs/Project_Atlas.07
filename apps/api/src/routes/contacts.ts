// apps/api/src/routes/contacts.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { contacts } from '@project-atlas/database';
import { z } from 'zod';

// Adjust the schema according to your contacts table definition
const contactSchema = z.object({
  // Example fields – replace with actual columns from your DB schema
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const contactsRoutes: FastifyPluginAsync = async (fastify) => {
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: contacts,
    schema: contactSchema,
  });
};
