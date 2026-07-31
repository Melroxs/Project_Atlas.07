// packages/database/src/schema/evidence-links.ts
import { pgTable, uuid, text, timestamp, numeric, index } from 'drizzle-orm/pg-core';
import { supplementDrafts } from './supplement-drafts';
import { documents } from './documents';

export const evidenceLinks = pgTable(
  'evidence_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recommendationId: uuid('recommendation_id').notNull(), // Reference to AI recommendation
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
    photoId: uuid('photo_id'), // Will reference photos table when created
    interviewAnswerId: uuid('interview_answer_id'), // Reference to specific interview answer
    relevance: text('relevance').notNull().default('medium'), // 'high' | 'medium' | 'low'
    description: text('description').notNull(), // How this evidence supports the recommendation
    strengthScore: numeric('strength_score', { precision: 3, scale: 2 }).notNull().default('0.50'), // 0.0-1.0
    createdAt: timestamp('created_at').notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    recommendationIdIdx: index('evidence_links_recommendation_id_idx').on(table.recommendationId),
    documentIdIdx: index('evidence_links_document_id_idx').on(table.documentId),
    photoIdIdx: index('evidence_links_photo_id_idx').on(table.photoId),
    relevanceIdx: index('evidence_links_relevance_idx').on(table.relevance),
  })
);
