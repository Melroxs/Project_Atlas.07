// apps/api/tests/companies.test.ts
import request from 'supertest';
import { buildFastify } from '../src/server'; // assume server exports a factory

/**
 * Basic integration test for company CRUD and CSV import.
 *
 * NOTE: this is a LIVE-DATABASE integration suite. The Fastify server
 * imports env/supabase at module load, so those modules are stubbed here
 * (the typecheck fix for `buildFastify` being synchronous). The suite is
 * skipped cleanly when DATABASE_URL is absent — it must not fail to run.
 */
jest.mock('../src/lib/env', () => ({
  env: {
    PORT: '3000',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/atlas',
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key',
  },
  validateEnv: () => ({ valid: true, errors: [] }),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      then: undefined,
    })),
  },
}));

const hasDatabase = () => Boolean(process.env.DATABASE_URL);

// LIVE-DATABASE integration suite: skipped cleanly when no DB is configured.
const describeEnv = hasDatabase() ? describe : describe.skip;

describeEnv('Companies API', () => {
  let app: ReturnType<typeof buildFastify>;

  beforeAll(async () => {
    app = buildFastify();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  test('GET empty list', async () => {
    const res = await request(app.server).get('/companies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Create company', async () => {
    const res = await request(app.server)
      .post('/companies')
      .send({ name: 'Acme Corp' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Acme Corp');
    expect(res.body.id).toBeDefined();
  });

  test('Import CSV (mocked file)', async () => {
    const csvContent = 'Company Name,Email\nAcme Corp,info@acme.com';
    const mapping = JSON.stringify({ 'Company Name': 'name', Email: 'email' });
    const res = await request(app.server)
      .post('/companies/import-csv')
      .field('mapping', mapping)
      .attach('file', Buffer.from(csvContent), { filename: 'test.csv' });
    expect(res.status).toBe(201);
    expect(res.body.insertedCount).toBeGreaterThan(0);
  });
});
