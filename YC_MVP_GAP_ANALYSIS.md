# Project Atlas - YC MVP Gap Analysis

**Date:** July 25, 2026  
**Objective:** Deliver a compelling Y Combinator demo focused on compliant, evidence-backed insurance supplement intelligence

---

## Executive Summary

Project Atlas has a **strong foundation** with approximately **75% completion** of the core infrastructure needed for the YC MVP. The AI supplement generation engine, database schema, and basic workflows are well-implemented. However, **critical gaps exist** in the evidence linking system, compliance validation, human review workflow, and demo data that are essential for the YC demo.

**Overall MVP Readiness:** 60%  
**Critical Blockers:** 0  
**High Priority Gaps:** 4  
**Estimated Time to MVP:** 2-3 weeks

---

## Core MVP Workflow Requirements

The YC MVP must demonstrate this end-to-end workflow:

1. **Claim Upload** → Contractor uploads a restoration claim
2. **Document Processing** → Documents are processed and analyzed
3. **Photo Processing** → Photos are uploaded and analyzed
4. **Inspection Notes** → Interview responses are collected
5. **AI Analysis** → Atlas identifies missed supplement opportunities
6. **Missed Revenue Detection** → Legitimate revenue opportunities are identified
7. **Evidence Validation** → Every recommendation is linked to evidence
8. **Compliance Validation** → Recommendations are checked for compliance
9. **Human Review** → Contractor reviews and approves recommendations
10. **Supplement Package Generation** → Submission-ready package is created
11. **Audit Log** → Complete audit trail is maintained

---

## Existing Components (Supporting MVP Workflow)

### ✅ Database Schema (90% Complete)
- **Claims**: Full schema with workflow fields, status tracking, financial summary
- **Supplements**: Complete schema with line items, status workflow, version tracking
- **Supplement Drafts**: AI recommendation storage with versioning, approval tracking
- **Documents**: Document storage with company/claim relationships
- **Interviews**: FNOL interview system with templates and responses
- **Properties**: Property information linked to claims
- **Adjusters**: Adjuster management with claim relationships
- **Activity Logs**: Comprehensive activity tracking with user attribution
- **Companies, Users, Tenants**: Multi-tenant infrastructure

**Status:** Production-ready for MVP

---

### ✅ AI Supplement Generation Engine (75% Complete)
**Location:** `packages/ai/src/`

**Implemented:**
- **Provider-agnostic architecture** with OpenAI implementation
- **Prompt Builder** (`prompt-builder.ts`) - Constructs comprehensive prompts from claim context
- **Result Parser** (`result-parser.ts`) - Parses AI responses into structured recommendations
- **Validation Service** (`validation.ts`) - Basic validation of recommendations
- **Recommendation Engine** (`engine.ts`) - Orchestrates generation and version comparison
- **Type System** (`types.ts`) - Comprehensive type definitions for all AI components

**AI Context Includes:**
- Claim information (number, insurance company, policy, date of loss, cause, description)
- Property details (address, type, year built, square footage)
- Customer information (name, phone, email, address)
- Interview responses (FNOL data)
- Adjuster information
- Existing supplements
- Documents (basic metadata only)
- Photos (placeholder - not implemented)
- Activity timeline

**AI Recommendations Include:**
- Missing damage observations with severity and confidence
- Recommended line items with quantities, pricing, and justification
- Supporting justification for the supplement
- Documentation checklist
- Missing information flags
- Questions for estimator
- Warnings
- Evidence links (structure defined, not implemented)
- AI explanation (approach, data sources, confidence factors, limitations)

**Status:** Functional but missing critical evidence linking and compliance validation

---

### ✅ Supplements Workflow (90% Complete)
**Location:** `apps/api/src/routes/supplements.ts`, `apps/api/src/lib/supplements-workflow.ts`

**Implemented:**
- Full CRUD operations for supplements
- Status workflow with 9 states (Draft → Ready for Review → Submitted → Waiting for Carrier → Needs Revision → Partially Approved → Approved → Denied → Closed)
- Status transition validation
- Line items management with automatic calculations
- Financial summary (subtotal, tax, depreciation, requested/approved amounts)
- Revision history tracking
- Activity service integration for audit trail
- Dashboard statistics API
- UI for supplement detail page with line item editor

