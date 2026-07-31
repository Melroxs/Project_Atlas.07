# Project Atlas - YC MVP Implementation Roadmap

**Date:** July 25, 2026  
**Objective:** Deliver a compelling Y Combinator demo focused on compliant, evidence-backed insurance supplement intelligence  
**Timeline:** 3 focused implementation sprints (2-3 weeks total)

---

## Sprint Structure

Following the user's recommended approach, we'll break the work into focused implementation sprints:

1. **Sprint 1: Atlas Intelligence Core** (Week 1 - 7-8 days)
2. **Sprint 2: Photos & Document Intelligence** (Week 2 - 5-6 days)
3. **Sprint 3: Demo Polish & Package Generation** (Week 3 - 4-5 days)

---

## Sprint 1: Atlas Intelligence Core

**Goal:** Ensure that every AI recommendation is explainable, evidence-backed, and reviewable

**Duration:** 7-8 days
**Priority:** CRITICAL

**Priority Order:**
1. **Evidence Graph** (Highest Priority) - Every recommendation must have linked evidence
2. **Compliance Engine** (Lightweight validation layer) - Simple status: 🟢 Ready, 🟡 Needs Evidence, 🔴 Cannot Recommend
3. **Human Review** (PR-style interface) - AI explanation, evidence, revenue, confidence, approve/reject/comment
4. **Photo Intelligence** (First-class citizens) - Recommendations must be able to reference photos

### Day 1-2: Evidence Database Schema & API

**Tasks:**
1. Create `evidence_links` database table
   - Fields: id, recommendationId, documentId, photoId, relevance, description, createdAt, createdBy
   - Indexes on recommendationId, documentId, photoId
   - Foreign key constraints
   - RLS policies

2. Create evidence linking API routes
   - POST /evidence-links - Create evidence link
   - GET /evidence-links/:recommendationId - Get evidence for recommendation
   - DELETE /evidence-links/:id - Remove evidence link
   - PUT /evidence-links/:id - Update evidence link

3. Update AI types to include evidence linking
   - Enhance `EvidenceLink` interface
   - Add evidence validation methods

**Deliverables:**
- Database migration for evidence_links table
- Evidence linking API routes
- Updated type definitions

**Acceptance Criteria:**
- Evidence links can be created and retrieved
- Evidence links are properly scoped to company
- Evidence links validate that referenced documents/photos exist

---

### Day 3-4: Evidence Linking Service

**Tasks:**
1. Create EvidenceLinkingService
   - Automatic evidence extraction from AI responses
   - Parse document references in AI recommendations
   - Validate evidence completeness
   - Calculate evidence strength scores

2. Enhance AI result parser
   - Extract document IDs from AI responses
   - Extract photo references from AI responses
   - Map evidence to specific recommendations
   - Generate evidence links automatically

3. Update AI generation workflow
   - Call evidence linking service after AI generation
   - Store evidence links in database
   - Return evidence links with recommendations

**Deliverables:**
- EvidenceLinkingService implementation
- Enhanced AI result parser
- Updated AI generation workflow

**Acceptance Criteria:**
- AI recommendations include evidence links
- Evidence links are automatically created from AI responses
- Evidence strength is calculated and stored

---

### Day 5-6: Compliance Validation System

**Tasks:**
1. Create compliance rules engine
   - Fraud detection rules (no fabrication, no unsupported measurements)
   - Regulatory compliance checks (state-specific requirements)
   - Carrier-specific rules (documentation requirements)
   - Industry standard validation (pricing ranges)

2. Create ComplianceValidationService
   - Pre-submission compliance checks
   - Compliance scoring (0-100)
   - Specific compliance issues with recommendations
   - Compliance approval workflow

3. Update supplement workflow
   - Add compliance check before submission
   - Require compliance approval for submission
   - Log compliance checks in activity timeline

**Deliverables:**
- Compliance rules engine
- ComplianceValidationService
- Updated supplement workflow with compliance gates

**Acceptance Criteria:**
- Supplements cannot be submitted without compliance approval
- Compliance issues are clearly identified
- Compliance score is calculated and displayed

---

### Day 7-8: Evidence & Compliance UI

**Tasks:**
1. Create evidence viewing UI
   - Evidence panel on supplement detail page
   - Click-through to view supporting documents
   - Evidence strength indicators
   - Missing evidence warnings

2. Create compliance UI
   - Compliance score display
   - Compliance issues panel
   - Resolution tracking
   - Compliance approval confirmation

3. Update AI recommendations dialog
   - Show evidence links for each recommendation
   - Show compliance status
   - Highlight missing evidence
   - Show compliance warnings

