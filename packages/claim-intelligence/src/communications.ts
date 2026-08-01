// packages/claim-intelligence/src/communications.ts
import { ClaimBundle, ExtractedEntity, ExtractedEntityType } from './types';

let seq = 0;

const PATTERNS: { type: ExtractedEntityType; re: RegExp; label?: string }[] = [
  { type: 'claim_number', re: /\b(?:claim\s*(?:#|no\.?|number)?\s*)?([A-Z]{2,6}[-_ ]?\d{3,10})\b/gi },
  { type: 'policy_number', re: /\b(?:policy\s*(?:#|no\.?|number)?\s*)([A-Z0-9][A-Z0-9\-_]{3,19})\b/gi },
  { type: 'date', re: /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{2,4}\b/gi },
  { type: 'deadline', re: /\b(?:by|before|deadline|due)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/gi },
  { type: 'adjuster_name', re: /\b(?:adjuster|with|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g },
  { type: 'customer_name', re: /\b(?:customer|insured|homeowner|policyholder)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/gi },
  { type: 'address', re: /\b\d{1,5}\s+[A-Za-z0-9\.\- ]+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|way|court|ct)[\s,\.]+(?:[A-Za-z ]+)?/gi },
  { type: 'requested_document', re: /\b(?:please\s+)?(?:send|provide|upload|submit|need|require|request)[s]?\s+(?:the\s+|a\s+)?([A-Za-z \-]{4,40}(?:report|estimate|document|form|photos?|photos?|proof|statement|letter|contract))\b/gi },
  { type: 'promise', re: /\b(?:we|i|will|promise|commit)[^.]{0,80}\b(gonna|will|shall)\b[^.]{0,60}\./gi },
  { type: 'damage_description', re: /\b(?:water|fire|wind|hail|storm|roof|structural|mold|flood|vandalism|impact)\s+damage\b/gi },
];

/**
 * Extract structured entities from a communication while preserving the
 * original content. Deterministic, zero-LLM, so it runs on every event.
 */
export function extractEntitiesFromText(
  content: string,
  source: 'note' | 'activity' | 'ai_conversation',
  sourceCommunicationId: string
): ExtractedEntity[] {
  if (!content) return [];
  const out: ExtractedEntity[] = [];
  const seen = new Set<string>();

  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const value = (m[1] || m[0]).trim();
      if (value.length < 2 || value.length > 80) continue;
      const key = `${type}|${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const start = Math.max(0, m.index - 30);
      const context = content.slice(start, Math.min(content.length, m.index + m[0].length + 40)).replace(/\s+/g, ' ').trim();
      out.push({
        id: `ext-${++seq}`,
        entityType: type,
        value,
        confidence: confidenceFor(type, value),
        context,
        sourceCommunicationId,
        source,
      });
    }
  }
  return out;
}

export function extractAll(bundle: ClaimBundle): ExtractedEntity[] {
  seq = 0;
  const all: ExtractedEntity[] = [];
  for (const c of bundle.communications) {
    all.push(...extractEntitiesFromText(c.content, c.source, c.id));
  }
  return all;
}

function confidenceFor(type: ExtractedEntityType, value: string): number {
  switch (type) {
    case 'claim_number':
    case 'policy_number':
      return value.replace(/[^A-Z0-9]/gi, '').length >= 6 ? 0.9 : 0.7;
    case 'date':
      return 0.95;
    case 'deadline':
      return 0.85;
    case 'address':
      return /\d{1,5}\s+/.test(value) ? 0.9 : 0.6;
    case 'requested_document':
    case 'promise':
      return 0.7;
    default:
      return 0.65;
  }
}
