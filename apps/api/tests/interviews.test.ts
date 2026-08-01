// apps/api/tests/interviews.test.ts
import request from 'supertest';
import { buildFastify } from '../src/server';
import * as ai from '../src/lib/ai';

/**
 * Integration tests for interview workflow routes.
 * The AI generation is mocked to avoid external calls.
 *
 * NOTE: LIVE-DATABASE integration suite — env/supabase stubbed at import
 * (buildFastify is synchronous; the earlier `await` was a type error) and
 * the suite skips cleanly when DATABASE_URL is absent.
 */
jest.mock('../src/lib/ai', () => ({
  generateInterviewAnswer: jest.fn().mockResolvedValue('Mocked AI answer'),
}));

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
    })),
  },
}));

const hasDatabase = () => Boolean(process.env.DATABASE_URL);

// LIVE-DATABASE integration suite: skipped cleanly when no DB is configured.
const describeEnv = hasDatabase() ? describe : describe.skip;

describeEnv('Interviews API', () => {
  let app: ReturnType<typeof buildFastify>;

  beforeAll(async () => {
    app = buildFastify();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  let interviewId: string;

  test('Create interview', async () => {
    const res = await request(app.server)
      .post('/interviews')
      .send({ candidateName: 'John Doe' });
    expect(res.status).toBe(201);
    expect(res.body.candidateName).toBe('John Doe');
    interviewId = res.body.id;
  });

  test('Add question to interview', async () => {
    const res = await request(app.server)
      .post(`/${interviewId}/questions`)
      .send({ interviewId, question: 'What is your biggest strength?' });
    // Note: the route is registered under /interviews/:interviewId/questions via nested router
    expect(res.status).toBe(201);
    expect(res.body.question).toBe('What is your biggest strength?');
  });

  test('Generate AI answer for question', async () => {
    // First fetch the question to obtain its id
    const qRes = await request(app.server).get(`/${interviewId}/questions`);
    expect(qRes.status).toBe(200);
    const question = qRes.body[0];
    const res = await request(app.server)
      .post(`/${interviewId}/questions/${question.id}/generate-answer`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('Mocked AI answer');
    expect(ai.generateInterviewAnswer).toHaveBeenCalled();
  });
});