**Deliverables:**
- Evidence viewing UI components
- Compliance UI components
- Enhanced AI recommendations dialog

**Acceptance Criteria:**
- Users can view evidence for each recommendation
- Compliance status is clearly visible
- Missing evidence is highlighted
- Compliance approval is required before submission

---

## Sprint 2: Photos & Document Intelligence

**Goal:** Enable photo analysis and document content extraction for better AI intelligence

**Duration:** 5-6 days  
**Priority:** HIGH

### Day 1-2: Photos Table & Upload API

**Tasks:**
1. Create `photos` database table
   - Fields: id, companyId, claimId, url, description, location, photoType, metadata, analysisResults, uploadedAt, uploadedBy
   - Indexes on claimId, photoType
   - Foreign key constraints
   - RLS policies

2. Create photo upload API routes
   - POST /photos - Upload photo
   - GET /photos/:claimId - Get photos for claim
   - GET /photos/:id - Get photo details
   - DELETE /photos/:id - Delete photo
   - PUT /photos/:id - Update photo metadata

3. Integrate photo upload with existing document upload
   - Add photo type detection
   - Extract EXIF metadata
   - Generate thumbnails
   - Store in Supabase

**Deliverables:**
- Database migration for photos table
- Photo upload API routes
- Photo metadata extraction

**Acceptance Criteria:**
- Photos can be uploaded and linked to claims
- Photo metadata is automatically extracted
- Photos are properly scoped to company

---

### Day 3: Photo Management UI

**Tasks:**
1. Create photo upload interface
   - Drag-and-drop upload
   - Multi-file upload
   - Progress indicators
   - Photo preview

2. Create photo gallery view
   - Grid view of photos
   - Filter by photo type
   - Search by description
   - Sort by date/location

3. Create photo detail view
   - Full-size photo view
   - Metadata display
   - Location tagging
   - Link to recommendations

**Deliverables:**
- Photo upload UI component
- Photo gallery UI component
- Photo detail UI component

**Acceptance Criteria:**
- Users can upload photos easily
- Photos can be viewed and managed
- Photo metadata is displayed

---

### Day 4: Document Content Extraction

**Tasks:**
1. Create document processing service
   - PDF text extraction (using pdf-parse or similar)
   - OCR for scanned documents (using Tesseract.js)
   - Document content parsing
   - Content storage for AI analysis

2. Update documents API
   - Add content extraction endpoint
   - Store extracted content in database
   - Update document schema to include content field
   - Trigger extraction on upload

3. Integrate with AI context
   - Include document content in AI prompt
   - Enable AI to reference specific document sections
   - Improve evidence linking accuracy

**Deliverables:**
- Document processing service
- Updated documents API with content extraction
- Enhanced AI context with document content

**Acceptance Criteria:**
- Document content is extracted on upload
- AI can analyze document content
- Evidence linking uses document content

---

### Day 5-6: Photo Analysis Integration

**Tasks:**
1. Create photo analysis service
   - AI vision analysis for damage detection (using OpenAI Vision API)
   - Location tagging
   - Evidence categorization
   - Analysis result storage

2. Update AI generation to include photos
   - Pass photo URLs to AI
   - Include photo analysis in context
   - Generate recommendations based on photo evidence
   - Link recommendations to photos

3. Update photo UI to show analysis
   - Display analysis results
   - Show damage detections
   - Link to recommendations

**Deliverables:**
- Photo analysis service
- Updated AI generation with photo integration
- Enhanced photo UI with analysis display

**Acceptance Criteria:**
- Photos are analyzed for damage
- AI uses photo analysis in recommendations
- Photo analysis results are displayed

---

## Sprint 3: Demo Polish & Package Generation

**Goal:** Complete the workflow with package generation and polish for YC demo

**Duration:** 4-5 days  
**Priority:** HIGH

### Day 1-2: Human Review Workflow Enhancement

**Tasks:**
1. Create structured review process
   - Review checklist (evidence completeness, compliance, pricing accuracy)
   - Required fields for approval
   - Reviewer comments/justification
   - Review time tracking

2. Create review wizard UI
   - Step-by-step review process
   - Evidence verification panel
   - Compliance confirmation
   - Required approver fields

3. Update supplement approval workflow
   - Require review checklist completion
   - Track reviewer identity
   - Track review duration
   - Log review in activity timeline

**Deliverables:**
- Review checklist service
- Review wizard UI component
- Updated supplement approval workflow

**Acceptance Criteria:**
- Review checklist must be completed before approval
- Reviewer identity and time are tracked
- Review process is logged in activity timeline

---

### Day 3: Supplement Package Generation

