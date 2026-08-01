// apps/api/src/routes/companies.ts
import { FastifyPluginAsync } from 'fastify';
import { registerCrudRoutes } from './crud';
import { db } from '@project-atlas/database';
import { companies } from '@project-atlas/database';
import { z } from 'zod';
import { pipeline } from 'stream';
import csv from 'csv-parser'; // ensure csv-parser is installed
import { supabase } from '../lib/supabase';
import { AuthenticatedRequest } from '../types/request';

// Zod schema for a company – adjust fields according to DB schema
const companySchema = z.object({
  name: z.string().min(1),
  // slug is NOT NULL UNIQUE in the DB; derive one from name when not supplied
  slug: z.string().min(1).optional(),
  plan: z.string().optional(),
  // add other required fields here (e.g., address, email)
});

// Ensure slug is always present (DB column is NOT NULL UNIQUE)
function withSlug(data: any) {
  const slug = data.slug || (data.name || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return { ...data, slug };
}

// Mapping schema – maps CSV column names to DB column names
const columnMappingSchema = z.record(z.string());

export const companiesRoutes: FastifyPluginAsync = async (fastify) => {
  // Register generic CRUD routes (tenant-level table: no company_id column)
  registerCrudRoutes(fastify, {
    basePath: '/',
    table: companies,
    schema: companySchema,
    companyScoped: false,
    beforeCreate: async (data) => withSlug(data),
  });

  // CSV import endpoint: multipart/form-data with 'file' and 'mapping' fields
  fastify.post('/import-csv', async (req, reply) => {
    try {
      const multipart = await req.file();
      if (!multipart) {
        return reply.code(400).send({ error: 'File missing' });
      }
      const { fields } = multipart;
      const mappingRaw = fields?.mapping as string | undefined;
      if (!mappingRaw) {
        return reply.code(400).send({ error: 'Column mapping missing' });
      }
      const mappingParse = columnMappingSchema.safeParse(JSON.parse(mappingRaw));
      if (!mappingParse.success) {
        return reply.code(400).send({ error: 'Invalid column mapping', details: mappingParse.error.format() });
      }
      const mapping = mappingParse.data; // { csvColumn: dbField }

      const rows: any[] = [];
      await new Promise<void>((resolve, reject) => {
        const parser = csv();
        pipeline(
          multipart.file,
          parser,
          (err) => {
            if (err) reject(err);
          }
        );
        parser.on('data', (data) => {
          const payload: any = {};
          for (const [csvCol, dbField] of Object.entries(mapping)) {
            payload[dbField] = data[csvCol];
          }
          rows.push(payload);
        });
        parser.on('end', () => resolve());
        parser.on('error', (e) => reject(e));
      });

      const validated: any[] = [];
      for (const row of rows) {
        const parsed = companySchema.safeParse(row);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'Row validation failed', row, details: parsed.error.format() });
        }
        // Companies is a tenant-level table: do NOT inject companyId; ensure slug
        validated.push(withSlug(parsed.data));
      }

      const inserted: any[] = [];
      for (const payload of validated) {
        const [record] = await db.insert(companies).values(payload).returning();
        inserted.push(record);
      }

      reply.code(201).send({ insertedCount: inserted.length, inserted });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to import CSV' });
    }
  });
};