**Status:** Production-ready for MVP

---

### ✅ Claims Workflow (90% Complete)
**Location:** `apps/api/src/routes/claims.ts`, `apps/api/src/lib/claims-workflow.ts`

**Implemented:**
- Full CRUD operations for claims
- Status workflow with 12 states
- Status transition validation
- Status history tracking
- Financial summary fields
- Customer information management
- Property and adjuster relationships
- Dashboard statistics API
- Claims list and detail pages

**Status:** Production-ready for MVP

---

### ✅ Documents Management (80% Complete)
**Location:** `apps/api/src/routes/documents.ts`, `packages/database/src/schema/documents.ts`

**Implemented:**
- Document upload to Supabase storage
- Document download functionality
- Document CRUD operations
- Company-scoped permissions
- Claim linking
- File type and size handling
- Public URL generation

**Missing:**
- Document text extraction (OCR, PDF parsing)
- Document categorization/tags
- Document preview
- Document content analysis for AI

**Status:** Functional but needs content extraction for AI analysis

---

### ✅ Interview System (85% Complete)
**Location:** `apps/api/src/routes/interviews.ts`, `apps/api/src/lib/interviews-workflow.ts`

**Implemented:**
- FNOL interview template with 15 sections
- 11 question types (text, number, currency, date, yes/no, multiple choice, file upload, photo upload, etc.)
- Question validation
- Conditional logic for question display
- Progress tracking
- Autosave functionality
- Interview list and detail pages
- Claim data extraction from completed interviews

**Missing:**
- Actual claim generation from interview data (extraction ready, generation pending)
- Document upload integration with Documents module

**Status:** Production-ready for MVP

---

### ✅ Activity Timeline (90% Complete)
**Location:** `apps/api/src/lib/activity.ts`, `apps/api/src/routes/activity.ts`

**Implemented:**
- Centralized Activity Service with logging methods
- Activity logging for all major operations (create, update, delete, upload, download, status change, interview, supplement)
- Activity Timeline API with filters, search, and pagination
- Activity Timeline UI with chronological feed
- User attribution with userName
- Entity name tracking
- Previous/new value tracking
- IP address logging

**Status:** Production-ready for MVP

---

### ✅ Authentication & Multi-Tenant Security (60% Complete)
**Location:** `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/role.ts`

**Implemented:**
- Supabase authentication integration
- Login with email/password and magic link
- Session management
- Frontend route protection
- Backend authentication middleware
- Company assignment verification
- Database schema includes company_id on all tenant tables
- RLS policies defined in migration

**Missing:**
- Role-based access control is placeholder only (no actual permission checks)
- RLS policies not actively enforced in queries
- No company context setting in database session
- No tenant isolation verification tests

**Status:** Functional for demo but needs security hardening before production

---

## Critical Gaps for YC MVP

### ❌ Gap 1: Photos Table & Integration (0% Complete)
**Impact:** HIGH - Photos are critical evidence for supplement recommendations

**Current State:**
- No dedicated photos table exists in database schema
- AI context includes `photos` array but it's always empty
- Prompt builder has photo formatting logic but no data to format
- No photo upload functionality
- No photo analysis or metadata extraction

**Required for MVP:**
1. **Photos database schema** with fields:
   - id, companyId, claimId
   - url, description, location
   - uploadedAt, uploadedBy
   - photoType (e.g., 'damage', 'repair', 'progress')
   - metadata (camera info, GPS, etc.)
   - analysisResults (AI analysis data)

2. **Photo upload API** with:
   - Multipart file upload
   - Image validation
   - Automatic metadata extraction
   - Storage in Supabase
   - Linking to claims

3. **Photo analysis integration**:
   - AI vision analysis for damage detection
   - Location tagging
   - Evidence categorization

4. **UI for photo management**:
   - Photo upload interface
   - Photo gallery view
   - Photo detail view with metadata
   - Linking photos to recommendations

**Estimated Effort:** 3-5 days

---

### ❌ Gap 2: Evidence Linking System (10% Complete)
**Impact:** CRITICAL - This is the core differentiator for the YC MVP

**Current State:**
- AI types define `evidenceLinks` structure
- AI prompt asks for evidence linking
- Result parser expects evidence links
- **BUT**: No actual implementation of linking recommendations to specific documents/photos
- Evidence arrays in recommendations are empty strings
- No UI for viewing evidence links
- No validation that evidence actually exists