**Tasks:**
1. Create package generation service
   - Compile all supplement data
   - Include all supporting documents
   - Generate cover letter
   - Create evidence appendix
   - Generate PDF package

2. Create package API routes
   - POST /supplements/:id/generate-package - Generate package
   - GET /supplements/:id/package - Get package
   - GET /supplements/:id/package/download - Download package

3. Create package UI
   - Generate package button
   - Package preview
   - Package download
   - Package history

**Deliverables:**
- Package generation service
- Package API routes
- Package UI components

**Acceptance Criteria:**
- Packages can be generated from supplements
- Packages include all supporting documents
- Packages can be downloaded as PDF

---

### Day 4: Demo Data Enhancement

**Tasks:**
1. Create realistic claim scenarios
   - Water damage claim with hidden mold
   - Roof damage with missed decking
   - Fire damage with missed smoke damage
   - Storm damage with code-required upgrades

2. Create complete documentation
   - Realistic estimates (Xactimate format)
   - Insurance carrier correspondence
   - Photos showing damage
   - Inspection reports
   - Building code references

3. Create demo script
   - Step-by-step demo flow
   - Highlight key differentiators
   - Show before/after scenarios
   - Demonstrate compliance features

**Deliverables:**
- Enhanced demo data seed
- Demo script documentation
- Demo scenario configurations

**Acceptance Criteria:**
- Demo data is realistic and compelling
- Demo script highlights Atlas capabilities
- Demo can be run consistently

---

### Day 5: AI Metrics Dashboard

**Tasks:**
1. Create AI metrics tracking
   - Supplements generated count
   - AI acceptance rate
   - Revenue suggested vs. approved
   - Average review time
   - Confidence score accuracy

2. Create metrics API routes
   - GET /ai-supplements/metrics - Get AI metrics
   - GET /ai-supplements/performance - Get performance data

3. Create metrics dashboard UI
   - Real-time metrics display
   - Trend charts
   - Performance comparisons

**Deliverables:**
- AI metrics tracking service
- Metrics API routes
- Metrics dashboard UI

**Acceptance Criteria:**
- AI metrics are tracked accurately
- Metrics are displayed in dashboard
- Trends are visualized

---

## Risk Mitigation

### Risk 1: AI Vision API Costs
**Mitigation:** Use mock photo analysis for demo, implement real analysis post-YC

### Risk 2: OCR Accuracy
**Mitigation:** Focus on PDF text extraction first, add OCR as enhancement

### Risk 3: Timeline Overrun
**Mitigation:** Prioritize critical path items, defer nice-to-have features

### Risk 4: Demo Data Quality
**Mitigation:** Start with simple scenarios, enhance based on feedback

---

## Success Metrics

### Sprint 1 Success Criteria
- Evidence links are automatically created from AI recommendations
- Compliance validation prevents non-compliant submissions
- Users can view evidence and compliance status in UI

### Sprint 2 Success Criteria
- Photos can be uploaded and analyzed
- Document content is extracted and used by AI
- AI recommendations include photo and document evidence

### Sprint 3 Success Criteria
- Structured review process is enforced
- Supplement packages can be generated and downloaded
- Demo data supports compelling YC presentation

### Overall MVP Success Criteria
A contractor can:
1. Upload a realistic restoration claim
2. Upload photos and documents
3. Watch Atlas analyze the claim
4. See Atlas identify legitimate missed supplement revenue
5. Review evidence for every recommendation
6. Verify compliance status
7. Complete structured review process
8. Approve recommendations
9. Generate professional supplement package
10. Understand exactly why every recommendation exists

---

## Dependencies

### External Dependencies
- OpenAI API key (configured)
- Supabase (configured)
- PDF parsing library (pdf-parse)
- OCR library (Tesseract.js)
- PDF generation library (jsPDF or similar)

### Internal Dependencies
- Database migrations must be run before API changes
- AI service must be updated before UI changes
- Demo data must be seeded before demo testing

---

## Next Steps

1. **Review and approve this roadmap**
2. **Set up Sprint 1 planning meeting**
3. **Begin Day 1 tasks: Evidence database schema**
4. **Daily standups to track progress**
5. **End-of-sprint reviews to validate deliverables**

---

## Conclusion

This roadmap focuses on the **critical differentiators** for the YC MVP: evidence linking, compliance validation, and the human-in-the-loop workflow. By following this structured approach, we can deliver a compelling demo that showcases Atlas's unique value proposition in 2-3 weeks.

The sprint structure allows for focused development, regular validation, and course correction as needed. Each sprint builds on the previous one, ensuring that we maintain momentum toward the MVP goal.