**Required for MVP:**
1. **Evidence database schema**:
   - evidence_links table with recommendationId, documentId, photoId
   - relevance score (high/medium/low)
   - description of how evidence supports recommendation
   - createdAt, createdBy

2. **Evidence linking service**:
   - Automatic evidence extraction from AI responses
   - Manual evidence linking by users
   - Evidence validation (verify linked documents exist)
   - Evidence strength scoring

3. **AI enhancement**:
   - Improve prompt to request specific document IDs
   - Enhance result parser to extract document references
   - Add evidence confidence scoring

4. **UI for evidence viewing**:
   - Evidence panel on supplement detail page
   - Click-through to view supporting documents
   - Evidence strength indicators
   - Missing evidence warnings

**Estimated Effort:** 5-7 days

---

### ❌ Gap 3: Compliance Validation System (20% Complete)
**Impact:** CRITICAL - Compliance is a core product principle

**Current State:**
- Basic validation service checks for:
  - Data consistency
  - Realistic pricing
  - Missing critical information
- **BUT**: No specific compliance checks
- No fraud detection
- No regulatory validation
- No carrier-specific rule checking
- No compliance scoring

**Required for MVP:**
1. **Compliance rules engine**:
   - Fraud detection rules (e.g., no fabrication of damage)
   - Regulatory compliance checks (e.g., state-specific requirements)
   - Carrier-specific rules (e.g., carrier documentation requirements)
   - Industry standard validation (e.g., Xactimate pricing ranges)

2. **Compliance validation service**:
   - Pre-submission compliance checks
   - Compliance scoring (0-100)
   - Specific compliance issues with recommendations
   - Compliance approval workflow

3. **Compliance UI**:
   - Compliance score display
   - Compliance issues panel
   - Resolution tracking
   - Compliance approval gate before submission

4. **Compliance audit trail**:
   - Log all compliance checks
   - Track compliance issues and resolutions
   - Compliance officer approvals

**Estimated Effort:** 4-6 days

---

### ❌ Gap 4: Human Review Workflow Enhancement (40% Complete)
**Impact:** HIGH - Human-in-the-loop is a core product principle

**Current State:**
- Supplement approval workflow exists
- AI recommendations can be accepted/rejected
- **BUT**: No structured review process
- No review checklist
- No compliance sign-off
- No reviewer attribution
- No review time tracking

**Required for MVP:**
1. **Structured review process**:
   - Review checklist (evidence completeness, compliance, pricing accuracy)
   - Required fields for approval (e.g., "I have verified all evidence")
   - Reviewer comments/justification
   - Review time tracking

2. **Review UI enhancement**:
   - Step-by-step review wizard
   - Evidence verification panel
   - Compliance confirmation
   - Required approver fields

3. **Review audit trail**:
   - Track reviewer identity
   - Track review duration
   - Track review checklist completion
   - Track reviewer modifications

**Estimated Effort:** 2-3 days

---

### ❌ Gap 5: Supplement Package Generation (0% Complete)
**Impact:** HIGH - Needed for complete workflow demo

**Current State:**
- No supplement package generation
- No PDF export
- No carrier format export
- No submission-ready document creation

**Required for MVP:**
1. **Package generation service**:
   - Compile all supplement data into package
   - Include all supporting documents
   - Generate cover letter
   - Create evidence appendix
   - Package format (PDF or carrier-specific)

2. **Package UI**:
   - Generate package button
   - Package preview
   - Package download
   - Package history

**Estimated Effort:** 3-4 days

---

### ❌ Gap 6: Document Content Extraction (0% Complete)
**Impact:** MEDIUM - Improves AI analysis quality

**Current State:**
- Documents are stored but content is not extracted
- AI only sees document metadata (name, type, upload date)
- No OCR for scanned documents
- No PDF text extraction
- No document content analysis

**Required for MVP:**
1. **Document processing service**:
   - PDF text extraction
   - OCR for scanned documents
   - Document content parsing
   - Content storage for AI analysis

2. **Integration with AI**:
   - Include document content in AI context
   - Enable AI to reference specific document sections
   - Improve evidence linking accuracy

**Estimated Effort:** 4-5 days

---

### ❌ Gap 7: Demo Data for YC Presentation (30% Complete)
**Impact:** HIGH - Need realistic data for compelling demo

**Current State:**
- Demo data service exists with seed factories
- Demo company and personas defined
- **BUT**: Data may not be realistic enough for YC demo
- May lack specific scenarios that highlight Atlas capabilities
- May not include edge cases that demonstrate robustness

**Required for MVP:**
1. **Realistic claim scenarios**:
   - Water damage claim with hidden mold
   - Roof damage with missed decking
   - Fire damage with missed smoke damage
   - Storm damage with code-required upgrades

2. **Complete documentation**:
   - Realistic estimates (Xactimate format)
   - Insurance carrier correspondence
   - Photos showing damage
   - Inspection reports
   - Building code references

3. **Demo script**:
   - Step-by-step demo flow
   - Highlight key differentiators
   - Show before/after scenarios
   - Demonstrate compliance features

**Estimated Effort:** 2-3 days

---

### ❌ Gap 8: AI Metrics Dashboard (0% Complete)
**Impact:** MEDIUM - Nice-to-have for YC demo

**Current State:**
- No AI-specific metrics
- No tracking of AI performance
- No acceptance rate tracking
- No revenue impact tracking

**Required for MVP:**
1. **AI metrics tracking**:
   - Supplements generated
   - AI acceptance rate
   - Revenue suggested vs. approved
   - Average review time
   - Confidence score accuracy

2. **Metrics dashboard**:
   - Real-time metrics display
   - Trend charts
   - Performance comparisons

**Estimated Effort:** 2-3 days

---

## Summary Table

| Component | Status | Completeness | Priority | Effort |
|-----------|--------|--------------|----------|--------|
| Database Schema | ✅ Complete | 90% | - | - |
| AI Generation Engine | ⚠️ Partial | 75% | HIGH | 3-5 days |
| Supplements Workflow | ✅ Complete | 90% | - | - |
| Claims Workflow | ✅ Complete | 90% | - | - |
| Documents Management | ⚠️ Partial | 80% | MEDIUM | 4-5 days |
| Interview System | ✅ Complete | 85% | - | - |
| Activity Timeline | ✅ Complete | 90% | - | - |
| Photos Table & Integration | ❌ Missing | 0% | HIGH | 3-5 days |
| Evidence Linking System | ❌ Missing | 10% | CRITICAL | 5-7 days |
| Compliance Validation | ❌ Missing | 20% | CRITICAL | 4-6 days |
| Human Review Workflow | ⚠️ Partial | 40% | HIGH | 2-3 days |
| Supplement Package Generation | ❌ Missing | 0% | HIGH | 3-4 days |
| Document Content Extraction | ❌ Missing | 0% | MEDIUM | 4-5 days |
| Demo Data | ⚠️ Partial | 30% | HIGH | 2-3 days |
| AI Metrics Dashboard | ❌ Missing | 0% | MEDIUM | 2-3 days |

---

## Recommendations

### Immediate Priorities (Week 1-2)
1. **Evidence Linking System** - This is the core differentiator
2. **Compliance Validation System** - Critical for trust and regulatory compliance
3. **Photos Table & Integration** - Essential for evidence-based recommendations
4. **Human Review Workflow Enhancement** - Core product principle

### Secondary Priorities (Week 2-3)
1. **Supplement Package Generation** - Completes the workflow
2. **Demo Data Enhancement** - Ensures compelling YC demo
3. **Document Content Extraction** - Improves AI analysis quality
4. **AI Metrics Dashboard** - Nice-to-have for demo

### Defer to Post-YC
1. Advanced OCR and image analysis
2. Carrier-specific integrations
3. Advanced compliance rules
4. Multi-language support

---

## Conclusion

Project Atlas has a **solid technical foundation** with most core workflows implemented. The **critical gaps** are in the areas that differentiate Atlas from traditional restoration software: evidence linking, compliance validation, and the human-in-the-loop workflow.

Focusing on these gaps will deliver a **compelling YC demo** that showcases Atlas's unique value proposition: compliant, evidence-backed AI intelligence for insurance supplement recovery.

**Estimated Time to MVP:** 2-3 weeks with focused development on the 4 critical gaps.
